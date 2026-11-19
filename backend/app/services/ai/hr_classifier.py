"""AI & Heuristic Classifier for HR, recruiter, and job-application communications.

Categorizes incoming emails into 12 distinct classes:
- HR_RECRUITER
- INTERVIEW_INVITATION
- APPLICATION_CONFIRMATION
- ASSESSMENT
- REJECTION
- OFFER_RECEIVED
- JOB_ALERT
- MARKETING
- NEWSLETTER
- SPAM
- PERSONAL
- OTHER

Saves relevant communications into HRInbox with tenant and user isolation.
"""
from datetime import datetime, timezone
import html
import re
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.events import publish_event
from app.core.logging import get_logger
from app.models.account import EmailAccount
from app.models.application import Application
from app.models.hr_inbox import (
    ALL_CATEGORIES,
    CATEGORY_APPLICATION_CONFIRMATION,
    CATEGORY_ASSESSMENT,
    CATEGORY_HR_RECRUITER,
    CATEGORY_INTERVIEW_INVITATION,
    CATEGORY_JOB_ALERT,
    CATEGORY_MARKETING,
    CATEGORY_NEWSLETTER,
    CATEGORY_OFFER_RECEIVED,
    CATEGORY_OTHER,
    CATEGORY_PERSONAL,
    CATEGORY_REJECTION,
    CATEGORY_SPAM,
    HRInbox,
    RELEVANT_HR_CATEGORIES,
)
from app.models.message import Message
from app.services.ai.llm_router import LLMRouter

log = get_logger("hr_classifier")
settings = get_settings()


class ClassificationResult(BaseModel):
    category: str = Field(..., description="One of the 12 classification categories")
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0")
    company: Optional[str] = Field(None, description="Identified hiring company name, if applicable")
    job_title: Optional[str] = Field(None, description="Identified job title/role, if applicable")
    reasoning: str = Field(..., description="Brief rationale for the classification")


def clean_text_preview(html_or_text: str, max_chars: int = 300) -> str:
    """Strips HTML tags, styles, scripts, and extra whitespace to form a clean preview snippet."""
    if not html_or_text:
        return ""
    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", " ", html_or_text, flags=re.IGNORECASE)
    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([!?,.:;])", r"\1", text)
    return text[:max_chars]


