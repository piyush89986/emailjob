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


def get_default_workflow_nodes_and_edges():
    """Default standard AI application pipeline template."""
    nodes = [
        {
            "id": "node-1",
            "type": "trigger",
            "position": {"x": 50, "y": 180},
            "data": {"label": "Job Poster Uploaded", "category": "trigger", "description": "Triggers when image/PDF is uploaded"}
        },
        {
            "id": "node-2",
            "type": "analyzeJob",
            "position": {"x": 300, "y": 180},
            "data": {"label": "AI Vision Extraction", "category": "ai", "description": "Extracts Company, Role, Skills & HR Email"}
        },
        {
            "id": "node-3",
            "type": "generateJd",
            "position": {"x": 550, "y": 180},
            "data": {"label": "Generate Job Description", "category": "ai", "description": "Builds structured Markdown JD"}
        },
        {
            "id": "node-4",
            "type": "matchResume",
            "position": {"x": 800, "y": 180},
            "data": {"label": "Match Best Resume", "category": "resume", "description": "5-Factor Weighted Scoring"}
        },
        {
            "id": "node-5",
            "type": "condition",
            "position": {"x": 1050, "y": 180},
            "data": {"label": "Safety Check", "category": "condition", "threshold": 75, "description": "Score >= 75% & HR Email Exists"}
        },
        {
            "id": "node-6",
            "type": "generateEmail",
            "position": {"x": 1300, "y": 180},
            "data": {"label": "AI Email Drafter", "category": "ai", "description": "Personalized application email"}
        },
        {
            "id": "node-7",
            "type": "sendGmail",
            "position": {"x": 1550, "y": 180},
            "data": {"label": "Send via Gmail", "category": "email", "description": "Sends email with resume attachment"}
        },
        {
            "id": "node-8",
            "type": "saveApplication",
            "position": {"x": 1800, "y": 180},
            "data": {"label": "Track Application", "category": "tracking", "description": "Saves to Application Tracker"}
        }
    ]

    edges = [
        {"id": "e1-2", "source": "node-1", "target": "node-2"},
        {"id": "e2-3", "source": "node-2", "target": "node-3"},
        {"id": "e3-4", "source": "node-3", "target": "node-4"},
        {"id": "e4-5", "source": "node-4", "target": "node-5"},
        {"id": "e5-6", "source": "node-5", "target": "node-6"},
        {"id": "e6-7", "source": "node-6", "target": "node-7"},
        {"id": "e7-8", "source": "node-7", "target": "node-8"},
    ]

    return nodes, edges


@router.get("")
async def list_workflows(user: User = Depends(get_current_user)):
    """List all workflows for the tenant. Seeds default pipeline if empty."""
    workflows = await AutomationWorkflow.find(AutomationWorkflow.tenant_id == user.tenant_id).sort("-created_at").to_list()
    if not workflows:
        nodes_raw, edges_raw = get_default_workflow_nodes_and_edges()
        wf = AutomationWorkflow(
            tenant_id=user.tenant_id,
            user_id=user.id,
            name="Automatic Job Application Pipeline",
            description="End-to-end automation: Upload poster -> Vision OCR -> Match Resume -> Generate Email -> Apply via Gmail -> Track",
            is_active=False,
            trigger_type="JOB_IMAGE_UPLOADED",
            nodes=[WorkflowNode(**n) for n in nodes_raw],
            edges=[WorkflowEdge(**e) for e in edges_raw],
            settings=WorkflowSettings(min_match_score=75, auto_send=False, fallback_to_manual=True)
        )
        await wf.insert()
        workflows = [wf]

    return workflows


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

    execution = await WorkflowEngine.run_workflow(
        tenant_id=user.tenant_id,
        user_id=user.id,
        workflow=wf,
        job_poster_id=req.job_poster_id,
        initial_context=req.context_data,
        is_test_run=req.is_test_run
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
