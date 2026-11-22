"""Automation Workflows API.

Manages visual workflow definitions, DAG execution, testing, and execution history.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.errors import NotFoundError
from app.core.logging import get_logger
from app.models.user import User
from app.models.workflow import (
    AutomationWorkflow,
    WorkflowEdge,
    WorkflowExecution,
    WorkflowNode,
    WorkflowSettings,
)
from app.services.workflow_engine import WorkflowEngine

router = APIRouter(prefix="/workflows", tags=["workflows"])
log = get_logger("workflows_api")


class CreateWorkflowRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    trigger_type: str = "JOB_IMAGE_UPLOADED"
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    edges: List[Dict[str, Any]] = Field(default_factory=list)
    settings: Optional[Dict[str, Any]] = None


class UpdateWorkflowRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    trigger_type: Optional[str] = None
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    settings: Optional[Dict[str, Any]] = None


class ExecuteWorkflowRequest(BaseModel):
    job_poster_id: Optional[str] = None
    is_test_run: bool = False
    context_data: Optional[Dict[str, Any]] = None
    execution_mode: Optional[str] = None  # "syn" | "asyn"


def get_default_workflow_nodes_and_edges():
    """Default standard AI application pipeline template arranged in alternating zigzag layout matching design."""
    nodes = [
        {
            "id": "node-1",
            "type": "trigger",
            "position": {"x": 60, "y": 140},
            "data": {
                "label": "Upload Job Poster / Recruiter Email",
                "category": "trigger",
                "description": "Trigger: Upload poster, email screenshot, ya direct HR email input"
            }
        },
        {
            "id": "node-2",
            "type": "analyzeJob",
            "position": {"x": 420, "y": 380},
            "data": {
                "label": "Extracting Job Description",
                "category": "ai",
                "description": "OCR Vision se Company, Role, Skills aur Recruiter HR Email extract karta hai"
            }
        },
        {
            "id": "node-3",
            "type": "matchResume",
            "position": {"x": 780, "y": 140},
            "data": {
                "label": "Match Best Resume by Role",
                "category": "resume",
                "description": "Job role ke according saved resumes me se best resume match karta hai"
            }
        },
        {
            "id": "node-4",
            "type": "generateEmail",
            "position": {"x": 1140, "y": 380},
            "data": {
                "label": "Email Drafter (Templates + AI)",
                "category": "email",
                "description": "Pehle role template match karega; na milne par ya disable hone par AI personalized email draft karega",
                "use_templates": True,
                "tone": "formal"
            }
        },
        {
            "id": "node-5",
            "type": "sendGmail",
            "position": {"x": 1500, "y": 140},
            "data": {
                "label": "Send via Gmail",
                "category": "email",
                "description": "Matched resume PDF attachment ke sath Gmail API se email dispatch karta hai"
            }
        },
        {
            "id": "node-6",
            "type": "saveApplication",
            "position": {"x": 1860, "y": 380},
            "data": {
                "label": "Track Application & Company Replies",
                "category": "tracking",
                "description": "Logs application & tracks incoming replies from the same HR email or company"
            }
        }
    ]

    edges = [
        {"id": "e1-2", "source": "node-1", "target": "node-2", "type": "smoothstep", "animated": True, "style": {"stroke": "#6366f1", "strokeWidth": 2.5}},
        {"id": "e2-3", "source": "node-2", "target": "node-3", "type": "smoothstep", "animated": True, "style": {"stroke": "#6366f1", "strokeWidth": 2.5}},
        {"id": "e3-4", "source": "node-3", "target": "node-4", "type": "smoothstep", "animated": True, "style": {"stroke": "#6366f1", "strokeWidth": 2.5}},
        {"id": "e4-5", "source": "node-4", "target": "node-5", "type": "smoothstep", "animated": True, "style": {"stroke": "#6366f1", "strokeWidth": 2.5}},
        {"id": "e5-6", "source": "node-5", "target": "node-6", "type": "smoothstep", "animated": True, "style": {"stroke": "#6366f1", "strokeWidth": 2.5}},
    ]

    return nodes, edges


@router.get("")
async def list_workflows(user: User = Depends(get_current_user)):
    """List all workflows for the tenant. Seeds or migrates to clean 6-node default DAG if outdated."""
    workflows = await AutomationWorkflow.find(AutomationWorkflow.tenant_id == user.tenant_id).sort("-created_at").to_list()
    nodes_raw, edges_raw = get_default_workflow_nodes_and_edges()

    if not workflows:
        wf = AutomationWorkflow(
            tenant_id=user.tenant_id,
            user_id=user.id,
            name="Automatic Job Application Pipeline",
            description="End-to-end automation: Upload -> Vision OCR -> Match Resume by Role -> Email Drafter (Templates+AI) -> Send Gmail -> Track Replies",
            is_active=False,
            trigger_type="JOB_IMAGE_UPLOADED",
            nodes=[WorkflowNode(**n) for n in nodes_raw],
            edges=[WorkflowEdge(**e) for e in edges_raw],
            settings=WorkflowSettings(min_match_score=0, auto_send=False, fallback_to_manual=True)
        )
        await wf.insert()
        workflows = [wf]
    else:
        # Auto-upgrade any default workflow still containing obsolete nodes (generateJd or condition)
        for wf in workflows:
            node_types = {n.type for n in wf.nodes}
            if "condition" in node_types or "generateJd" in node_types or len(wf.nodes) > 6:
                wf.nodes = [WorkflowNode(**n) for n in nodes_raw]
                wf.edges = [WorkflowEdge(**e) for e in edges_raw]
                wf.updated_at = datetime.now(timezone.utc)
                await wf.save()

    return workflows


@router.post("/reset-default")
@router.post("/{workflow_id}/reset-default")
async def reset_workflow_to_default(workflow_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Reset a workflow (or tenant's primary workflow) to the default clean 6-node pipeline."""
    wf = None
    if workflow_id:
        wf = await AutomationWorkflow.find_one(AutomationWorkflow.id == workflow_id, AutomationWorkflow.tenant_id == user.tenant_id)
    if not wf:
        wf = await AutomationWorkflow.find_one(AutomationWorkflow.tenant_id == user.tenant_id)

    nodes_raw, edges_raw = get_default_workflow_nodes_and_edges()
    if not wf:
        wf = AutomationWorkflow(
            tenant_id=user.tenant_id,
            user_id=user.id,
            name="Automatic Job Application Pipeline",
            description="End-to-end automation: Upload -> Vision OCR -> Match Resume by Role -> Email Drafter (Templates+AI) -> Send Gmail -> Track Replies",
            is_active=False,
            trigger_type="JOB_IMAGE_UPLOADED",
            nodes=[WorkflowNode(**n) for n in nodes_raw],
            edges=[WorkflowEdge(**e) for e in edges_raw],
            settings=WorkflowSettings(min_match_score=0, auto_send=False, fallback_to_manual=True)
        )
        await wf.insert()
    else:
        wf.nodes = [WorkflowNode(**n) for n in nodes_raw]
        wf.edges = [WorkflowEdge(**e) for e in edges_raw]
        wf.updated_at = datetime.now(timezone.utc)
        await wf.save()

    return wf