class HRClassifierService:
    @classmethod
    async def process_inbound_email(
        cls,
        account: EmailAccount,
        item: Dict[str, Any],
        message: Optional[Message] = None
    ) -> Optional[HRInbox]:
        """Classifies incoming email, saves to HRInbox, and publishes SSE events.

        Preserves original emails and enforces unique constraint on (user_id, gmail_message_id).
        """
        user_id = account.user_id
        tenant_id = account.tenant_id
        p_mid = item.get("provider_message_id") or (message.provider_message_id if message else "")
        if not p_mid:
            return None

        # 1. Deduplication check (Requirement 6 & 14)
        existing = await HRInbox.find_one(
            HRInbox.user_id == user_id,
            HRInbox.gmail_message_id == p_mid
        )
        if existing:
            log.info("hr_inbox_email_already_exists", mid=p_mid, user_id=user_id)
            return existing

        sender_raw = item.get("from", "")
        # Extract name and clean address: "Jane Doe <jane@company.com>"
        sender_name = ""
        sender_email = sender_raw.strip()
        if "<" in sender_raw and ">" in sender_raw:
            parts = sender_raw.split("<")
            sender_name = parts[0].strip().strip('"').strip("'")
            sender_email = parts[1].split(">")[0].strip()
        elif "@" in sender_raw:
            sender_email = sender_raw.strip()

        to_addrs = item.get("to", [])
        to_email = to_addrs[0] if to_addrs else ""
        subject = item.get("subject", "No subject")
        body_html = item.get("body", "")
        body_preview = clean_text_preview(body_html, 400)
        p_tid = item.get("provider_thread_id")
        label_ids = item.get("label_ids", [])
        raw_headers = item.get("headers_map", {})

        # 2. Context Matching with existing Application Tracker
        matched_app, app_context_str = await cls._find_application_context(
            tenant_id=tenant_id,
            sender_email=sender_email,
            subject=subject,
            p_tid=p_tid,
            body_preview=body_preview
        )

        # 3. Classify (Gmail Pre-filter -> Deterministic NLP -> AI via LLMRouter)
        classification = await cls.classify_email(
            tenant_id=tenant_id,
            sender_name=sender_name,
            sender_email=sender_email,
            subject=subject,
            body_preview=body_preview,
            label_ids=label_ids,
            app_context_str=app_context_str
        )

        is_relevant = classification.category in RELEVANT_HR_CATEGORIES
        needs_review = classification.confidence < 0.70 or classification.category == CATEGORY_OTHER

        # 4. Save to HRInbox collection
        hr_record = HRInbox(
            tenant_id=tenant_id,
            user_id=user_id,
            gmail_message_id=p_mid,
            gmail_thread_id=p_tid,
            email_account_id=account.id,
            sender_name=sender_name or sender_email.split("@")[0],
            sender_email=sender_email,
            to_email=to_email,
            subject=subject,
            body_preview=body_preview,
            body_html=body_html,
            received_at=datetime.now(timezone.utc),
            category=classification.category,
            confidence_score=classification.confidence,
            is_relevant=is_relevant,
            needs_manual_review=needs_review,
            classification_reasoning=classification.reasoning,
            company=classification.company or (matched_app.company if matched_app else None),
            job_title=classification.job_title or (matched_app.title if matched_app else None),
            application_id=matched_app.id if matched_app else None,
            is_read=False,
            is_archived=False,
            labels=label_ids,
            raw_headers=raw_headers
        )

        try:
            await hr_record.insert()
            log.info(
                "hr_inbox_record_created",
                id=hr_record.id,
                category=hr_record.category,
                is_relevant=is_relevant,
                needs_review=needs_review,
                sender=sender_email
            )
        except Exception as e:
            # Handle duplicate key race condition gracefully
            if "duplicate" in str(e).lower() or "11000" in str(e):
                log.info("hr_inbox_duplicate_ignored", mid=p_mid)
                return await HRInbox.find_one(HRInbox.user_id == user_id, HRInbox.gmail_message_id == p_mid)
            raise e

        # 5. Emit Real-time SSE Events if relevant or in review queue (Requirement 11)
        if is_relevant or needs_review:
            await publish_event(tenant_id, "hr_inbox.new", {
                "id": hr_record.id,
                "sender": hr_record.sender_name or hr_record.sender_email,
                "senderEmail": hr_record.sender_email,
                "company": hr_record.company,
                "subject": hr_record.subject,
                "category": hr_record.category,
                "confidence": hr_record.confidence_score,
                "needsReview": hr_record.needs_manual_review,
                "receivedAt": hr_record.received_at.isoformat()
            })

            # Publish updated unread count for HR emails
            unread_hr = await HRInbox.find(
                HRInbox.tenant_id == tenant_id,
                HRInbox.is_relevant == True,
                HRInbox.is_read == False
            ).count()
            await publish_event(tenant_id, "hr_inbox.unread_count", {"count": unread_hr})

        return hr_record

    @classmethod
    async def _find_application_context(
        cls,
        tenant_id: str,
        sender_email: str,
        subject: str,
        p_tid: Optional[str],
        body_preview: str
    ) -> Tuple[Optional[Application], str]:
        """Resolves whether this email corresponds to an existing user application."""
        clean_email = sender_email.lower().strip()
        matched: Optional[Application] = None

        # 1. Match by exact HR email
        if clean_email:
            matched = await Application.find_one(
                Application.tenant_id == tenant_id,
                Application.hr_email == clean_email
            )

        # 2. Match by Gmail Thread ID
        if not matched and p_tid:
            matched = await Application.find_one(
                Application.tenant_id == tenant_id,
                Application.gmail_thread_id == p_tid
            )

        # 3. Match by Company Name mentioned in subject
        if not matched:
            apps = await Application.find(Application.tenant_id == tenant_id).to_list()
            s_lower = subject.lower()
            b_lower = body_preview.lower()
            for app in apps:
                c_name = (app.company or "").lower().strip()
                if c_name and len(c_name) > 2 and (c_name in s_lower or c_name in b_lower):
                    matched = app
                    break

        if matched:
            ctx = f"Candidate applied for '{matched.title}' at '{matched.company}'. Recruiter email in record: {matched.hr_email or 'None'}."
            return matched, ctx

        return None, "No previous application record matched."

    @classmethod
    async def classify_email(
        cls,
        tenant_id: str,
        sender_name: str,
        sender_email: str,
        subject: str,
        body_preview: str,
        label_ids: List[str],
        app_context_str: str
    ) -> ClassificationResult:
        """Classifies the email using Gmail label pre-filtering, AI inference, and NLP rules."""
        s_email_lower = sender_email.lower()
        sub_lower = subject.lower()
        body_lower = body_preview.lower()

        # Step A: Gmail Label Pre-filtering (Requirement 2)
        # Exclude promotional, social, and forum emails early
        if "CATEGORY_PROMOTIONS" in label_ids:
            # Check if it might be a job alert (e.g. LinkedIn / Indeed / Glassdoor)
            if any(term in s_email_lower or term in sub_lower for term in ["indeed", "linkedin", "naukri", "jobalert", "glassdoor", "instahyre"]):
                return ClassificationResult(
                    category=CATEGORY_JOB_ALERT,
                    confidence=0.95,
                    reasoning="Gmail promotional label with job board alert keywords"
                )
            return ClassificationResult(
                category=CATEGORY_MARKETING,
                confidence=0.95,
                reasoning="Gmail categorized as promotional email"
            )

        if "CATEGORY_SOCIAL" in label_ids:
            return ClassificationResult(
                category=CATEGORY_PERSONAL,
                confidence=0.90,
                reasoning="Gmail categorized as social network notification"
            )

        if "CATEGORY_FORUMS" in label_ids:
            return ClassificationResult(
                category=CATEGORY_NEWSLETTER,
                confidence=0.90,
                reasoning="Gmail categorized as forum / community digest"
            )

        # Step B: Fast-Path Rule Checks for high-confidence job signals
        fast_result = cls._heuristic_classification(sender_name, sender_email, subject, body_preview, app_context_str)
        if fast_result and fast_result.confidence >= 0.92:
            return fast_result

        # Step C: AI Classification via LLMRouter
        try:
            prompt = f"""You are an expert AI Email Classifier for a Job Application SaaS.
Classify the following incoming email into EXACTLY ONE of these 12 categories:
- HR_RECRUITER: Direct communication from an HR specialist, recruiter, talent team, or hiring manager regarding a candidate or job inquiry.
- INTERVIEW_INVITATION: Invitation or scheduling for a phone screen, technical round, video call, Calendly link, or face-to-face interview.
- APPLICATION_CONFIRMATION: Automated or personal acknowledgment confirming a submitted application ("Thank you for applying", "Application received").
- ASSESSMENT: Technical coding test, HackerRank/Codility link, take-home challenge, or candidate questionnaire.
- REJECTION: Notification that the application was not selected or the candidate will not move forward.
- OFFER_RECEIVED: Formal or informal job offer, compensation proposal, or offer letter.
- JOB_ALERT: Automated multi-job postings or newsletter alerts (LinkedIn Jobs, Indeed alerts).
- MARKETING: Product promotions, sales pitches, webinars, commercial services.
- NEWSLETTER: Tech blogs, weekly digests, industry articles.
- SPAM: Unsolicited scams, phishing, spam.
- PERSONAL: Personal correspondence, bank alerts, receipts.
- OTHER: None of the above.

EMAIL DETAILS:
Sender Name: {sender_name or 'Unknown'}
Sender Email: {sender_email}
Subject: {subject}
Body Preview: {body_preview}
Application Context: {app_context_str}

Respond with the exact category, your confidence (0.0 to 1.0), the company name if detected, the job title if detected, and a short reasoning."""

            ai_res = await LLMRouter.generate_with_fallback(
                tenant_id=tenant_id,
                prompt=prompt,
                response_schema=ClassificationResult,
                system_instruction="You classify emails with high precision. Ensure category is strictly one of the 12 specified.",
                max_tokens=400,
                temperature=0.1
            )

            if ai_res.category in ALL_CATEGORIES:
                return ai_res
        except Exception as e:
            log.warning("ai_classification_fallback_to_heuristic", error=str(e))

        # Step D: Deterministic Heuristic Fallback if AI fails or returns invalid class
        if fast_result:
            return fast_result

        return ClassificationResult(
            category=CATEGORY_OTHER,
            confidence=0.50,
            reasoning="Default classification; routed to manual review queue."
        )

    @classmethod
    def _heuristic_classification(
        cls,
        sender_name: str,
        sender_email: str,
        subject: str,
        body_preview: str,
        app_context_str: str
    ) -> Optional[ClassificationResult]:
        """Deterministic NLP pattern matching for clear recruitment & job signals."""
        s_email = sender_email.lower()
        sub = subject.lower()
        body = body_preview.lower()
        combined = f"{sub} {body}"

        # 1. Job Offer Received
        if any(term in combined for term in [
            "offer letter", "offer of employment", "pleased to offer you",
            "formal offer", "job offer from", "congratulations on your offer",
            "employment agreement", "compensation details"
        ]):
            return ClassificationResult(
                category=CATEGORY_OFFER_RECEIVED,
                confidence=0.96,
                reasoning="Email text explicitly discusses job offer and employment terms"
            )

        # 2. Interview Invitation
        interview_terms = [
            "interview invitation", "invitation to interview", "schedule an interview",
            "schedule a call", "phone screen", "technical interview", "virtual interview",
            "calendly.com", "round 1 interview", "final round interview", "google meet",
            "zoom.us/j/", "teams.microsoft.com", "next round of interview"
        ]
        if any(term in combined for term in interview_terms):
            return ClassificationResult(
                category=CATEGORY_INTERVIEW_INVITATION,
                confidence=0.95,
                reasoning="Email contains interview scheduling language or meeting links"
            )

        # 3. Assessment / Coding Challenge
        assessment_terms = [
            "hackerrank.com", "codility.com", "codesignal.com", "take-home assignment",
            "coding challenge", "online assessment", "technical assessment",
            "complete the test", "assessment link", "coding test"
        ]
        if any(term in combined for term in assessment_terms):
            return ClassificationResult(
                category=CATEGORY_ASSESSMENT,
                confidence=0.95,
                reasoning="Email contains test or coding assessment links/keywords"
            )

        # 4. Rejection
        rejection_terms = [
            "move forward with other candidates", "pursuing other candidates",
            "not moving forward with your application", "decided to move forward with others",
            "we regret to inform you", "unfortunately, we will not be proceeding",
            "we have decided not to proceed", "will not be moving forward",
            "unsuccessful on this occasion"
        ]
        if any(term in combined for term in rejection_terms):
            return ClassificationResult(
                category=CATEGORY_REJECTION,
                confidence=0.95,
                reasoning="Email contains standard employment rejection phrases"
            )

        # 5. Application Confirmation
        confirmation_terms = [
            "thank you for applying", "thanks for applying", "application received",
            "we have received your application", "we received your application",
            "application successfully submitted", "your application to", "has been submitted"
        ]
        if any(term in combined for term in confirmation_terms):
            return ClassificationResult(
                category=CATEGORY_APPLICATION_CONFIRMATION,
                confidence=0.94,
                reasoning="Email acknowledges receipt of a job application"
            )

        # 6. Job Alert / Aggregator
        if any(term in s_email for term in ["jobalerts-noreply", "indeed.com", "linkedin.com", "naukri.com", "instahyre"]):
            if "job" in sub or "alert" in sub or "opportunities" in sub:
                return ClassificationResult(
                    category=CATEGORY_JOB_ALERT,
                    confidence=0.93,
                    reasoning="Automated job alert from employment board"
                )

        # 7. Direct Recruiter Outreach / Candidate Context
        if "Candidate applied for" in app_context_str:
            # If user has an active application with this company, strongly weight towards HR Recruiter
            return ClassificationResult(
                category=CATEGORY_HR_RECRUITER,
                confidence=0.88,
                reasoning="Sender matches existing tracked application records"
            )

        recruiter_keywords = [
            "talent acquisition", "recruiter", "hiring manager", "careers",
            "recruiting team", "people team", "talent team", "hr team"
        ]
        if any(k in sender_name.lower() or k in combined for k in recruiter_keywords):
            return ClassificationResult(
                category=CATEGORY_HR_RECRUITER,
                confidence=0.85,
                reasoning="Identified recruiter or talent team communication signals"
            )

        # 8. Unsolicited Marketing / Sales
        if any(k in s_email for k in ["newsletter", "marketing", "promo", "noreply", "billing"]):
            return ClassificationResult(
                category=CATEGORY_MARKETING,
                confidence=0.80,
                reasoning="Automated marketing or billing address"
            )

        return None
