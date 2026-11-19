"""Workflow Execution Engine.

Topological and condition-based execution of automation workflows inspired by n8n and Make.
Executes connected nodes, evaluates conditions, tracks logs, and coordinates AI poster analysis,
resume matching, and Gmail application dispatch.
"""
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.events import publish_event
from app.core.logging import get_logger
from app.models.application import Application
from app.models.job_poster import ExtractedJobDetails, JobPoster
from app.models.profile import Profile
from app.models.role_resume import RoleResume
from app.models.workflow import AutomationWorkflow, ExecutionLogEntry, WorkflowExecution, WorkflowNode
from app.services.ai.job_poster_analyzer import JobPosterAnalyzer
from app.services.resume_matcher import ResumeMatcher, ResumeMatchScore
from app.services.sending_service import SendingService
from app.services.template_matcher import TemplateMatcher

log = get_logger("workflow_engine")
settings = get_settings()


class WorkflowEngine:
    @staticmethod
    def _find_start_node(workflow: AutomationWorkflow) -> Optional[WorkflowNode]:
        """Identify start or trigger node."""
        for node in workflow.nodes:
            ntype = (node.type or "").lower()
            if "trigger" in ntype or ntype in ["start", "job_image_uploaded", "manual"]:
                return node
        return workflow.nodes[0] if workflow.nodes else None

    @staticmethod
    def _find_outgoing_edges(workflow: AutomationWorkflow, node_id: str, handle: Optional[str] = None):
        return [
            e for e in workflow.edges
            if e.source == node_id and (handle is None or e.sourceHandle == handle)
        ]

    @classmethod
    async def run_workflow(
        cls,
        tenant_id: str,
        user_id: str,
        workflow: AutomationWorkflow,
        job_poster_id: Optional[str] = None,
        initial_context: Optional[Dict[str, Any]] = None,
        is_test_run: bool = False,
        execution_mode: Optional[str] = None
    ) -> WorkflowExecution:
        """Execute workflow DAG sequentially with full step-by-step logging.
        - syn (Synchronous): Each node executes sequentially; if any node fails, execution stops immediately.
        - asyn (Asynchronous): Continues to subsequent nodes even if an intermediate node encounters an issue.
        """
        mode = (execution_mode or getattr(workflow.settings, "execution_mode", "syn") or "syn").lower()
        if mode not in ["syn", "asyn"]:
            mode = "syn"

        execution = WorkflowExecution(
            tenant_id=tenant_id,
            user_id=user_id,
            workflow_id=workflow.id,
            workflow_name=workflow.name,
            job_poster_id=job_poster_id,
            status="running",
            context_data=initial_context or {}
        )
        await execution.insert()

        async def log_step(msg: str, level: str = "info", node_id: Optional[str] = None, data: Optional[dict] = None):
            entry = ExecutionLogEntry(
                timestamp=datetime.now(timezone.utc),
                node_id=node_id,
                level=level,
                message=msg,
                data=data
            )
            execution.logs.append(entry)
            await execution.save()
            log.info("workflow_exec_step", wf=workflow.name, level=level, msg=msg)

        try:
            mode_desc = "Synchronous (syn: halts immediately on failure)" if mode == "syn" else "Asynchronous (asyn: continues on failure)"
            await log_step(f"Started execution of workflow '{workflow.name}' in {mode_desc} mode", level="info")

            # Load job poster if provided
            poster: Optional[JobPoster] = None
            if job_poster_id:
                poster = await JobPoster.get(job_poster_id)
                if poster:
                    execution.context_data["job_poster"] = {
                        "id": poster.id,
                        "filename": poster.filename,
                        "file_url": poster.file_url,
                        "extracted": poster.extracted_data.model_dump() if poster.extracted_data else None
                    }

            current_node = cls._find_start_node(workflow)
            visited = set()

            while current_node and current_node.id not in visited:
                visited.add(current_node.id)
                execution.current_node_id = current_node.id
                node_type = (current_node.type or "").strip()
                node_data = current_node.data or {}
                node_label = node_data.get("label", node_type)

                await log_step(
                    f"Executing node [{current_node.id}]: {node_label}",
                    level="info",
                    node_id=current_node.id
                )

                try:
                    # --- Node Type 1: Trigger Nodes ---
                    if "trigger" in node_type.lower() or node_type in ["JOB_IMAGE_UPLOADED", "MANUAL_TRIGGER"]:
                        await log_step("Trigger received job poster input", level="success", node_id=current_node.id)

                    # --- Node Type 2: AI Job Poster Analysis ---
                    elif node_type in ["analyzeJob", "ANALYZE_JOB_POSTER", "EXTRACT_JOB_INFO"]:
                        if not poster:
                            raise AppError("No job poster provided for analysis node", status_code=400)

                        if not poster.extracted_data:
                            await log_step("Running AI Vision OCR on uploaded poster...", level="info", node_id=current_node.id)
                            # Read file bytes from local storage or remote
                            file_bytes = b""
                            if poster.attachment_id:
                                from app.services.storage_service import StorageService
                                att = await StorageService.get_attachment_data(tenant_id, poster.attachment_id)
                                if att:
                                    _, _, file_bytes = att
                            elif poster.file_url:
                                import httpx
                                async with httpx.AsyncClient(timeout=30.0) as client:
                                    r = await client.get(poster.file_url)
                                    file_bytes = r.content

                            if not file_bytes:
                                raise AppError("Could not retrieve file bytes for poster", status_code=400)

                            extracted = await JobPosterAnalyzer.analyze(file_bytes, poster.content_type)
                            poster.extracted_data = extracted
                            poster.generated_jd = JobPosterAnalyzer.generate_structured_jd(extracted)
                            poster.status = "extracted"
                            await poster.save()

                        execution.context_data["extracted_data"] = poster.extracted_data.model_dump()
                        execution.context_data["generated_jd"] = poster.generated_jd
                        await log_step(
                            f"Extracted: Role='{poster.extracted_data.job_title}', Company='{poster.extracted_data.company_name}', HR='{poster.extracted_data.hr_email}'",
                            level="success",
                            node_id=current_node.id,
                            data=poster.extracted_data.model_dump()
                        )

                    # --- Node Type 3: Generate Job Description ---
                    elif node_type in ["generateJd", "GENERATE_JOB_DESCRIPTION"]:
                        extracted_dict = execution.context_data.get("extracted_data")
                        if extracted_dict:
                            extracted = ExtractedJobDetails(**extracted_dict)
                            jd = JobPosterAnalyzer.generate_structured_jd(extracted)
                            execution.context_data["generated_jd"] = jd
                            if poster:
                                poster.generated_jd = jd
                                await poster.save()
                            await log_step("Structured Job Description generated successfully", level="success", node_id=current_node.id)
                        else:
                            raise AppError("Job details not extracted yet. Run Vision OCR first.", status_code=400)

                    # --- Node Type 4: Resume Matching ---
                    elif node_type in ["matchResume", "MATCH_RESUME", "SELECT_BEST_RESUME"]:
                        extracted_dict = execution.context_data.get("extracted_data")
                        if not extracted_dict:
                            raise AppError("Job details must be extracted before matching resumes", status_code=400)

                        extracted = ExtractedJobDetails(**extracted_dict)
                        resumes = await RoleResume.find(RoleResume.tenant_id == tenant_id).to_list()
                        if not resumes:
                            raise AppError("No saved role resumes found in Resume Builder. Please upload a resume first.", status_code=400)

                        matched = await ResumeMatcher.match_resumes_for_job(tenant_id, extracted, resumes)
                        best_match = matched[0] if matched else None
                        if best_match:
                            execution.context_data["best_resume"] = best_match.model_dump()
                            execution.context_data["match_score"] = best_match.match_percentage
                            await log_step(
                                f"Matched Best Resume: '{best_match.role_name}' with score {best_match.match_percentage}%",
                                level="success",
                                node_id=current_node.id,
                                data={"match_percentage": best_match.match_percentage, "skills": best_match.matching_skills}
                            )
                        else:
                            raise AppError("No matching resume met the criteria", status_code=400)

                    # --- Node Type 5: Conditions & Safety Filters ---
                    elif "condition" in node_type.lower() or node_type in ["CHECK_MATCH_SCORE", "HR_EMAIL_EXISTS", "CHECK_DUPLICATE"]:
                        extracted_dict = execution.context_data.get("extracted_data", {})
                        hr_email = extracted_dict.get("hr_email")
                        match_score = execution.context_data.get("match_score", 0)

                        # Check 1: Missing HR Email (Always required to send an application)
                        if not hr_email:
                            raise AppError("HR email is missing from job poster", status_code=400)

                        # Check 2: Duplicate application check
                        existing_app = await Application.find_one(
                            Application.tenant_id == tenant_id,
                            Application.hr_email == hr_email
                        )
                        if existing_app:
                            raise AppError(f"Application to {hr_email} already exists ({existing_app.company}). Flagged as duplicate.", status_code=400)

                        await log_step(f"Safety check passed (Recipient: {hr_email}, Resume Match: {match_score}%)", level="success", node_id=current_node.id)

                    # --- Node Type 6: AI / Template Email Generation ---
                    elif node_type in ["generateEmail", "GENERATE_EMAIL", "emailTemplate", "EMAIL_TEMPLATE"]:
                        extracted_dict = execution.context_data.get("extracted_data", {})
                        best_resume_dict = execution.context_data.get("best_resume", {})
                        preferred_template_id = node_data.get("template_id") or node_data.get("selectedTemplateId")
                        tone = node_data.get("tone", "formal")

                        title = extracted_dict.get("job_title", "the open position")
                        company = extracted_dict.get("company_name", "your team")
                        hr_name = extracted_dict.get("hr_name")
                        hr_email = extracted_dict.get("hr_email")
                        skills = best_resume_dict.get("matching_skills") or extracted_dict.get("required_skills") or []
                        match_score = execution.context_data.get("match_score")

                        composed = await TemplateMatcher.compose_email(
                            tenant_id=tenant_id,
                            job_title=title,
                            company_name=company,
                            hr_name=hr_name,
                            hr_email=hr_email,
                            matching_skills=skills,
                            match_score=match_score,
                            tone=tone,
                            preferred_template_id=preferred_template_id
                        )

                        if not composed or not composed.get("body_html"):
                            raise AppError("Email generation returned empty email body", status_code=500)

                        execution.context_data["email_draft"] = {
                            "to": composed.get("to_email") or hr_email,
                            "subject": composed.get("subject"),
                            "body": composed.get("body_html"),
                            "template_matched": composed.get("template_matched", False),
                            "template_name": composed.get("template_name")
                        }

                        if composed.get("template_matched"):
                            await log_step(
                                f"Matched saved role template '{composed.get('template_name')}' for role '{title}'. Dynamic variables replaced.",
                                level="success",
                                node_id=current_node.id,
                                data={"template": composed.get("template_name"), "subject": composed.get("subject")}
                            )
                        else:
                            await log_step(
                                f"No saved template matched for role '{title}'. Generated personalized cold email via AI.",
                                level="info",
                                node_id=current_node.id,
                                data={"tone": tone, "subject": composed.get("subject")}
                            )

                    # --- Node Type 7: Send Gmail / Save Draft ---
                    elif node_type in ["sendGmail", "SEND_GMAIL", "SAVE_GMAIL_DRAFT"]:
                        email_draft = execution.context_data.get("email_draft")
                        best_resume_dict = execution.context_data.get("best_resume", {})

                        if not email_draft or not email_draft.get("to") or not email_draft.get("body"):
                            raise AppError("Missing recipient or email body for Gmail dispatch", status_code=400)

                        if not is_test_run and workflow.settings.auto_send:
                            # Real Gmail dispatch
                            att_ids = []
                            if best_resume_dict.get("attachment_id"):
                                att_ids.append(best_resume_dict["attachment_id"])

                            msg = await SendingService.enqueue_email_send(
                                tenant_id=tenant_id,
                                user_id=user_id,
                                to_address_str=email_draft["to"],
                                subject=email_draft["subject"],
                                body_html=email_draft["body"],
                                attachment_ids=att_ids
                            )
                            execution.context_data["sent_message_id"] = msg.id
                            execution.context_data["sent_thread_id"] = msg.thread_id
                            await log_step(f"Email sent via Gmail API (Message ID: {msg.id})", level="success", node_id=current_node.id)
                        else:
                            await log_step(
                                f"[Simulation/Draft] Prepared email to {email_draft['to']} (Auto-send={'ON' if workflow.settings.auto_send else 'OFF'})",
                                level="info",
                                node_id=current_node.id
                            )

                    # --- Node Type 8: Save & Track Application ---
                    elif node_type in ["saveApplication", "SAVE_APPLICATION", "TRACK_APPLICATION"]:
                        extracted_dict = execution.context_data.get("extracted_data", {})
                        email_draft = execution.context_data.get("email_draft", {})
                        best_resume_dict = execution.context_data.get("best_resume", {})

                        app_status = "Applied" if (workflow.settings.auto_send and not is_test_run) else "Ready to Apply"
                        app_record = Application(
                            tenant_id=tenant_id,
                            title=extracted_dict.get("job_title") or "Open Role",
                            company=extracted_dict.get("company_name") or "Hiring Company",
                            location=extracted_dict.get("location"),
                            salary_range=extracted_dict.get("salary_range"),
                            hr_email=extracted_dict.get("hr_email"),
                            status=app_status,
                            match_score=execution.context_data.get("match_score"),
                            selected_resume_id=best_resume_dict.get("resume_id"),
                            job_poster_id=job_poster_id,
                            job_poster_url=poster.file_url if poster else None,
                            extracted_data=extracted_dict,
                            generated_jd=execution.context_data.get("generated_jd", ""),
                            workflow_execution_id=execution.id,
                            email_subject=email_draft.get("subject"),
                            email_body=email_draft.get("body"),
                            gmail_message_id=execution.context_data.get("sent_message_id"),
                            gmail_thread_id=execution.context_data.get("sent_thread_id"),
                            timeline=[
                                {
                                    "at": datetime.now(timezone.utc).isoformat(),
                                    "label": f"Workflow '{workflow.name}' created application ({app_status})"
                                }
                            ]
                        )
                        await app_record.insert()
                        execution.application_id = app_record.id
                        if poster:
                            poster.application_id = app_record.id
                            poster.status = "applied"
                            await poster.save()

                        await log_step(f"Tracked application saved: ID={app_record.id}, Status={app_status}", level="success", node_id=current_node.id)

                except Exception as node_err:
                    err_msg = str(node_err)
                    log.error("workflow_node_failed", node=current_node.id, label=node_label, err=err_msg, mode=mode)
                    if mode == "syn":
                        await log_step(
                            f"⛔ Node [{node_label}] failed: {err_msg}. Pipeline STOPPED because Synchronous (syn) mode is active. Next nodes will NOT run.",
                            level="error",
                            node_id=current_node.id,
                            data={"error": err_msg, "execution_mode": "syn"}
                        )
                        execution.status = "failed"
                        execution.error_message = f"Node [{node_label}] failed in syn mode: {err_msg}"
                        execution.finished_at = datetime.now(timezone.utc)
                        await execution.save()
                        return execution
                    else:
                        await log_step(
                            f"⚠️ Node [{node_label}] failed: {err_msg}. CONTINUING to next node because Asynchronous (asyn) mode is active.",
                            level="warning",
                            node_id=current_node.id,
                            data={"error": err_msg, "execution_mode": "asyn"}
                        )

                # Find next node via outgoing edges
                outgoing = cls._find_outgoing_edges(workflow, current_node.id)
                current_node = None
                for edge in outgoing:
                    next_node = next((n for n in workflow.nodes if n.id == edge.target), None)
                    if next_node and next_node.id not in visited:
                        current_node = next_node
                        break

            # Completed successfully
            execution.status = "completed"
            execution.finished_at = datetime.now(timezone.utc)
            await log_step("Workflow execution completed successfully", level="success")
            await execution.save()
            return execution

        except Exception as e:
            execution.status = "failed"
            execution.error_message = str(e)
            execution.finished_at = datetime.now(timezone.utc)
            await log_step(f"Workflow execution failed: {str(e)}", level="error")
            await execution.save()
            return execution