@router.post("")
async def create_workflow(req: CreateWorkflowRequest, user: User = Depends(get_current_user)):
    """Create a new automation workflow."""
    wf = AutomationWorkflow(
        tenant_id=user.tenant_id,
        user_id=user.id,
        name=req.name,
        description=req.description or "",
        trigger_type=req.trigger_type,
        nodes=[WorkflowNode(**n) for n in req.nodes],
        edges=[WorkflowEdge(**e) for e in req.edges],
        settings=WorkflowSettings(**req.settings) if req.settings else WorkflowSettings()
    )
    await wf.insert()
    return wf


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str, user: User = Depends(get_current_user)):
    """Get single workflow definition."""
    wf = await AutomationWorkflow.find_one(AutomationWorkflow.id == workflow_id, AutomationWorkflow.tenant_id == user.tenant_id)
    if not wf:
        raise NotFoundError("Workflow not found")
    return wf


@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    req: UpdateWorkflowRequest,
    user: User = Depends(get_current_user)
):
    """Update workflow graph nodes, edges, or settings."""
    wf = await AutomationWorkflow.find_one(AutomationWorkflow.id == workflow_id, AutomationWorkflow.tenant_id == user.tenant_id)
    if not wf:
        raise NotFoundError("Workflow not found")

    if req.name is not None:
        wf.name = req.name
    if req.description is not None:
        wf.description = req.description
    if req.is_active is not None:
        wf.is_active = req.is_active
    if req.trigger_type is not None:
        wf.trigger_type = req.trigger_type
    if req.nodes is not None:
        wf.nodes = [WorkflowNode(**n) for n in req.nodes]
    if req.edges is not None:
        wf.edges = [WorkflowEdge(**e) for e in req.edges]
    if req.settings is not None:
        wf.settings = WorkflowSettings(**req.settings)

    wf.updated_at = datetime.now(timezone.utc)
    await wf.save()
    return wf


