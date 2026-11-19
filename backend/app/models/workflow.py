"""Automation workflow models storing visual DAG definitions, nodes, edges, and executions."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import BaseModel, Field


class WorkflowNode(BaseModel):
    id: str
    type: str  # e.g. "trigger", "analyzeJob", "generateJd", "matchResume", "condition", "sendEmail", "saveApp"
    position: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    data: Dict[str, Any] = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    label: Optional[str] = None


class WorkflowSettings(BaseModel):
    min_match_score: int = 70
    auto_send: bool = False
    fallback_to_manual: bool = True
    delay_between_steps_sec: int = 1
    max_daily_apps: int = 25
    follow_up_days: int = 5
    max_follow_ups: int = 2
    execution_mode: str = "syn"  # "syn" (halt on node failure) | "asyn" (continue on failure)


class AutomationWorkflow(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    user_id: str
    name: str = "Job Application Automation"
    description: str = "Automated pipeline: Poster -> Vision OCR -> Match Resume -> Draft Email -> Send -> Track"
    is_active: bool = False
    trigger_type: str = "JOB_IMAGE_UPLOADED"  # "JOB_IMAGE_UPLOADED" | "MANUAL" | "SCHEDULED"
    nodes: List[WorkflowNode] = Field(default_factory=list)
    edges: List[WorkflowEdge] = Field(default_factory=list)
    settings: WorkflowSettings = Field(default_factory=WorkflowSettings)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "automation_workflows"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("is_active", ASCENDING)]),
        ]


class ExecutionLogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    node_id: Optional[str] = None
    node_name: Optional[str] = None
    level: str = "info"  # "info" | "warning" | "error" | "success"
    message: str
    data: Optional[Dict[str, Any]] = None


class WorkflowExecution(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    user_id: str
    workflow_id: str
    workflow_name: str = ""
    job_poster_id: Optional[str] = None
    application_id: Optional[str] = None
    status: str = "running"  # "running" | "completed" | "failed" | "manual_review" | "cancelled"
    current_node_id: Optional[str] = None
    context_data: Dict[str, Any] = Field(default_factory=dict)
    logs: List[ExecutionLogEntry] = Field(default_factory=list)
    error_message: Optional[str] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None

    class Settings:
        name = "workflow_executions"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("workflow_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("status", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("started_at", ASCENDING)]),
        ]
