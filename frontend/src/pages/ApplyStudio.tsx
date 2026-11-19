import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  MarkerType
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Sparkles,
  Upload,
  FileText,
  Send,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Copy,
  Clock,
  Eye,
  Settings,
  Layers,
  Search,
  Filter,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Mail,
  User,
  ShieldCheck,
  Zap,
  Building,
  MapPin,
  DollarSign,
  Briefcase,
  X,
  FileCheck,
  Plus,
  LayoutGrid,
  Sliders,
  Maximize2,
  Pencil,
  Check,
  Terminal,
  ArrowRight,
  XCircle,
  RefreshCw,
  Square
} from "lucide-react";

import {
  useS,
  toast,
  fetchApplyMetrics,
  fetchJobPosters,
  uploadJobPoster,
  analyzeJobPoster,
  generateJdForPoster,
  matchResumesForPoster,
  generateEmailForPoster,
  sendPosterApplication,
  triggerFollowUp,
  fetchWorkflows,
  saveWorkflow,
  toggleWorkflowActive,
  executeWorkflow,
  JobPoster,
  ExtractedJobDetails,
  ResumeMatchScore,
  AutomationWorkflow,
  WorkflowExecution,
  App,
  setApplicationStatus
} from "@/lib/store";

import { Badge, Page, fmt } from "@/components/ui";

// --- Custom React Flow Node Components (Refined Sleek Node Cards) ---