@router.post("/{workflow_id}/activate")
async def activate_workflow(workflow_id: str, user: User = Depends(get_current_user)):
    """Activate workflow for automated background triggering."""
    wf = await AutomationWorkflow.find_one(AutomationWorkflow.id == workflow_id, AutomationWorkflow.tenant_id == user.tenant_id)
    if not wf:
        raise NotFoundError("Workflow not found")
    wf.is_active = True
    wf.updated_at = datetime.now(timezone.utc)
    await wf.save()
    return {"success": True, "is_active": True}


@router.post("/{workflow_id}/deactivate")
async def deactivate_workflow(workflow_id: str, user: User = Depends(get_current_user)):
    """Deactivate workflow."""
    wf = await AutomationWorkflow.find_one(AutomationWorkflow.id == workflow_id, AutomationWorkflow.tenant_id == user.tenant_id)
    if not wf:
        raise NotFoundError("Workflow not found")
    wf.is_active = False
    wf.updated_at = datetime.now(timezone.utc)
    await wf.save()
    return {"success": True, "is_active": False}


@router.post("/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    req: ExecuteWorkflowRequest,
    user: User = Depends(get_current_user)
):
    """Execute workflow either live or in simulation/test mode."""
    wf = await AutomationWorkflow.find_one(AutomationWorkflow.id == workflow_id, AutomationWorkflow.tenant_id == user.tenant_id)
    if not wf:
        raise NotFoundError("Workflow not found")

    mode = req.execution_mode or getattr(wf.settings, "execution_mode", "syn") or "syn"

    execution = await WorkflowEngine.run_workflow(
        tenant_id=user.tenant_id,
        user_id=user.id,
        workflow=wf,
        job_poster_id=req.job_poster_id,
        initial_context=req.context_data,
        is_test_run=req.is_test_run,
        execution_mode=mode
    )
    return execution


@router.get("/{workflow_id}/executions")
async def list_workflow_executions(
    workflow_id: str,
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    """List execution history and logs for a workflow."""
    executions = await WorkflowExecution.find(
        WorkflowExecution.tenant_id == user.tenant_id,
        WorkflowExecution.workflow_id == workflow_id
    ).sort("-started_at").limit(limit).to_list()
    return executions


@router.get("/executions/{execution_id}")
async def get_execution_details(execution_id: str, user: User = Depends(get_current_user)):
    """Fetch details and full audit log of a single workflow execution."""
    execution = await WorkflowExecution.find_one(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.tenant_id == user.tenant_id
    )
    if not execution:
        raise NotFoundError("Workflow execution not found")
    return execution
