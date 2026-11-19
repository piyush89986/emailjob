import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Handle,
  Position
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
  FileCheck
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

// --- Custom React Flow Node Components ---

function CustomWorkflowNode({ data, id }: { data: any; id: string }) {
  const isTrigger = data.category === "trigger";
  const isAi = data.category === "ai";
  const isResume = data.category === "resume";
  const isCondition = data.category === "condition";
  const isEmail = data.category === "email";
  const isTracking = data.category === "tracking";

  let headerColor = "bg-indigo-600 text-white";
  let borderColor = "border-indigo-400";
  let icon = <Sparkles size={14} className="shrink-0" />;

  if (isTrigger) {
    headerColor = "bg-emerald-600 text-white";
    borderColor = "border-emerald-500";
    icon = <Upload size={14} className="shrink-0" />;
  } else if (isCondition) {
    headerColor = "bg-amber-600 text-white";
    borderColor = "border-amber-500";
    icon = <ShieldCheck size={14} className="shrink-0" />;
  } else if (isEmail) {
    headerColor = "bg-sky-600 text-white";
    borderColor = "border-sky-500";
    icon = <Mail size={14} className="shrink-0" />;
  } else if (isResume) {
    headerColor = "bg-purple-600 text-white";
    borderColor = "border-purple-500";
    icon = <FileCheck size={14} className="shrink-0" />;
  } else if (isTracking) {
    headerColor = "bg-rose-600 text-white";
    borderColor = "border-rose-500";
    icon = <CheckCircle2 size={14} className="shrink-0" />;
  }

  return (
    <div className={`w-56 rounded-xl border-2 ${borderColor} bg-white shadow-md dark:bg-slate-900 overflow-hidden text-xs`}>
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-indigo-500" />
      <div className={`px-2.5 py-1.5 flex items-center justify-between font-semibold ${headerColor}`}>
        <div className="flex items-center gap-1.5 truncate">
          {icon}
          <span className="truncate">{data.label || "Step"}</span>
        </div>
      </div>
      <div className="p-2.5 space-y-1 text-slate-600 dark:text-slate-300">
        <p className="text-[11px] leading-tight line-clamp-2">{data.description || "Processes workflow payload"}</p>
        {data.threshold !== undefined && (
          <div className="mt-1 flex items-center justify-between rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span>Threshold</span>
            <span>{data.threshold}%</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-indigo-500" />
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

export default function ApplyStudio() {
  const [activeTab, setActiveTab] = useState<"hub" | "builder" | "history">("hub");

  // Metrics & State from Store
  const metrics = useS((s) => s.applyMetrics);
  const posters = useS((s) => s.posters);
  const workflows = useS((s) => s.workflows);
  const apps = useS((s) => s.apps);
  const roleResumes = useS((s) => s.roleResumes);

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

  useEffect(() => {
    fetchApplyMetrics();
    fetchJobPosters();
    fetchWorkflows();
  }, []);

  // Sync active workflow to React Flow canvas
  useEffect(() => {
    if (workflows.length > 0 && !selectedWorkflow) {
      const activeWf = workflows[0];
      setSelectedWorkflow(activeWf);
      if (activeWf.nodes && activeWf.nodes.length > 0) {
        setNodes(activeWf.nodes);
        setEdges(activeWf.edges);
      }
    }
  }, [workflows]);

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

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

  // Start Analysis Workflow
  const handleAnalyzeAndLaunch = async () => {
    if (!selectedFile) return toast("Please select or drop a job poster first", "err");
    setIsUploading(true);
    try {
      // 1. Upload and trigger AI analysis
      const poster = await uploadJobPoster(selectedFile, true);
      setActivePoster(poster);
      if (poster.extracted_data) {
        setEditDetails(poster.extracted_data);
        setEmailTo(poster.extracted_data.hr_email || "");
      }
      setEditableJd(poster.generated_jd || "");
      setReviewStep(1);
    } catch (err) {
      // handled in store
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
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold">Workflow Mode:</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded shadow-xs">
                  <ShieldCheck size={13} /> Manual Review
                </span>
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

            {/* Launch Action Button */}
            <div className="mt-4 flex justify-end">
              <button
                disabled={!selectedFile || isUploading}
                onClick={handleAnalyzeAndLaunch}
                className="btn btn-primary flex items-center gap-2 px-5 py-2.5 font-semibold text-sm shadow-md"
              >
                {isUploading ? (
                  <>
                    <RotateCcw size={16} className="animate-spin" /> Analyzing with Vision AI...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Analyze Job & Generate Application
                  </>
                )}
              </button>
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
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden h-[750px] flex flex-col">
          {/* Builder Header Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm flex items-center gap-1.5">
                <Zap size={16} className="text-indigo-600" />
                {selectedWorkflow?.name || "Job Application Pipeline"}
              </span>
              <Badge v={selectedWorkflow?.is_active ? "connected" : "waiting"} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedWorkflow) {
                    toggleWorkflowActive(selectedWorkflow.id, !selectedWorkflow.is_active);
                  }
                }}
                className={`btn text-xs py-1.5 px-3 font-semibold ${
                  selectedWorkflow?.is_active
                    ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-400"
                    : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400"
                }`}
              >
                {selectedWorkflow?.is_active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={async () => {
                  if (selectedWorkflow) {
                    const exec = await executeWorkflow(selectedWorkflow.id, undefined, true);
                    setExecutionLogs(exec);
                  }
                }}
                className="btn text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Play size={13} /> Test Run
              </button>
              <button
                onClick={() => {
                  if (selectedWorkflow) {
                    saveWorkflow({
                      id: selectedWorkflow.id,
                      name: selectedWorkflow.name,
                      nodes: nodes as any,
                      edges: edges as any,
                      settings: selectedWorkflow.settings
                    });
                  }
                }}
                className="btn btn-primary text-xs py-1.5 px-4 font-semibold"
              >
                Save Workflow
              </button>
            </div>
          </div>

          {/* Builder Canvas Area */}
          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedNode(node)}
              fitView
              className="bg-slate-100 dark:bg-slate-950"
            >
              <Background gap={16} size={1} />
              <Controls />
              <MiniMap
                nodeColor={() => "#6366f1"}
                className="!bg-white dark:!bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm"
              />

              {/* Node Palette floating panel */}
              <Panel position="top-left" className="bg-white/95 dark:bg-slate-900/95 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase px-1">Node Palette</span>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <button
                    onClick={() => {
                      const id = `node-${Date.now()}`;
                      setNodes((nds) => [
                        ...nds,
                        {
                          id,
                          type: "trigger",
                          position: { x: 100, y: 100 },
                          data: { label: "Trigger: Job Upload", category: "trigger", description: "Fires on new poster" }
                        }
                      ]);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <Upload size={12} className="text-emerald-500" /> Trigger
                  </button>
                  <button
                    onClick={() => {
                      const id = `node-${Date.now()}`;
                      setNodes((nds) => [
                        ...nds,
                        {
                          id,
                          type: "analyzeJob",
                          position: { x: 250, y: 100 },
                          data: { label: "AI Vision Extraction", category: "ai", description: "Extracts fields & HR" }
                        }
                      ]);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <Sparkles size={12} className="text-indigo-500" /> AI Vision
                  </button>
                  <button
                    onClick={() => {
                      const id = `node-${Date.now()}`;
                      setNodes((nds) => [
                        ...nds,
                        {
                          id,
                          type: "matchResume",
                          position: { x: 400, y: 100 },
                          data: { label: "Resume Matcher", category: "resume", description: "5-factor scoring" }
                        }
                      ]);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <FileCheck size={12} className="text-purple-500" /> Resume Match
                  </button>
                  <button
                    onClick={() => {
                      const id = `node-${Date.now()}`;
                      setNodes((nds) => [
                        ...nds,
                        {
                          id,
                          type: "condition",
                          position: { x: 550, y: 100 },
                          data: { label: "Safety Gate", category: "condition", threshold: 75, description: "Check match >= 75%" }
                        }
                      ]);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <ShieldCheck size={12} className="text-amber-500" /> Condition
                  </button>
                </div>
              </Panel>

              {/* Node Inspector Floating Panel */}
              {selectedNode && (
                <Panel position="top-right" className="w-72 bg-white/95 dark:bg-slate-900/95 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg text-xs backdrop-blur-xs space-y-2">
                  <div className="flex items-center justify-between font-bold border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    <span>Configure Node</span>
                    <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-slate-500">Node Label</label>
                    <input
                      className="input py-1 text-xs w-full mt-0.5"
                      value={typeof selectedNode.data?.label === "string" ? selectedNode.data.label : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNodes((nds) =>
                          nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, label: val } } : n))
                        );
                      }}
                    />
                  </div>
                  {selectedNode.data?.threshold !== undefined && (
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-slate-500">Minimum Match Score Threshold</label>
                      <input
                        type="number"
                        className="input py-1 text-xs w-full mt-0.5"
                        value={typeof selectedNode.data.threshold === "number" ? selectedNode.data.threshold : 70}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 70;
                          setNodes((nds) =>
                            nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, threshold: val } } : n))
                          );
                        }}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                      setSelectedNode(null);
                    }}
                    className="w-full text-rose-600 border border-rose-200 dark:border-rose-900 rounded py-1 hover:bg-rose-50 dark:hover:bg-rose-950 flex items-center justify-center gap-1 font-semibold"
                  >
                    <Trash2 size={12} /> Remove Node
                  </button>
                </Panel>
              )}
            </ReactFlow>
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
