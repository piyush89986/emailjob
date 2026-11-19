"""Tests for HR Classifier and HR Inbox functionality."""
import pytest
from app.models.hr_inbox import (
    CATEGORY_APPLICATION_CONFIRMATION,
    CATEGORY_ASSESSMENT,
    CATEGORY_HR_RECRUITER,
    CATEGORY_INTERVIEW_INVITATION,
    CATEGORY_OFFER_RECEIVED,
    CATEGORY_REJECTION,
    RELEVANT_HR_CATEGORIES,
)
from app.services.ai.hr_classifier import HRClassifierService, clean_text_preview


def test_clean_text_preview():
    raw_html = "<html><head><style>body { color: red; }</style></head><body><p>Hello <b>World</b>!</p><script>alert(1);</script></body></html>"
    preview = clean_text_preview(raw_html)
    assert "body { color: red; }" not in preview
    assert "alert(1)" not in preview
    assert "Hello World!" in preview


def test_heuristic_interview_invitation():
    res = HRClassifierService._heuristic_classification(
        sender_name="Sarah Miller",
        sender_email="sarah.m@uber.com",
        subject="Invitation to Interview - Full Stack Engineer",
        body_preview="We would like to schedule a virtual interview with you via calendly.com/sarah/interview",
        app_context_str="Candidate applied for Full Stack Engineer at Uber"
    )
    assert res is not None
    assert res.category == CATEGORY_INTERVIEW_INVITATION
    assert res.category in RELEVANT_HR_CATEGORIES


def test_heuristic_rejection():
    res = HRClassifierService._heuristic_classification(
        sender_name="Stripe Recruiting",
        sender_email="recruiting@stripe.com",
        subject="Your application to Stripe",
        body_preview="Thank you for your interest. Unfortunately, we have decided to move forward with other candidates at this time.",
        app_context_str=""
    )
    assert res is not None
    assert res.category == CATEGORY_REJECTION


def test_heuristic_assessment():
    res = HRClassifierService._heuristic_classification(
        sender_name="Amazon Jobs",
        sender_email="no-reply@amazon.jobs",
        subject="Online Assessment for Software Development Engineer",
        body_preview="Please complete your coding challenge at hackerrank.com/amazon-assessment within 48 hours.",
        app_context_str=""
    )
    assert res is not None
    assert res.category == CATEGORY_ASSESSMENT


def test_heuristic_offer():
    res = HRClassifierService._heuristic_classification(
        sender_name="Google People Ops",
        sender_email="hr@google.com",
        subject="Offer of Employment - Senior Software Engineer",
        body_preview="We are pleased to offer you the position. Please review the attached formal offer letter and compensation details.",
        app_context_str=""
    )
    assert res is not None
    assert res.category == CATEGORY_OFFER_RECEIVED