function CustomWorkflowNode({ data, id, selected }: { data: any; id: string; selected?: boolean }) {
  const isTrigger = data.category === "trigger";
  const isCondition = data.category === "condition";
  const isEmail = data.category === "email";
  const isResume = data.category === "resume";
  const isTracking = data.category === "tracking";

  // Category visual accent & icon
  let stripeColor = "bg-indigo-500";
  let iconBoxBg = "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400";
  let icon = <Sparkles size={16} />;
  let categoryLabel = "AI Action";

  if (isTrigger) {
    stripeColor = "bg-emerald-500";
    iconBoxBg = "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400";
    icon = <Upload size={16} />;
    categoryLabel = "Trigger";
  } else if (isCondition) {
    stripeColor = "bg-amber-500";
    iconBoxBg = "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400";
    icon = <ShieldCheck size={16} />;
    categoryLabel = "Condition";
  } else if (isEmail) {
    stripeColor = "bg-sky-500";
    iconBoxBg = "bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400";
    icon = <Mail size={16} />;
    categoryLabel = "Email";
  } else if (isResume) {
    stripeColor = "bg-purple-500";
    iconBoxBg = "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400";
    icon = <FileCheck size={16} />;
    categoryLabel = "Matching";
  } else if (isTracking) {
    stripeColor = "bg-rose-500";
    iconBoxBg = "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400";
    icon = <CheckCircle2 size={16} />;
    categoryLabel = "Tracking";
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("flow-node-delete", { detail: { id } }));
  };

  const handleSelect = () => {
    window.dispatchEvent(new CustomEvent("flow-node-select", { detail: { id } }));
  };

  return (
    <div
      onClick={handleSelect}
      className={`w-72 sm:w-80 rounded-2xl border ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-400 shadow-xl"
          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-lg"
      } bg-white dark:bg-slate-900 overflow-hidden text-xs transition-all hover:shadow-xl cursor-pointer group select-none`}
    >
      {/* Target input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !bg-white !border-2 !border-slate-400 dark:!border-slate-500 shadow-sm transition-transform hover:scale-125 !-left-1.5"
      />

      {/* Top Accent Stripe */}
      <div className={`h-1.5 w-full ${stripeColor}`} />

      {/* Card Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5 truncate">
          <div className={`p-1.5 rounded-lg ${iconBoxBg} shrink-0`}>
            {icon}
          </div>
          <div className="truncate">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
              {data.label || "Step"}
            </h4>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              {categoryLabel}
            </span>
          </div>
        </div>

        {/* Delete step button right on node */}
        <button
          type="button"
          onClick={handleDelete}
          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0"
          title="Delete step from sequence"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-2.5 text-slate-600 dark:text-slate-300">
        <p className="text-[11px] leading-relaxed line-clamp-2 text-slate-500 dark:text-slate-400">
          {data.description || "Processes workflow payload and passes to next step."}
        </p>

        {data.threshold !== undefined && (
          <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
            <span>Pass Threshold</span>
            <span className="font-bold font-mono">≥ {data.threshold}%</span>
          </div>
        )}

        {data.tone && (
          <div className="flex items-center justify-between rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 px-2.5 py-1 text-[11px] font-medium text-sky-800 dark:text-sky-300">
            <span>Tone</span>
            <span className="font-bold uppercase tracking-wider">{data.tone}</span>
          </div>
        )}

        {/* Card Footer inside node */}
        <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
          {isCondition ? (
            <>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                ✓ SUCCESS
              </span>
              <span className="font-bold text-rose-500 dark:text-rose-400">
                ✗ FAILURE
              </span>
            </>
          ) : (
            <>
              <span className="font-mono text-slate-400">ID: {id}</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline">
                Configure →
              </span>
            </>
          )}
        </div>
      </div>

      {/* Source output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !bg-white !border-2 !border-slate-400 dark:!border-slate-500 shadow-sm transition-transform hover:scale-125 !-right-1.5"
      />
    </div>
  );
}

const nodeTypes = {
  trigger: CustomWorkflowNode,
  analyzeJob: CustomWorkflowNode,
  generateJd: CustomWorkflowNode,
  matchResume: CustomWorkflowNode,
  condition: CustomWorkflowNode,
  generateEmail: CustomWorkflowNode,
  sendGmail: CustomWorkflowNode,
  saveApplication: CustomWorkflowNode
};

// Preset catalog for the Add Step slide-over drawer
const WORKFLOW_STEP_PRESETS = [
  {
    id: "ai-vision",
    label: "AI Vision Extraction",
    category: "ai",
    type: "analyzeJob",
    categoryBadge: "AI Engine",
    icon: <Sparkles size={18} />,
    iconBg: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400",
    description: "Extracts Company, Job Title, Skills, and Recruiter HR Email with OCR vision.",
    extra: {
      description: "Extracts Company, Job Title, Skills & Recruiter HR Email with OCR vision.",
      model: "gpt-4o-mini",
    },
  },
  {
    id: "generate-jd",
    label: "Generate Job Description",
    category: "ai",
    type: "generateJd",
    categoryBadge: "AI Engine",
    icon: <FileText size={18} />,
    iconBg: "bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400",
    description: "Builds a structured, complete Markdown Job Description from messy posters.",
    extra: {
      description: "Builds a structured, complete Markdown Job Description from messy posters.",
    },
  },
  {
    id: "match-resume",
    label: "Match Best Resume",
    category: "resume",
    type: "matchResume",
    categoryBadge: "Scoring Engine",
    icon: <FileCheck size={18} />,
    iconBg: "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400",
    description: "Calculates 5-factor weighted fit score against all stored role resumes.",
    extra: {
      description: "Calculates 5-factor weighted fit score against all stored role resumes.",
    },
  },
  {
    id: "condition-gate",
    label: "Safety Gate Check",
    category: "condition",
    type: "condition",
    categoryBadge: "Logic / Filter",
    icon: <ShieldCheck size={18} />,
    iconBg: "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400",
    description: "Branches execution: routes low-scoring applications to manual review.",
    extra: {
      description: "Branch based on match score threshold & verified HR email.",
      threshold: 75,
    },
  },
  {
    id: "ai-email",
    label: "AI Email Drafter",
    category: "email",
    type: "generateEmail",
    categoryBadge: "AI Generator",
    icon: <Mail size={18} />,
    iconBg: "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400",
    description: "Crafts a high-converting, personalized cold application email.",
    extra: {
      description: "Crafts a personalized application email tailored to recruiter requirements.",
      tone: "formal",
      subjectTemplate: "Application for {{jobTitle}} – {{candidateName}}",
    },
  },
  {
    id: "send-gmail",
    label: "Send via Gmail",
    category: "email",
    type: "sendGmail",
    categoryBadge: "Integration",
    icon: <Send size={18} />,
    iconBg: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400",
    description: "Dispatches the email with tailored resume attachment via your connected Gmail.",
    extra: {
      description: "Dispatches email with tailored resume PDF MIME attachment via Gmail API.",
    },
  },
  {
    id: "track-app",
    label: "Track Application",
    category: "tracking",
    type: "saveApplication",
    categoryBadge: "Lifecycle",
    icon: <CheckCircle2 size={18} />,
    iconBg: "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400",
    description: "Logs into SaaS Application Tracker and starts real-time reply monitoring.",
    extra: {
      description: "Logs application into pipeline tracker and monitors incoming replies.",
    },
  },
];

// Pipeline Skills for Live Execution Audit Screen
export interface SkillStatus {
  id: string;
  name: string;
  skillType: string;
  status: "idle" | "running" | "completed" | "warning" | "error";
  message?: string;
  details?: string;
  error?: string;
}

export interface PipelineLog {
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  skill: string;
  text: string;
}

const INITIAL_PIPELINE_SKILLS: SkillStatus[] = [
  {
    id: "skill-vision",
    name: "AI Vision OCR Extraction",
    skillType: "Vision AI (GPT-4o-mini)",
    status: "idle",
    message: "Extracts role, company, recruiter email, and required skills",
  },
  {
    id: "skill-jd",
    name: "Job Description Generator",
    skillType: "Document AI",
    status: "idle",
    message: "Synthesizes structured Markdown JD with responsibilities",
  },
  {
    id: "skill-resume",
    name: "AI Resume Matcher & Scorer",
    skillType: "Scoring Engine",
    status: "idle",
    message: "Calculates 5-factor weighted fit score against saved resumes",
  },
  {
    id: "skill-gate",
    name: "Safety Gate & Email Check",
    skillType: "Filter / Gatekeeper",
    status: "idle",
    message: "Verifies recruiter email presence & match threshold (>= 75%)",
  },
  {
    id: "skill-email",
    name: "Cold Application Email Drafter",
    skillType: "LLM Copywriter",
    status: "idle",
    message: "Crafts personalized application email highlighting matched skills",
  },
  {
    id: "skill-gmail",
    name: "Gmail API Dispatcher",
    skillType: "Gmail Integration",
    status: "idle",
    message: "Sends email with resume MIME attachment directly via Gmail",
  },
  {
    id: "skill-tracker",
    name: "Application Lifecycle Tracker",
    skillType: "SaaS Database",
    status: "idle",
    message: "Logs application and activates real-time reply webhook monitoring",
  },
];

export default function ApplyStudio() {
  const [activeTab, setActiveTab] = useState<"hub" | "builder" | "history">("hub");

  // Metrics & State from Store
  const metrics = useS((s) => s.applyMetrics);
  const posters = useS((s) => s.posters);
  const workflows = useS((s) => s.workflows);
  const apps = useS((s) => s.apps);
  const roleResumes = useS((s) => s.roleResumes);

  // Live Automation Execution & Skills Audit Screen State
  const [showLiveAudit, setShowLiveAudit] = useState(false);
  const [livePipelineStatus, setLivePipelineStatus] = useState<"running" | "completed" | "attention_needed" | "error">("running");
  const [pipelineSkills, setPipelineSkills] = useState<SkillStatus[]>(INITIAL_PIPELINE_SKILLS);
  const [pipelineLogs, setPipelineLogs] = useState<PipelineLog[]>([]);

  // Upload dropzone state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Flow / Review Modal State
  const [activePoster, setActivePoster] = useState<JobPoster | null>(null);
  const [reviewStep, setReviewStep] = useState<1 | 2 | 3 | 4>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1: Extracted Data edits
  const [editDetails, setEditDetails] = useState<ExtractedJobDetails>({
    required_skills: [],
    job_responsibilities: [],
    candidate_requirements: [],
    confidence_score: 0.8,
    requires_manual_verification: false
  });

  // Step 2: JD state
  const [editableJd, setEditableJd] = useState("");

  // Step 3: Resume matches
  const [resumeMatches, setResumeMatches] = useState<ResumeMatchScore[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");

  // Step 4: Email state
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailTone, setEmailTone] = useState<"formal" | "friendly" | "concise">("formal");

  // Application History & Drawer state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<App | null>(null);

  // Visual Workflow State
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AutomationWorkflow | null>(null);
  const [executionLogs, setExecutionLogs] = useState<WorkflowExecution | null>(null);

  // Workflow Mode: manual review vs auto mode (with local storage persistence)
  const [workflowMode, setWorkflowMode] = useState<"manual" | "auto">(() => {
    return (localStorage.getItem("jobmail_workflow_mode") as "manual" | "auto") || "manual";
  });

  // Slide-over Drawers state & Edit form state (Reference UI pattern)
  const [drawerMode, setDrawerMode] = useState<"none" | "add" | "edit">("none");
  const [editFormData, setEditFormData] = useState<{
    label: string;
    description: string;
    threshold?: number;
    tone?: string;
    subjectTemplate?: string;
    model?: string;
  }>({
    label: "",
    description: "",
    threshold: 75,
    tone: "formal",
    subjectTemplate: "Application for {{jobTitle}} – {{candidateName}}",
    model: "gpt-4o-mini",
  });

  // Clean simple white wires with NO arrows
  const edgeOptions = {
    type: "smoothstep",
    animated: false,
    style: {
      stroke: "#ffffff",
      strokeWidth: 2,
    },
  };

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: false,
            style: { stroke: "#ffffff", strokeWidth: 2 },
          },
          eds
        )
      ),
    [setEdges]
  );

  // Load initial workflows and metrics
  useEffect(() => {
    fetchWorkflows();
    fetchApplyMetrics();
    fetchJobPosters();
  }, []);

  // Sync loaded workflow into canvas nodes and edges
  useEffect(() => {
    if (workflows && workflows.length > 0 && !selectedWorkflow) {
      const wf = workflows[0];
      setSelectedWorkflow(wf);
      if (wf.nodes && wf.nodes.length > 0) {
        setNodes(wf.nodes);
      }
      if (wf.edges && wf.edges.length > 0) {
        const mappedEdges = wf.edges.map((e: any) => ({
          ...e,
          type: "smoothstep",
          animated: false,
          style: { stroke: "#ffffff", strokeWidth: 2 },
          markerEnd: undefined,
        }));
        setEdges(mappedEdges);
      }
    }
  }, [workflows, selectedWorkflow, setNodes, setEdges]);

  // Delete node from canvas
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode((curr) => (curr?.id === nodeId ? null : curr));
      toast("Node removed from workflow sequence");
    },
    [setNodes, setEdges]
  );

  // Open Edit drawer for a clicked node
  const handleOpenEditDrawer = useCallback((node: Node) => {
    setSelectedNode(node);
    setEditFormData({
      label: String(node.data?.label || "Workflow Step"),
      description: String(node.data?.description || ""),
      threshold: typeof node.data?.threshold === "number" ? node.data.threshold : 75,
      tone: String(node.data?.tone || "formal"),
      subjectTemplate: String(node.data?.subjectTemplate || "Application for {{jobTitle}} – {{candidateName}}"),
      model: String(node.data?.model || "gpt-4o-mini"),
    });
    setDrawerMode("edit");
  }, []);

  // Commit node edits from slide-over drawer
  const handleUpdateNodeFromDrawer = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          return {
            ...n,
            data: {
              ...n.data,
              label: editFormData.label,
              description: editFormData.description,
              ...(editFormData.threshold !== undefined ? { threshold: editFormData.threshold } : {}),
              ...(editFormData.tone ? { tone: editFormData.tone } : {}),
              ...(editFormData.subjectTemplate ? { subjectTemplate: editFormData.subjectTemplate } : {}),
              ...(editFormData.model ? { model: editFormData.model } : {}),
            },
          };
        }
        return n;
      })
    );
    setDrawerMode("none");
    toast("Node settings updated!");
  };

  // Add step from "Add workflow step" slide-over drawer
  const handleAddNodeFromDrawer = (category: string, label: string, type: string, extraData: any = {}) => {
    const newId = `node-${Date.now()}`;
    const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
    const newPos = lastNode
      ? { x: lastNode.position.x + 360, y: lastNode.position.y }
      : { x: 80, y: 80 };

    const newNode: Node = {
      id: newId,
      type: type || "analyzeJob",
      position: newPos,
      data: {
        label,
        category,
        description: extraData.description || `Configured ${label} action`,
        ...extraData,
      },
    };

    setNodes((nds) => [...nds, newNode]);

    const sourceId = selectedNode ? selectedNode.id : (lastNode ? lastNode.id : null);
    if (sourceId && sourceId !== newId) {
      const newEdge: Edge = {
        id: `e-${sourceId}-${newId}`,
        source: sourceId,
        target: newId,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#ffffff", strokeWidth: 2 },
      };
      setEdges((eds) => [...eds, newEdge]);
    }

    setDrawerMode("none");
    toast(`Added "${label}" to workflow sequence!`);
  };

  // Listen for delete & select events emitted by node cards
  useEffect(() => {
    const onDelete = (e: any) => {
      if (e.detail?.id) {
        handleDeleteNode(e.detail.id);
      }
    };
    const onSelect = (e: any) => {
      if (e.detail?.id) {
        const found = nodes.find((n) => n.id === e.detail.id);
        if (found) {
          handleOpenEditDrawer(found);
        }
      }
    };
    window.addEventListener("flow-node-delete", onDelete);
    window.addEventListener("flow-node-select", onSelect);
    return () => {
      window.removeEventListener("flow-node-delete", onDelete);
      window.removeEventListener("flow-node-select", onSelect);
    };
  }, [nodes, handleDeleteNode, handleOpenEditDrawer]);

  // Auto layout into clean organized 2-row snake layout
  const handleTidyLayout = () => {
    const nodeWidth = 320;
    const gapX = 80;
    const cols = 4;

    setNodes((current) =>
      current.map((n, i) => {
        const row = Math.floor(i / cols);
        const colInRow = i % cols;
        const col = row % 2 === 0 ? colInRow : cols - 1 - colInRow;
        return {
          ...n,
          position: {
            x: 80 + col * (nodeWidth + gapX),
            y: 80 + row * 280,
          },
        };
      })
    );
    toast("Pipeline organized into clean 2-row layout!");
  };

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  // Cancellation ref to immediately halt automation pipeline if user stops it
  const isCancelledRef = useRef<boolean>(false);

  // Stop / Cancel Automation Pipeline
  const handleStopAutomation = () => {
    isCancelledRef.current = true;
    setIsUploading(false);
    setLivePipelineStatus("attention_needed");

    setPipelineSkills((prev) =>
      prev.map((s) =>
        s.status === "running"
          ? {
              ...s,
              status: "warning",
              message: "Execution stopped by user",
              error: "Dikkat: User ne automation beech me stop kar di."
            }
          : s
      )
    );

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setPipelineLogs((prev) => [
      ...prev,
      {
        timestamp: time,
        level: "warning",
        skill: "System",
        text: "⛔ Automation stopped by user. Pipeline execution halted."
      }
    ]);

    toast("Automation stopped by user", "ok");
  };

  // Start Analysis Workflow (Manual Mode vs Auto Mode with Live Skills Audit Screen)
  const handleAnalyzeAndLaunch = async () => {
    if (!selectedFile) return toast("Please select or drop a job poster first", "err");

    // Reset cancellation flag
    isCancelledRef.current = false;

    // Open Live Skills Audit screen immediately
    setShowLiveAudit(true);
    setLivePipelineStatus("running");
    setPipelineSkills(INITIAL_PIPELINE_SKILLS);
    setPipelineLogs([]);

    const log = (level: "info" | "success" | "warning" | "error", skill: string, text: string) => {
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setPipelineLogs((prev) => [...prev, { timestamp: time, level, skill, text }]);
    };

    const updateSkill = (id: string, patch: Partial<SkillStatus>) => {
      setPipelineSkills((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    };

    log("info", "System", `Starting automation pipeline for "${selectedFile.name}" in ${workflowMode === "auto" ? "Automatic Mode" : "Manual Review Mode"}`);
    setIsUploading(true);

    try {
      // --- SKILL 1: AI Vision OCR Extraction ---
      updateSkill("skill-vision", { status: "running", message: "Uploading poster and extracting job details with Vision AI..." });
      log("info", "Vision OCR", `Sending poster (${selectedFile.name}) to AI Vision model...`);

      let poster: JobPoster;
      try {
        poster = await uploadJobPoster(selectedFile, true);
        setActivePoster(poster);
      } catch (uploadErr: any) {
        const errDetail =
          uploadErr.response?.data?.detail ||
          uploadErr.response?.data?.error?.message ||
          uploadErr.response?.data?.error ||
          uploadErr.message ||
          "Upload failed";
        updateSkill("skill-vision", {
          status: "error",
          message: "Upload / AI Vision extraction failed",
          error: `Dikkat: Image upload fail ho gaya (${errDetail})`
        });
        log("error", "Vision OCR", `Dikkat: Poster upload failed: ${errDetail}`);
        setLivePipelineStatus("error");
        setIsUploading(false);
        return;
      }

      if (poster.status === "failed") {
        updateSkill("skill-vision", {
          status: "error",
          message: "AI Vision analysis could not process the poster",
          error: `Dikkat: ${poster.error_message || "Vision extraction failed on backend"}`
        });
        log("error", "Vision OCR", `Dikkat: ${poster.error_message || "Vision extraction failed on backend"}`);
        setLivePipelineStatus("error");
        setIsUploading(false);
        return;
      }

      const extracted = poster.extracted_data || {
        required_skills: [],
        job_responsibilities: [],
        candidate_requirements: [],
        confidence_score: 0.8,
        requires_manual_verification: false
      };
      setEditDetails(extracted);
      setEmailTo(extracted.hr_email || "");
      setEditableJd(poster.generated_jd || "");

      if (!extracted.job_title && !extracted.company_name) {
        updateSkill("skill-vision", {
          status: "warning",
          message: "Job details partially detected. Verify company & role.",
          details: `Confidence: ${Math.round((extracted.confidence_score || 0.5) * 100)}%`,
          error: "Dikkat: Vision model poster se clear company ya title nahi padh paya."
        });
        log("warning", "Vision OCR", "Dikkat: Company name ya job title clearly identify nahi hua.");
      } else {
        updateSkill("skill-vision", {
          status: "completed",
          message: `Extracted: ${extracted.job_title || "Role"} at ${extracted.company_name || "Company"}`,
          details: `Found ${extracted.required_skills?.length || 0} skills • HR: ${extracted.hr_email || "Not found"}`
        });
        log("success", "Vision OCR", `Extracted '${extracted.job_title}' at '${extracted.company_name}' (${extracted.required_skills?.length || 0} skills)`);
        if (extracted.hr_email) {
          log("success", "Vision OCR", `Found recruiter email: ${extracted.hr_email}`);
        } else {
          log("warning", "Vision OCR", "Recruiter HR email was not detected on poster image.");
        }
      }

      if (isCancelledRef.current) return;

      // --- SKILL 2: Job Description Generator ---
      updateSkill("skill-jd", { status: "running", message: "Synthesizing structured Markdown JD..." });
      log("info", "JD Generator", "Formatting job responsibilities, skills, and qualifications into Markdown JD...");

      const jdText = poster.generated_jd || (extracted.job_responsibilities?.length ? extracted.job_responsibilities.join("\n") : "Standard job description generated.");
      setEditableJd(jdText);
      updateSkill("skill-jd", {
        status: "completed",
        message: "Structured Job Description generated successfully",
        details: `${jdText.length} characters structured`
      });
      log("success", "JD Generator", "Markdown Job Description ready for resume matching.");

      if (isCancelledRef.current) return;

      // --- SKILL 3: AI Resume Matcher & Scorer ---
      updateSkill("skill-resume", { status: "running", message: "Matching candidate resumes with extracted job criteria..." });
      log("info", "Resume Matcher", `Evaluating fit against stored role resumes in Resume Builder...`);

      let matchedResumes: ResumeMatchScore[] = [];
      try {
        matchedResumes = await matchResumesForPoster(poster.id, extracted);
        setResumeMatches(matchedResumes);
      } catch (err: any) {
        log("warning", "Resume Matcher", `Resume matching warning: ${err.message || "Using fallback"}`);
      }

      if (isCancelledRef.current) return;

      const bestMatch = matchedResumes.length > 0 ? matchedResumes[0] : null;
      if (bestMatch) {
        setSelectedResumeId(bestMatch.resume_id);
        updateSkill("skill-resume", {
          status: "completed",
          message: `Best Match: ${bestMatch.role_name} (${bestMatch.match_percentage}%)`,
          details: `Matched skills: ${(bestMatch.matching_skills || []).slice(0, 4).join(", ") || "General alignment"}`
        });
        log("success", "Resume Matcher", `Selected '${bestMatch.role_name}' with fit score ${bestMatch.match_percentage}%`);
      } else {
        updateSkill("skill-resume", {
          status: "warning",
          message: "No specific role resume matched. Using standard profile.",
          error: "Dikkat: Resume Builder mein koi specific resume nahi mila. Resume section mein resume upload karein."
        });
        log("warning", "Resume Matcher", "Dikkat: No saved role resumes found in Resume Builder.");
      }

      if (isCancelledRef.current) return;

      // --- SKILL 4: Safety Gate & Recruiter Email Check ---
      updateSkill("skill-gate", { status: "running", message: "Validating recruiter HR email & minimum score threshold..." });
      log("info", "Safety Gate", "Validating recipient HR email and match score threshold (>= 75%)...");

      const hasHrEmail = Boolean(extracted.hr_email && extracted.hr_email.includes("@"));
      const matchScore = bestMatch ? bestMatch.match_percentage : 70;
      let gateHasIssue = false;

      if (!hasHrEmail) {
        gateHasIssue = true;
        updateSkill("skill-gate", {
          status: "warning",
          message: "Recruiter HR email not found on poster",
          error: "Dikkat: Recruiter HR email nahi mila. Sending ke liye valid recipient email required hai."
        });
        log("warning", "Safety Gate", "Dikkat: Recruiter HR email missing from poster.");
      } else if (matchScore < 75) {
        updateSkill("skill-gate", {
          status: "warning",
          message: `Match score ${matchScore}% is below standard 75% threshold`,
          details: `HR email verified: ${extracted.hr_email}`
        });
        log("warning", "Safety Gate", `Notice: Match score ${matchScore}% below 75% threshold.`);
      } else {
        updateSkill("skill-gate", {
          status: "completed",
          message: `Safety check passed (Score: ${matchScore}% • Recruiter Email: ${extracted.hr_email})`,
          details: "Verified recipient address and satisfactory resume match score"
        });
        log("success", "Safety Gate", `Passed: Score ${matchScore}% >= 75% & valid email ${extracted.hr_email}`);
      }

      if (isCancelledRef.current) return;

      // --- SKILL 5: Cold Application Email Drafter ---
      updateSkill("skill-email", { status: "running", message: "Drafting personalized application email with AI..." });
      log("info", "Email Drafter", `Generating cold application email with ${emailTone} tone...`);

      let emailDraft: any = null;
      try {
        emailDraft = await generateEmailForPoster(poster.id, {
          extractedData: extracted,
          resumeId: bestMatch?.resume_id,
          tone: emailTone
        });
        setEmailTo(emailDraft.to_email || extracted.hr_email || "");
        setEmailSubject(emailDraft.subject || `Application for ${extracted.job_title || "Position"}`);
        setEmailBody(emailDraft.body_html || "");
        updateSkill("skill-email", {
          status: "completed",
          message: `Email draft created: "${emailDraft.subject || "Job Application"}"`,
          details: `Tone: ${emailTone} • Tailored to ${extracted.company_name || "Company"}`
        });
        log("success", "Email Drafter", `Email draft generated: '${emailDraft.subject}'`);
      } catch (err: any) {
        updateSkill("skill-email", {
          status: "error",
          message: "Failed to generate email draft",
          error: `Dikkat: ${err.message || "AI email drafting error"}`
        });
        log("error", "Email Drafter", `Dikkat in Email Drafter: ${err.message}`);
      }

      if (isCancelledRef.current) return;

      // --- SKILL 6 & 7: Gmail Dispatcher & Application Tracker ---
      if (workflowMode === "auto") {
        const recipient = emailDraft?.to_email || extracted.hr_email;
        if (recipient && !gateHasIssue) {
          updateSkill("skill-gmail", { status: "running", message: `Dispatching application to ${recipient} via Gmail API...` });
          log("info", "Gmail Dispatcher", `Connecting to Gmail API and sending email with resume PDF...`);

          try {
            await sendPosterApplication(poster.id, {
              toEmail: recipient,
              subject: emailDraft?.subject || `Application for ${extracted.job_title}`,
              bodyHtml: emailDraft?.body_html || "",
              resumeId: bestMatch?.resume_id,
              extractedData: extracted,
              generatedJd: poster.generated_jd
            });

            updateSkill("skill-gmail", {
              status: "completed",
              message: `Application email sent successfully to ${recipient}`,
              details: "Sent via authorized Gmail account with resume MIME attachment"
            });
            log("success", "Gmail Dispatcher", `Email dispatched via Gmail API to ${recipient}!`);

            updateSkill("skill-tracker", {
              status: "completed",
              message: "Application logged in database with real-time tracking active",
              details: "Tracking replies via Gmail Pub/Sub webhook"
            });
            log("success", "Tracker", "Application successfully logged in Tracker. Monitoring responses.");

            setLivePipelineStatus("completed");
            log("success", "System", "All pipeline skills executed successfully!");
            toast("Automation completed: Application sent successfully via Gmail!", "ok");
          } catch (err: any) {
            updateSkill("skill-gmail", {
              status: "error",
              message: "Failed to send email via Gmail API",
              error: `Dikkat: ${err.response?.data?.detail || err.message || "Gmail send error"}`
            });
            log("error", "Gmail Dispatcher", `Dikkat: Gmail dispatch failed (${err.message})`);
            setLivePipelineStatus("error");
          }
        } else {
          // Automatic mode paused because HR email is missing
          updateSkill("skill-gmail", {
            status: "warning",
            message: "Auto-send paused: Recruiter HR email missing",
            error: "Dikkat: Gmail Dispatcher auto-send nahi kar saka kyunki HR email nahi mila."
          });
          updateSkill("skill-tracker", {
            status: "idle",
            message: "Pending manual approval and recipient verification"
          });
          setLivePipelineStatus("attention_needed");
          log("warning", "System", "Dikkat: Recruiter HR email missing. Auto-send paused for manual input.");
          toast("HR email not detected on poster. Please review recipient email.", "err");
        }
      } else {
        // MANUAL MODE
        updateSkill("skill-gmail", {
          status: "idle",
          message: "Waiting for manual review and approval before sending",
          details: `Recipient: ${extracted.hr_email || "Pending verification"}`
        });
        updateSkill("skill-tracker", {
          status: "idle",
          message: "Will be tracked once sent by user"
        });
        setLivePipelineStatus(gateHasIssue ? "attention_needed" : "completed");
        log("info", "System", "Manual Mode: All skills completed. Ready for your review & approval.");
      }
    } catch (err: any) {
      log("error", "System", `Pipeline failed: ${err.message || "Unknown error"}`);
      setLivePipelineStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  // Resume step trigger
  const goToResumeStep = async () => {
    if (!activePoster) return;
    setIsProcessing(true);
    try {
      const matches = await matchResumesForPoster(activePoster.id, editDetails);
      setResumeMatches(matches);
      if (matches.length > 0) {
        setSelectedResumeId(matches[0].resume_id);
      }
      setReviewStep(3);
    } catch (err) {
      // handled
    } finally {
      setIsProcessing(false);
    }
  };

  // Email step trigger
  const goToEmailStep = async () => {
    if (!activePoster) return;
    setIsProcessing(true);
    try {
      const draft = await generateEmailForPoster(activePoster.id, {
        extractedData: editDetails,
        resumeId: selectedResumeId,
        tone: emailTone
      });
      setEmailTo(draft.to_email || "");
      setEmailSubject(draft.subject || "");
      setEmailBody(draft.body_html || "");
      setReviewStep(4);
    } catch (err) {
      // handled
    } finally {
      setIsProcessing(false);
    }
  };

  // Send Application
  const handleSendApplication = async () => {
    if (!activePoster || !emailTo) return toast("HR Recipient Email is required", "err");
    setIsProcessing(true);
    try {
      await sendPosterApplication(activePoster.id, {
        toEmail: emailTo,
        subject: emailSubject,
        bodyHtml: emailBody,
        resumeId: selectedResumeId || undefined,
        extractedData: editDetails,
        generatedJd: editableJd
      });
      setActivePoster(null);
      setSelectedFile(null);
      setFilePreview(null);
      setActiveTab("history");
    } catch (err) {
      // error handled in store
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered Applications for History
  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      (app.company || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.hrEmail || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Page
      title="Apply Studio"
      actions={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-200 p-0.5 dark:bg-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("hub")}
              className={`rounded-md px-3 py-1.5 transition-all flex items-center gap-1.5 ${
                activeTab === "hub"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Sparkles size={14} /> Studio Hub
            </button>
            <button
              onClick={() => setActiveTab("builder")}
              className={`rounded-md px-3 py-1.5 transition-all flex items-center gap-1.5 ${
                activeTab === "builder"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Zap size={14} /> Workflow Builder
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`rounded-md px-3 py-1.5 transition-all flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Clock size={14} /> Application History
            </button>
          </div>

          {/* Option to see logs */}
          <button
            onClick={() => setShowLiveAudit(true)}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Open Live Automation & Skills Diagnostic Logs"
          >
            <Terminal size={14} className="text-indigo-500" />
            <span>Audit Logs</span>
            {livePipelineStatus === "running" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            )}
            {livePipelineStatus === "attention_needed" && (
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            )}
            {livePipelineStatus === "error" && (
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            )}
          </button>
        </div>
      }
    >
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Applications</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{metrics?.totalApplications ?? apps.length}</span>
            <Briefcase size={16} className="text-slate-400" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">Applications Sent</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600">{metrics?.applicationsSent ?? 0}</span>
            <Send size={16} className="text-emerald-500" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">Pending Review</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600">{metrics?.pendingApplications ?? 0}</span>
            <Clock size={16} className="text-amber-500" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-medium text-sky-600 uppercase tracking-wider">Responses</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-sky-600">{metrics?.responsesReceived ?? 0}</span>
            <Mail size={16} className="text-sky-500" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-medium text-indigo-600 uppercase tracking-wider">Interviews</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-600">{metrics?.interviewsScheduled ?? 0}</span>
            <CheckCircle2 size={16} className="text-indigo-500" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-medium text-rose-600 uppercase tracking-wider">Rejected</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-600">{metrics?.rejectedApplications ?? 0}</span>
            <X size={16} className="text-rose-500" />
          </div>
        </div>
      </div>

      {/* --- TAB 1: STUDIO HUB & UPLOADER --- */}
      {activeTab === "hub" && (
        <div className="space-y-6">
          {/* Main Action Section: Hero Dropzone */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
                  AI Job Application Automation
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload a hiring poster or PDF job description. AI reads the image, selects your best resume, crafts a tailored email, and applies directly via Gmail.
                </p>
              </div>
              {/* Interactive Workflow Mode Toggle */}
              <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold px-2 text-slate-600 dark:text-slate-400 hidden sm:inline">
                  Workflow Mode:
                </span>
                <div className="inline-flex rounded-lg bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkflowMode("manual");
                      localStorage.setItem("jobmail_workflow_mode", "manual");
                      toast("Manual Mode active: You can review and edit each application before sending.");
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      workflowMode === "manual"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <ShieldCheck size={13} />
                    <span>Manual Mode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkflowMode("auto");
                      localStorage.setItem("jobmail_workflow_mode", "auto");
                      toast("Automatic Mode active: AI will analyze, match resume & auto-send via Gmail!");
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      workflowMode === "auto"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Zap size={13} />
                    <span>Auto Mode</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dropzone Container */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                dragActive
                  ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20"
                  : "border-slate-300 hover:border-indigo-500 dark:border-slate-700 dark:hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-950/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
              />

              {filePreview ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={filePreview}
                    alt="Poster Preview"
                    className="max-h-48 rounded-lg object-contain shadow-md border border-slate-200 dark:border-slate-700"
                  />
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span>{selectedFile?.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                    <FileText size={28} />
                  </div>
                  <span className="text-sm font-semibold">{selectedFile.name}</span>
                  <span className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="mt-1 text-xs text-rose-500 hover:underline"
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 shadow-sm">
                    <Upload size={24} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">Drop your job poster image or PDF here</p>
                    <p className="text-xs text-slate-400">Supports PNG, JPG, JPEG, and PDF (Max 15MB)</p>
                  </div>
                  <button
                    type="button"
                    className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 hover:bg-slate-100"
                  >
                    Browse Files
                  </button>
                </div>
              )}
            </div>

            {/* Launch Action Button & View Logs Option */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowLiveAudit(true)}
                className="btn text-xs py-2 px-3.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 rounded-xl shadow-xs"
                title="Open Live Automation & Diagnostic Logs"
              >
                <Terminal size={14} className="text-indigo-500" />
                <span className="font-semibold">View Automation Logs</span>
                {pipelineLogs.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full font-mono text-slate-600 dark:text-slate-300">
                    {pipelineLogs.length} events
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2">
                {isUploading && (
                  <button
                    type="button"
                    onClick={handleStopAutomation}
                    className="btn text-xs py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 rounded-xl shadow-xs transition-all"
                    title="Stop ongoing automation immediately"
                  >
                    <Square size={12} className="fill-white" />
                    <span>Stop</span>
                  </button>
                )}

                <button
                  disabled={!selectedFile || isUploading}
                  onClick={handleAnalyzeAndLaunch}
                className={`btn flex items-center gap-2 px-5 py-2.5 font-bold text-sm shadow-md transition-all ${
                  workflowMode === "auto"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                    : "btn-primary shadow-indigo-600/20"
                }`}
              >
                {isUploading ? (
                  <>
                    <RotateCcw size={16} className="animate-spin" />
                    <span>{workflowMode === "auto" ? "Analyzing & Auto-Sending via Gmail..." : "Analyzing with Vision AI..."}</span>
                  </>
                ) : (
                  <>
                    {workflowMode === "auto" ? <Zap size={16} /> : <Sparkles size={16} />}
                    <span>{workflowMode === "auto" ? "Analyze Job & Send Automatically (1-Click)" : "Analyze Job & Generate Application"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

          {/* Recent Uploaded Posters Carousel / Grid */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Layers size={16} className="text-slate-400" />
              Uploaded Job Posters
            </h3>
            {posters.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-slate-800">
                No job posters uploaded yet. Upload your first poster above!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {posters.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <Badge v={p.status} />
                        <span className="text-[11px] text-slate-400">{fmt(p.created_at)}</span>
                      </div>
                      <h4 className="font-semibold text-sm truncate">
                        {p.extracted_data?.job_title || p.filename}
                      </h4>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {p.extracted_data?.company_name || "Company pending extraction"}
                      </p>
                      {p.extracted_data?.hr_email ? (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 truncate flex items-center gap-1 font-medium">
                          <Mail size={12} /> {p.extracted_data.hr_email}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-500 mt-2 truncate flex items-center gap-1">
                          <AlertTriangle size={12} /> HR Email missing
                        </p>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        onClick={() => {
                          setActivePoster(p);
                          if (p.extracted_data) setEditDetails(p.extracted_data);
                          if (p.generated_jd) setEditableJd(p.generated_jd);
                          setReviewStep(1);
                        }}
                        className="btn text-xs py-1 px-3"
                      >
                        Review & Apply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 2: VISUAL WORKFLOW BUILDER --- */}
      {activeTab === "builder" && (
        <div className="space-y-3">
          {/* Action Toolbar: Only Add Node, Save, Test Run */}
          <div className="flex items-center justify-end gap-2.5">
            <button
              onClick={() => setDrawerMode("add")}
              className="btn text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs"
            >
              <Plus size={15} />
              <span>Add Node</span>
            </button>
            <button
              onClick={() => {
                if (selectedWorkflow) {
                  saveWorkflow({
                    id: selectedWorkflow.id,
                    name: selectedWorkflow.name,
                    nodes: nodes as any,
                    edges: edges as any,
                    settings: selectedWorkflow.settings,
                  });
                }
              }}
              className="btn btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold shadow-xs"
            >
              <Copy size={14} />
              <span>Save</span>
            </button>
            <button
              onClick={async () => {
                if (selectedWorkflow) {
                  const exec = await executeWorkflow(selectedWorkflow.id, undefined, true);
                  setExecutionLogs(exec);
                }
              }}
              className="btn text-xs py-2 px-3.5 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 shadow-xs"
            >
              <Play size={13} className="text-emerald-500" />
              <span>Test Run</span>
            </button>
            <button
              onClick={() => setShowLiveAudit(true)}
              className="btn text-xs py-2 px-3 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 shadow-xs"
              title="Open Live Automation & Diagnostic Logs"
            >
              <Terminal size={14} className="text-indigo-500" />
              <span>Logs</span>
            </button>
          </div>

          {/* Full Width Canvas Container */}
          <div className="w-full h-[760px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden shadow-sm relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={edgeOptions}
              onNodeClick={(_, node) => handleOpenEditDrawer(node)}
              fitView
              className="w-full h-full"
            >
              <Background gap={24} size={1.5} color="#ffffff15" />
              <Controls className="!bg-white dark:!bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-md" />
              <MiniMap
                nodeColor={() => "#ffffff"}
                className="!bg-white dark:!bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-md"
              />
            </ReactFlow>

            {/* Floating Canvas Quick Tip */}
            <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 shadow-sm pointer-events-none">
              <span>💡 Click any node to open settings drawer • Click 🗑️ to delete • Drag handles to connect</span>
            </div>
          </div>
        </div>
      )}

      {/* --- SLIDE-OVER DRAWER (Add Step / Step Settings - Reference UI pattern) --- */}
      {drawerMode !== "none" && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end transition-opacity">
          {/* Backdrop click to close */}
          <div className="flex-1 cursor-pointer" onClick={() => setDrawerMode("none")} />

          {/* Slide-over panel */}
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-out z-10">
            {/* 1. ADD STEP DRAWER (Reference Image 1) */}
            {drawerMode === "add" && (
              <>
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <Plus size={18} />
                    </div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">Add workflow step</h3>
                  </div>
                  <button
                    onClick={() => setDrawerMode("none")}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
                  {/* Section: Triggers */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      <Zap size={14} /> Triggers
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Events that start this automated job application workflow:
                    </p>

                    <div
                      onClick={() =>
                        handleAddNodeFromDrawer("trigger", "Job Poster Upload", "trigger", {
                          description: "Triggers automatically when a job poster image or PDF is uploaded.",
                        })
                      }
                      className="group rounded-xl border border-dashed border-amber-300 dark:border-amber-800/80 hover:border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50/80 dark:hover:bg-amber-950/40 p-3.5 cursor-pointer transition-all flex items-start gap-3 shadow-xs hover:shadow-md"
                    >
                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 group-hover:scale-105 transition-transform">
                        <Upload size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                            Job Poster Upload
                          </h4>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            Trigger
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Enrol leads from uploaded job posters (PNG, JPG, PDF) — extracts hiring info and kicks off the pipeline.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() =>
                        handleAddNodeFromDrawer("trigger", "Manual Trigger", "trigger", {
                          description: "Executes the pipeline on-demand for a selected job opening.",
                        })
                      }
                      className="group rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 p-3.5 cursor-pointer transition-all flex items-start gap-3 shadow-xs hover:shadow-md"
                    >
                      <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                        <Play size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            Manual Trigger
                          </h4>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            On Demand
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Allows you to run this pipeline manually for any specific company or position.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section: Workflow Steps */}
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      <Layers size={14} /> Workflow Steps
                    </div>

                    <div className="space-y-2">
                      {WORKFLOW_STEP_PRESETS.map((step) => (
                        <div
                          key={step.id}
                          onClick={() => handleAddNodeFromDrawer(step.category, step.label, step.type, step.extra)}
                          className="group rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 p-3.5 cursor-pointer transition-all flex items-start gap-3.5 shadow-xs hover:shadow-md"
                        >
                          <div
                            className={`p-2 rounded-lg ${step.iconBg} shrink-0 group-hover:scale-105 transition-transform`}
                          >
                            {step.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                {step.label}
                              </h4>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                {step.categoryBadge}
                              </span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sticky Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Select a trigger or step to add to sequence
                  </span>
                  <button
                    onClick={() => setDrawerMode("none")}
                    className="btn text-xs py-2 px-4 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* 2. EDIT STEP SETTINGS DRAWER (Reference Image 3) */}
            {drawerMode === "edit" && selectedNode && (
              <>
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <Sliders size={18} />
                    </div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                      {editFormData.label} settings
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        handleDeleteNode(selectedNode.id);
                        setDrawerMode("none");
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2.5 py-1.5 rounded-lg transition-colors border border-rose-200 dark:border-rose-900/60"
                      title="Delete this step from workflow"
                    >
                      <Trash2 size={14} />
                      <span>Delete Step</span>
                    </button>
                    <button
                      onClick={() => setDrawerMode("none")}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                  {/* STEP TITLE */}
                  <div>
                    <label className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                      Step Title
                    </label>
                    <input
                      className="input w-full text-xs py-2 px-3"
                      value={editFormData.label}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, label: e.target.value }))}
                      placeholder="e.g. AI Vision Extraction"
                    />
                  </div>

                  {/* DESCRIPTION */}
                  <div>
                    <label className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                      Step Description / Instructions
                    </label>
                    <textarea
                      rows={3}
                      className="input w-full text-xs p-3 leading-relaxed"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what this step does in the automation sequence..."
                    />
                  </div>

                  {/* VARIABLE CHIPS */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                      Available Variables (click to copy)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "{{companyName}}",
                        "{{jobTitle}}",
                        "{{hrEmail}}",
                        "{{candidateName}}",
                        "{{matchingSkills}}",
                        "{{matchScore}}",
                      ].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(v);
                            toast(`Copied ${v} to clipboard!`);
                          }}
                          className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Condition: Threshold Slider */}
                  {editFormData.threshold !== undefined && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                          Match Score Threshold
                        </label>
                        <span className="text-sm font-bold font-mono px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                          {editFormData.threshold}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="95"
                        step="5"
                        className="w-full accent-amber-600 h-2 bg-amber-200 rounded-lg cursor-pointer dark:bg-amber-800"
                        value={editFormData.threshold}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, threshold: parseInt(e.target.value) || 75 }))
                        }
                      />
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                        Applications with resume match scores below {editFormData.threshold}% will be paused for manual review before sending.
                      </p>
                    </div>
                  )}

                  {/* Email: Tone and Subject */}
                  {selectedNode.data?.category === "email" && (
                    <div className="space-y-4 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/30 dark:bg-sky-950/20 p-4">
                      <div>
                        <label className="text-[11px] uppercase font-bold tracking-wider text-sky-900 dark:text-sky-300 block mb-1.5">
                          Email Tone
                        </label>
                        <select
                          className="input w-full text-xs py-2 px-3"
                          value={editFormData.tone || "formal"}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, tone: e.target.value }))}
                        >
                          <option value="formal">Formal & Professional (Standard)</option>
                          <option value="friendly">Warm & Enthusiastic (Startups / Creative)</option>
                          <option value="concise">Short & Direct (Quick pitches)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] uppercase font-bold tracking-wider text-sky-900 dark:text-sky-300 block mb-1.5">
                          Subject Line Template
                        </label>
                        <input
                          className="input w-full text-xs py-2 px-3"
                          value={editFormData.subjectTemplate || "Application for {{jobTitle}} – {{candidateName}}"}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, subjectTemplate: e.target.value }))}
                          placeholder="Application for {{jobTitle}} – {{candidateName}}"
                        />
                      </div>
                    </div>
                  )}

                  {/* AI Model selector */}
                  {selectedNode.data?.category === "ai" && (
                    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 space-y-3">
                      <label className="text-[11px] uppercase font-bold tracking-wider text-indigo-900 dark:text-indigo-300 block">
                        Vision & LLM Engine
                      </label>
                      <select
                        className="input w-full text-xs py-2 px-3"
                        value={editFormData.model || "gpt-4o-mini"}
                        onChange={(e) => setEditFormData((prev) => ({ ...prev, model: e.target.value }))}
                      >
                        <option value="gpt-4o-mini">OpenAI GPT-4o-mini (Fast & Accurate OCR)</option>
                        <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (Ultra Fast)</option>
                      </select>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-400">
                        Automatically reads poster graphics, detects recruiter emails, and parses role requirements.
                      </p>
                    </div>
                  )}
                </div>

                {/* Sticky Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                  <button
                    onClick={() => setDrawerMode("none")}
                    className="btn text-xs py-2 px-4 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateNodeFromDrawer}
                    className="btn text-xs py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle2 size={14} />
                    <span>Update Node</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: APPLICATION HISTORY --- */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                className="input pl-8 text-xs w-full"
                placeholder="Search by company, role, or HR email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={14} className="text-slate-400" />
              <select
                className="input text-xs py-1.5"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="Applied">Applied</option>
                <option value="Response Received">Response Received</option>
                <option value="Interview Scheduled">Interview Scheduled</option>
                <option value="Offer Received">Offer Received</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* History Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">HR Recipient</th>
                    <th className="py-3 px-4">Match Score</th>
                    <th className="py-3 px-4">Applied Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No applications matched your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredApps.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-semibold">{a.company}</td>
                        <td className="py-3 px-4">{a.title}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{a.hrEmail || "-"}</td>
                        <td className="py-3 px-4">
                          {a.matchScore ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {a.matchScore}%
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{fmt(a.createdAt || "")}</td>
                        <td className="py-3 px-4">
                          <Badge v={a.status} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedApp(a)}
                              className="btn text-xs py-1 px-2.5 flex items-center gap-1"
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              onClick={() => triggerFollowUp(a.id, false)}
                              className="btn text-xs py-1 px-2.5 flex items-center gap-1 text-indigo-600 dark:text-indigo-400"
                            >
                              <Mail size={12} /> Follow-up
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 0: LIVE PIPELINE EXECUTION & SKILLS AUDIT SCREEN --- */}
      {showLiveAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] flex flex-col overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    AI Application Pipeline Execution
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live skills progress & diagnostic audit trail for{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {selectedFile?.name || "Job Poster"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Stop Automation Button in Header when running */}
                {livePipelineStatus === "running" && (
                  <button
                    onClick={handleStopAutomation}
                    className="btn text-xs py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
                    title="Stop ongoing automation immediately"
                  >
                    <Square size={12} className="fill-white" />
                    <span>Stop Automation</span>
                  </button>
                )}

                {/* Pipeline Status Badge */}
                {livePipelineStatus === "running" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <RotateCcw size={13} className="animate-spin text-blue-600" />
                    <span>Executing Skills...</span>
                  </span>
                )}
                {livePipelineStatus === "completed" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>All Skills Completed</span>
                  </span>
                )}
                {livePipelineStatus === "attention_needed" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle size={13} className="text-amber-600" />
                    <span>Attention Needed</span>
                  </span>
                )}
                {livePipelineStatus === "error" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    <XCircle size={13} className="text-rose-600" />
                    <span>Skill Error Detected</span>
                  </span>
                )}

                <button
                  onClick={() => setShowLiveAudit(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Highlight Banner if there is an issue */}
              {(livePipelineStatus === "attention_needed" || livePipelineStatus === "error") && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/30 p-3.5 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200">
                      Dikkat: Step verification ya action required hai!
                    </h4>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      {pipelineSkills.find((s) => s.error)?.error ||
                        "Neeche diye gaye skills mein dikkat aayi hai. Aap 'Review & Fix' par click kar ke turant theek kar sakte hain."}
                    </p>
                  </div>
                </div>
              )}

              {/* Skills Sequence Flow */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Skills In Sequence</span>
                  <span>Execution Status</span>
                </div>

                <div className="space-y-2">
                  {pipelineSkills.map((skill, index) => {
                    const isRunning = skill.status === "running";
                    const isDone = skill.status === "completed";
                    const isWarn = skill.status === "warning";
                    const isErr = skill.status === "error";
                    const isIdle = skill.status === "idle";

                    return (
                      <div
                        key={skill.id}
                        className={`rounded-xl border p-3 transition-all ${
                          isRunning
                            ? "border-blue-400 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20 ring-1 ring-blue-400"
                            : isDone
                            ? "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                            : isWarn
                            ? "border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20"
                            : isErr
                            ? "border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20"
                            : "border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/40 opacity-70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Skill Number Badge */}
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              {index + 1}
                            </span>

                            {/* Status Icon */}
                            {isRunning && <RotateCcw size={15} className="animate-spin text-blue-600 shrink-0" />}
                            {isDone && <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />}
                            {isWarn && <AlertTriangle size={15} className="text-amber-600 shrink-0" />}
                            {isErr && <XCircle size={15} className="text-rose-600 shrink-0" />}
                            {isIdle && <Clock size={15} className="text-slate-400 shrink-0" />}

                            <div className="truncate">
                              <span className="font-bold text-xs text-slate-900 dark:text-white">
                                {skill.name}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-2 font-mono">
                                ({skill.skillType})
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {isRunning && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 animate-pulse">
                                Running...
                              </span>
                            )}
                            {isDone && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                                Completed
                              </span>
                            )}
                            {isWarn && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                                Warning / Review
                              </span>
                            )}
                            {isErr && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                                Error
                              </span>
                            )}
                            {isIdle && (
                              <span className="text-[10px] font-semibold text-slate-400">
                                Waiting
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Skill Message & Output */}
                        <div className="mt-1.5 pl-7 text-[11px] space-y-1">
                          <p className="text-slate-600 dark:text-slate-300">{skill.message}</p>
                          {skill.details && (
                            <p className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 px-2 py-0.5 rounded inline-block">
                              ✓ {skill.details}
                            </p>
                          )}
                          {skill.error && (
                            <div className="rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 p-2 text-rose-700 dark:text-rose-300 font-semibold text-[11px] flex items-start gap-1.5 mt-1">
                              <AlertTriangle size={13} className="shrink-0 mt-0.5 text-rose-500" />
                              <span>{skill.error}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Audit Terminal Log Stream */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Terminal size={13} /> Execution Log Stream
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">{pipelineLogs.length} events logged</span>
                    {pipelineLogs.length > 0 && (
                      <button
                        onClick={() => {
                          const text = pipelineLogs.map((l) => `[${l.timestamp}] [${l.skill}] [${l.level.toUpperCase()}]: ${l.text}`).join("\n");
                          navigator.clipboard.writeText(text);
                          toast("Logs copied to clipboard", "ok");
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800"
                        title="Copy all logs"
                      >
                        <Copy size={11} /> Copy
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 font-mono text-[11px] h-44 overflow-y-auto space-y-1.5 text-slate-300 shadow-inner">
                  {pipelineLogs.length === 0 ? (
                    <div className="text-slate-500 italic py-4 text-center">
                      Waiting for automation pipeline events...
                    </div>
                  ) : (
                    pipelineLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-slate-500 shrink-0 text-[10px]">[{log.timestamp}]</span>
                        <span
                          className={`font-bold px-1.5 rounded text-[9px] shrink-0 uppercase ${
                            log.level === "success"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : log.level === "warning"
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : log.level === "error"
                              ? "bg-rose-950 text-rose-400 border border-rose-800"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {log.skill}
                        </span>
                        <span
                          className={`${
                            log.level === "error"
                              ? "text-rose-400 font-bold"
                              : log.level === "warning"
                              ? "text-amber-300 font-medium"
                              : log.level === "success"
                              ? "text-emerald-300"
                              : "text-slate-300"
                          }`}
                        >
                          {log.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="border-t border-slate-200 px-6 py-3.5 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLiveAudit(false)}
                  className="btn text-xs py-2 px-4 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Close Logs
                </button>
                {/* Stop Automation option in logs footer */}
                {livePipelineStatus === "running" && (
                  <button
                    onClick={handleStopAutomation}
                    className="btn text-xs py-2 px-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 shadow-sm shadow-rose-600/20"
                    title="Stop ongoing automation pipeline"
                  >
                    <Square size={12} className="fill-white" />
                    <span>Stop Automation</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Attention needed / Error action */}
                {(livePipelineStatus === "attention_needed" || livePipelineStatus === "error") && (
                  <button
                    onClick={() => {
                      setShowLiveAudit(false);
                      setReviewStep(1);
                    }}
                    className="btn text-xs py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-amber-600/20"
                  >
                    <span>Review & Fix in Studio</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                {/* Manual Mode Completed: Proceed to Review */}
                {workflowMode === "manual" && livePipelineStatus === "completed" && (
                  <button
                    onClick={() => {
                      setShowLiveAudit(false);
                      setReviewStep(1);
                    }}
                    className="btn btn-primary text-xs py-2 px-5 font-bold flex items-center gap-1.5 shadow-md"
                  >
                    <span>Proceed to Review & Send</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                {/* Auto Mode Completed: View in Tracker */}
                {workflowMode === "auto" && livePipelineStatus === "completed" && (
                  <button
                    onClick={() => {
                      setShowLiveAudit(false);
                      setActiveTab("history");
                    }}
                    className="btn text-xs py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <span>View in Application Tracker</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 1: 4-STEP MANUAL REVIEW WORKFLOW --- */}
      {activePoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-600" />
                <h3 className="font-bold text-base">
                  Apply Studio: Review & Launch Application
                </h3>
              </div>
              <button onClick={() => setActivePoster(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Stepper Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 py-2.5 dark:border-slate-800 text-xs font-semibold text-slate-500">
              <span className={`flex items-center gap-1.5 ${reviewStep === 1 ? "text-indigo-600 font-bold" : ""}`}>
                1. Job Details
              </span>
              <ChevronRight size={14} className="text-slate-300" />
              <span className={`flex items-center gap-1.5 ${reviewStep === 2 ? "text-indigo-600 font-bold" : ""}`}>
                2. Generated JD
              </span>
              <ChevronRight size={14} className="text-slate-300" />
              <span className={`flex items-center gap-1.5 ${reviewStep === 3 ? "text-indigo-600 font-bold" : ""}`}>
                3. Best Resume ({resumeMatches.length})
              </span>
              <ChevronRight size={14} className="text-slate-300" />
              <span className={`flex items-center gap-1.5 ${reviewStep === 4 ? "text-indigo-600 font-bold" : ""}`}>
                4. Application Email
              </span>
            </div>

            {/* Step Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {/* STEP 1: Extracted Info */}
              {reviewStep === 1 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-500">Job Title</label>
                      <input
                        className="input mt-1 w-full text-xs"
                        value={editDetails.job_title || ""}
                        onChange={(e) => setEditDetails({ ...editDetails, job_title: e.target.value })}
                        placeholder="e.g. Full Stack Developer"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-500">Company Name</label>
                      <input
                        className="input mt-1 w-full text-xs"
                        value={editDetails.company_name || ""}
                        onChange={(e) => setEditDetails({ ...editDetails, company_name: e.target.value })}
                        placeholder="e.g. Acme Corp"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-500">HR / Recruiter Email *</label>
                      <input
                        className={`input mt-1 w-full text-xs font-medium ${
                          !editDetails.hr_email ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20" : ""
                        }`}
                        value={editDetails.hr_email || ""}
                        onChange={(e) => setEditDetails({ ...editDetails, hr_email: e.target.value })}
                        placeholder="hr@company.com"
                      />
                      {!editDetails.hr_email && (
                        <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                          <AlertTriangle size={12} /> Please input recruiter email to proceed with email dispatch.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="font-semibold text-slate-500">Location</label>
                      <input
                        className="input mt-1 w-full text-xs"
                        value={editDetails.location || ""}
                        onChange={(e) => setEditDetails({ ...editDetails, location: e.target.value })}
                        placeholder="e.g. Remote, New York, etc."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-500">Extracted Required Skills (comma separated)</label>
                    <input
                      className="input mt-1 w-full text-xs"
                      value={editDetails.required_skills?.join(", ") || ""}
                      onChange={(e) =>
                        setEditDetails({
                          ...editDetails,
                          required_skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                        })
                      }
                    />
                  </div>

                  {activePoster.file_url && (
                    <div className="rounded-xl border border-slate-200 p-2 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                      <span className="font-semibold text-[11px] text-slate-500 block mb-1">Original Poster Preview</span>
                      <img
                        src={activePoster.file_url}
                        alt="Poster"
                        className="max-h-40 rounded object-contain mx-auto"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Generated JD */}
              {reviewStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      Editable Structured Job Description
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(editableJd);
                        toast("Job description copied to clipboard!");
                      }}
                      className="btn text-xs py-1 px-2.5 flex items-center gap-1"
                    >
                      <Copy size={12} /> Copy JD
                    </button>
                  </div>
                  <textarea
                    rows={12}
                    className="input w-full font-mono text-xs leading-relaxed"
                    value={editableJd}
                    onChange={(e) => setEditableJd(e.target.value)}
                  />
                </div>
              )}

              {/* STEP 3: Resume Matches */}
              {reviewStep === 3 && (
                <div className="space-y-3">
                  <p className="text-slate-500 text-xs">
                    The 5-factor scoring engine evaluated your uploaded resumes. Select your preferred resume below:
                  </p>
                  {resumeMatches.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-amber-300 p-6 text-center text-amber-700 bg-amber-50 dark:bg-amber-950/20">
                      No matching resumes found. Please upload role resumes in Resume Builder!
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {resumeMatches.map((m) => (
                        <div
                          key={m.resume_id}
                          onClick={() => setSelectedResumeId(m.resume_id)}
                          className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                            selectedResumeId === m.resume_id
                              ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm"
                              : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                checked={selectedResumeId === m.resume_id}
                                onChange={() => setSelectedResumeId(m.resume_id)}
                              />
                              <span className="font-bold text-sm">{m.role_name} Resume</span>
                              {m.is_recommended && (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                  AI RECOMMENDED
                                </span>
                              )}
                            </div>
                            <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                              {m.match_percentage}% Match
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{m.rationale}</p>
                          {m.matching_skills.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {m.matching_skills.map((s) => (
                                <span key={s} className="rounded bg-slate-200/60 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                                  ✓ {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Application Email & Sending */}
              {reviewStep === 4 && (
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-slate-500">Recipient Email</label>
                    <input
                      className="input mt-1 w-full text-xs font-medium"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-500">Email Subject</label>
                    <input
                      className="input mt-1 w-full text-xs"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-500">Email Body (HTML)</label>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span>Tone:</span>
                        <select
                          className="input py-0.5 text-[11px]"
                          value={emailTone}
                          onChange={(e) => setEmailTone(e.target.value as any)}
                        >
                          <option value="formal">Formal</option>
                          <option value="friendly">Warm/Friendly</option>
                          <option value="concise">Short/Concise</option>
                        </select>
                      </div>
                    </div>
                    <textarea
                      rows={8}
                      className="input w-full font-mono text-xs"
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-2 dark:bg-slate-800 text-xs">
                    <FileCheck size={16} className="text-indigo-600" />
                    <span>Attachment: <strong>{roleResumes.find((r) => r.id === selectedResumeId)?.filename || "Selected Resume (PDF)"}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <button
                disabled={reviewStep === 1 || isProcessing}
                onClick={() => setReviewStep((s) => (s > 1 ? ((s - 1) as any) : s))}
                className="btn text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Back
              </button>

              <div className="flex items-center gap-2">
                {reviewStep === 1 && (
                  <button
                    onClick={() => {
                      if (!editableJd) {
                        const title = editDetails.job_title || "Open Role";
                        const company = editDetails.company_name || "Company";
                        const skills = editDetails.required_skills?.join(", ") || "Technical Skills";
                        setEditableJd(`# ${title} at ${company}\n\n### Required Skills\n${skills}\n\n### Details\nLocation: ${editDetails.location || "Remote"}`);
                      }
                      setReviewStep(2);
                    }}
                    className="btn btn-primary text-xs py-1.5 px-4 font-semibold"
                  >
                    Next: Job Description <ChevronRight size={14} />
                  </button>
                )}
                {reviewStep === 2 && (
                  <button
                    disabled={isProcessing}
                    onClick={goToResumeStep}
                    className="btn btn-primary text-xs py-1.5 px-4 font-semibold flex items-center gap-1.5"
                  >
                    {isProcessing ? <RotateCcw size={14} className="animate-spin" /> : null}
                    Next: Match Resume <ChevronRight size={14} />
                  </button>
                )}
                {reviewStep === 3 && (
                  <button
                    disabled={isProcessing}
                    onClick={goToEmailStep}
                    className="btn btn-primary text-xs py-1.5 px-4 font-semibold flex items-center gap-1.5"
                  >
                    {isProcessing ? <RotateCcw size={14} className="animate-spin" /> : null}
                    Next: Generate Email <ChevronRight size={14} />
                  </button>
                )}
                {reviewStep === 4 && (
                  <button
                    disabled={isProcessing || !emailTo}
                    onClick={handleSendApplication}
                    className="btn btn-primary text-xs py-2 px-5 font-bold flex items-center gap-1.5 shadow-md bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isProcessing ? <RotateCcw size={14} className="animate-spin" /> : <Send size={14} />}
                    Send Application via Gmail
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: APPLICATION DETAILS DRAWER --- */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[85vh] overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-base">{selectedApp.title}</h3>
                <p className="text-xs text-slate-500">{selectedApp.company}</p>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                <div className="mt-1">
                  <Badge v={selectedApp.status} />
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">HR Recipient</span>
                <p className="font-medium mt-1">{selectedApp.hrEmail || "Direct"}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Match Score</span>
                <p className="font-medium mt-1">{selectedApp.matchScore ? `${selectedApp.matchScore}%` : "-"}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Applied At</span>
                <p className="font-medium mt-1">{fmt(selectedApp.createdAt || "")}</p>
              </div>
            </div>

            {selectedApp.emailSubject && (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <span className="font-semibold block mb-1 text-slate-500">Sent Email</span>
                <p className="font-bold text-xs mb-2">{selectedApp.emailSubject}</p>
                <div
                  className="prose prose-xs dark:prose-invert max-h-40 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: selectedApp.emailBody || "" }}
                />
              </div>
            )}

            {/* Timeline */}
            <div>
              <span className="font-semibold block mb-2 text-slate-500">Timeline & Activity</span>
              <div className="space-y-1.5 border-l-2 border-indigo-500 pl-3">
                {selectedApp.timeline?.map((t, idx) => (
                  <div key={idx} className="text-xs">
                    <span className="text-slate-400 font-mono text-[10px]">{fmt(t.at)}:</span>{" "}
                    <span className="font-medium">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <button
                onClick={() => {
                  triggerFollowUp(selectedApp.id, true);
                  setSelectedApp(null);
                }}
                className="btn btn-primary text-xs py-1.5 px-4 font-semibold flex items-center gap-1.5"
              >
                <Mail size={14} /> Send Follow-up via Gmail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: WORKFLOW EXECUTION LOGS --- */}
      {executionLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[85vh] flex flex-col text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Zap size={16} className="text-indigo-600" />
                Workflow Execution Audit Trail
              </h3>
              <button onClick={() => setExecutionLogs(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-2 font-mono text-[11px]">
              {executionLogs.logs?.map((l, i) => (
                <div
                  key={i}
                  className={`p-2 rounded border ${
                    l.level === "error"
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300"
                      : l.level === "warning"
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300"
                      : l.level === "success"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-300"
                  }`}
                >
                  <span className="text-[10px] opacity-70">[{new Date(l.timestamp).toLocaleTimeString()}]</span>{" "}
                  {l.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
