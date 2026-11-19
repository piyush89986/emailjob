import { useEffect, useMemo, useRef, useState } from "react";
import {
  MailCheck,
  Search,
  RefreshCw,
  Inbox as InboxIcon,
  Calendar,
  AlertCircle,
  ExternalLink,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Building2,
  FileCheck2,
  Briefcase,
  HelpCircle,
  User,
  Tag,
  ArrowRight
} from "lucide-react";
import {
  fetchHRInbox,
  markHREmailRead,
  reclassifyHREmail,
  replyHREmail,
  syncHRInbox,
  useS,
  HRInboxItem,
  toast
} from "@/lib/store";
import { Page, Skeleton, Empty, fmt } from "@/components/ui";

// Category metadata
interface CatMeta {
  label: string;
  badgeClass: string;
  bgLight: string;
}

const CATEGORY_META: Record<string, CatMeta> = {
  HR_RECRUITER: {
    label: "HR Recruiter",
    badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    bgLight: "bg-indigo-50 dark:bg-indigo-950/30"
  },
  INTERVIEW_INVITATION: {
    label: "Interview Invitation",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    bgLight: "bg-purple-50 dark:bg-purple-950/30"
  },
  APPLICATION_CONFIRMATION: {
    label: "Application Received",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    bgLight: "bg-blue-50 dark:bg-blue-950/30"
  },
  ASSESSMENT: {
    label: "Assessment / Test",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    bgLight: "bg-amber-50 dark:bg-amber-950/30"
  },
  REJECTION: {
    label: "Rejection",
    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    bgLight: "bg-rose-50 dark:bg-rose-950/30"
  },
  OFFER_RECEIVED: {
    label: "Offer Received 🎉",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/30"
  },
  JOB_ALERT: {
    label: "Job Alert",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    bgLight: "bg-slate-50 dark:bg-slate-900/40"
  },
  MARKETING: {
    label: "Marketing",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    bgLight: "bg-slate-50 dark:bg-slate-900/40"
  },
  NEWSLETTER: {
    label: "Newsletter",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    bgLight: "bg-slate-50 dark:bg-slate-900/40"
  },
  SPAM: {
    label: "Spam",
    badgeClass: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    bgLight: "bg-slate-50 dark:bg-slate-900/40"
  },
  PERSONAL: {
    label: "Personal",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    bgLight: "bg-slate-50 dark:bg-slate-900/40"
  },
  OTHER: {
    label: "Review Needed",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-semibold",
    bgLight: "bg-amber-50/50 dark:bg-amber-950/20"
  }
};

/**
 * Sandboxed iframe viewer to render rich HTML email without CSS leaking into main DOM
 */
function EmailViewer({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(280);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const safeHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <base target="_blank">
          <style>
            html, body {
              margin: 0;
              padding: 16px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              background-color: #ffffff;
              word-break: break-word;
              overflow-x: auto;
              font-size: 14px;
              line-height: 1.6;
            }
            img { max-width: 100% !important; height: auto !important; }
            table { max-width: 100% !important; }
            a { color: #4f46e5; text-decoration: underline; }
          </style>
        </head>
        <body>${html || "<p>No content</p>"}</body>
      </html>
    `;

    doc.open();
    doc.write(safeHtml);
    doc.close();

    const resize = () => {
      try {
        if (iframe && doc.body) {
          const scrollH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 140);
          setHeight(scrollH + 20);
        }
      } catch {}
    };

    resize();
    const t = setTimeout(resize, 300);
    return () => clearTimeout(t);
  }, [html]);

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white shadow-sm min-h-[160px]">
      <iframe
        ref={iframeRef}
        style={{ width: "100%", height: `${height}px`, border: "none", display: "block" }}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        title="HR Email content"
      />
    </div>
  );
}

export default function HRInbox() {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);

  const hrEmails = useS((s) => s.hrInbox);
  const counts = useS((s) => s.hrCounts);

  // Load emails on mount and when filter changes
  useEffect(() => {
    setLoading(true);
    fetchHRInbox(activeFilter, searchTerm).finally(() => setLoading(false));
  }, [activeFilter]);

  // Handle live search debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchHRInbox(activeFilter, searchTerm);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Select first email automatically if none selected on desktop
  useEffect(() => {
    if (!selectedEmailId && hrEmails.length > 0) {
      setSelectedEmailId(hrEmails[0].id);
    }
  }, [hrEmails, selectedEmailId]);

  const selectedEmail = useMemo(
    () => hrEmails.find((e) => e.id === selectedEmailId) || null,
    [hrEmails, selectedEmailId]
  );

  // Mark as read when selected
  useEffect(() => {
    if (selectedEmail && !selectedEmail.is_read) {
      markHREmailRead(selectedEmail.id, true);
    }
  }, [selectedEmailId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncHRInbox();
    } finally {
      setSyncing(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedEmail || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await replyHREmail(selectedEmail.id, `<p>${replyText.replace(/\n/g, "<br>")}</p>`);
      setReplyText("");
    } finally {
      setSendingReply(false);
    }
  };

  const handleReclassify = async (newCategory: string) => {
    if (!selectedEmail) return;
    await reclassifyHREmail(selectedEmail.id, newCategory);
  };

  // Gmail Thread URL builder
  const gmailThreadUrl = selectedEmail?.gmail_thread_id
    ? `https://mail.google.com/mail/u/0/#inbox/${selectedEmail.gmail_thread_id}`
    : selectedEmail?.gmail_message_id
    ? `https://mail.google.com/mail/u/0/#inbox/${selectedEmail.gmail_message_id}`
    : "https://mail.google.com";

  return (
    <Page
      title="HR Inbox"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn flex items-center gap-2 text-xs py-1.5 px-3"
            title="Fetch new incoming emails from Gmail"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            <span>{syncing ? "Syncing Gmail..." : "Sync Emails"}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-full space-y-3 min-h-0">
        {/* Top Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 shrink-0">
          <div
            onClick={() => setActiveFilter("all")}
            className={`cursor-pointer p-3 rounded-xl border transition-all ${
              activeFilter === "all"
                ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total HR</span>
              <MailCheck size={14} className="text-indigo-500" />
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {counts.all}
            </div>
          </div>

          <div
            onClick={() => setActiveFilter("interviews")}
            className={`cursor-pointer p-3 rounded-xl border transition-all ${
              activeFilter === "interviews"
                ? "border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-400 font-medium">
              <span>Interviews</span>
              <Calendar size={14} />
            </div>
            <div className="mt-1 text-xl font-bold text-purple-700 dark:text-purple-300 font-mono">
              {counts.interviews}
            </div>
          </div>

          <div
            onClick={() => setActiveFilter("applications")}
            className={`cursor-pointer p-3 rounded-xl border transition-all ${
              activeFilter === "applications"
                ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 font-medium">
              <span>Applications</span>
              <FileCheck2 size={14} />
            </div>
            <div className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-300 font-mono">
              {counts.applications}
            </div>
          </div>

          <div
            onClick={() => setActiveFilter("hr")}
            className={`cursor-pointer p-3 rounded-xl border transition-all ${
              activeFilter === "hr"
                ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-sky-600 dark:text-sky-400 font-medium">
              <span>Recruiters</span>
              <User size={14} />
            </div>
            <div className="mt-1 text-xl font-bold text-sky-700 dark:text-sky-300 font-mono">
              {counts.hr}
            </div>
          </div>

          <div
            onClick={() => setActiveFilter("rejections")}
            className={`cursor-pointer p-3 rounded-xl border transition-all ${
              activeFilter === "rejections"
                ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-medium">
              <span>Rejections</span>
              <XCircle size={14} />
            </div>
            <div className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-300 font-mono">
              {counts.rejections}
            </div>
          </div>

          <div
            onClick={() => setActiveFilter("review")}
            className={`cursor-pointer p-3 rounded-xl border transition-all ${
              activeFilter === "review"
                ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
              <span>Review Queue</span>
              <AlertCircle size={14} />
            </div>
            <div className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300 font-mono">
              {counts.review}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input pl-9 text-xs w-full py-1.5"
              placeholder="Search HR sender, company, role, or subject…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "All HR", count: counts.all },
              { id: "interviews", label: "Interviews", count: counts.interviews },
              { id: "applications", label: "Applications", count: counts.applications },
              { id: "hr", label: "Recruiters", count: counts.hr },
              { id: "rejections", label: "Rejections", count: counts.rejections },
              { id: "unread", label: "Unread", count: counts.unread },
              { id: "review", label: "Review Queue", count: counts.review, alert: counts.review > 0 }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === f.id
                    ? f.alert
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-indigo-600 text-white shadow-sm"
                    : f.alert
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <span>{f.label}</span>
                {f.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      activeFilter === f.id
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Two-Column Layout */}
        <div className="flex flex-col md:grid md:grid-cols-[380px_minmax(0,1fr)] gap-4 flex-1 min-h-0 h-full overflow-hidden w-full max-w-full">
          {/* Left Column: Email List */}
          <div
            className={`flex flex-col min-h-0 h-full w-full md:w-[380px] shrink-0 overflow-hidden ${
              selectedEmailId ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton n={4} />
                </div>
              ) : hrEmails.length === 0 ? (
                <div className="card h-full flex flex-col items-center justify-center p-8 text-center">
                  <Empty
                    title="No HR emails found"
                    hint={
                      searchTerm
                        ? "No results matched your search."
                        : activeFilter === "review"
                        ? "Great job! No emails currently need manual review."
                        : "Click 'Sync Emails' to fetch incoming recruiter communications."
                    }
                  />
                </div>
              ) : (
                hrEmails.map((email) => {
                  const meta = CATEGORY_META[email.category] || CATEGORY_META.OTHER;
                  const isSelected = email.id === selectedEmailId;

                  return (
                    <div
                      key={email.id}
                      onClick={() => setSelectedEmailId(email.id)}
                      className={`relative cursor-pointer p-3.5 rounded-xl border transition-all text-left ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm ring-1 ring-indigo-500/30"
                          : !email.is_read
                          ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900"
                      }`}
                    >
                      {/* Unread dot */}
                      {!email.is_read && (
                        <span className="absolute top-3.5 left-2 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-slate-900" />
                      )}

                      <div className="pl-2">
                        {/* Header: Sender + Category + Date */}
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <div className="min-w-0 flex-1">
                            <span
                              className={`text-xs truncate block ${
                                !email.is_read
                                  ? "font-bold text-slate-900 dark:text-slate-100"
                                  : "font-semibold text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {email.sender_name || email.sender_email}
                            </span>
                            {email.company && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                <Building2 size={11} className="text-slate-400 shrink-0" />
                                <span>{email.company}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {fmt(email.received_at)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                        </div>

                        {/* Subject */}
                        <h4
                          className={`text-xs line-clamp-1 mb-1 ${
                            !email.is_read
                              ? "font-bold text-slate-900 dark:text-slate-100"
                              : "font-medium text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {email.subject || "No subject"}
                        </h4>

                        {/* Preview snippet */}
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {email.body_preview || "No content preview available."}
                        </p>

                        {/* Needs Manual Review Alert Badge */}
                        {email.needs_manual_review && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                            <AlertCircle size={11} className="shrink-0" />
                            <span>Low confidence ({Math.round(email.confidence_score * 100)}%) - Review needed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Full Email View & Action Station */}
          <div
            className={`flex flex-col min-h-0 h-full min-w-0 w-full overflow-hidden ${
              !selectedEmailId ? "hidden md:flex" : "flex"
            }`}
          >
            {!selectedEmail ? (
              <div className="card h-full flex flex-col items-center justify-center p-8 text-center">
                <Empty
                  title="Select an HR email"
                  hint="Choose any recruiter or interview communication on the left to read and reply."
                />
              </div>
            ) : (
              <div className="card h-full flex flex-col min-h-0 min-w-0 w-full overflow-hidden p-4 space-y-3">
                {/* Mobile Back Button */}
                <div className="flex items-center gap-2 md:hidden pb-2 border-b border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setSelectedEmailId(null)}
                    className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    ← Back to email list
                  </button>
                </div>

                {/* Email Header */}
                <div className="shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {selectedEmail.subject}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {selectedEmail.sender_name}
                        </span>
                        <span>&lt;{selectedEmail.sender_email}&gt;</span>
                        <span>•</span>
                        <span>{fmt(selectedEmail.received_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={gmailThreadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost text-xs flex items-center gap-1.5 py-1 px-2.5 border border-slate-200 dark:border-slate-700"
                        title="Open this conversation in original Gmail"
                      >
                        <ExternalLink size={13} />
                        <span>Open in Gmail</span>
                      </a>
                    </div>
                  </div>

                  {/* Context bar: Linked Company & Classification Station */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-2">
                      {selectedEmail.company && (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                          <Building2 size={13} className="text-slate-400" />
                          <span>Company: {selectedEmail.company}</span>
                        </span>
                      )}

                      {selectedEmail.application && (
                        <span className="inline-flex items-center gap-1 font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-800">
                          <Briefcase size={13} className="text-indigo-500" />
                          <span>Tracked Role: {selectedEmail.application.title}</span>
                        </span>
                      )}
                    </div>

                    {/* Reclassify Dropdown (Requirement 12) */}
                    <div className="flex items-center gap-1.5">
                      <Tag size={13} className="text-slate-400" />
                      <span className="text-slate-500 text-[11px]">Category:</span>
                      <select
                        className="input text-xs py-1 px-2 font-semibold"
                        value={selectedEmail.category}
                        onChange={(e) => handleReclassify(e.target.value)}
                        title="Reclassify email into another category"
                      >
                        <optgroup label="Relevant HR Categories">
                          <option value="HR_RECRUITER">HR Recruiter</option>
                          <option value="INTERVIEW_INVITATION">Interview Invitation</option>
                          <option value="APPLICATION_CONFIRMATION">Application Confirmation</option>
                          <option value="ASSESSMENT">Assessment / Test</option>
                          <option value="OFFER_RECEIVED">Offer Received</option>
                          <option value="REJECTION">Rejection</option>
                        </optgroup>
                        <optgroup label="Non-HR / Exclude from Dashboard">
                          <option value="JOB_ALERT">Job Alert</option>
                          <option value="MARKETING">Marketing</option>
                          <option value="NEWSLETTER">Newsletter</option>
                          <option value="PERSONAL">Personal</option>
                          <option value="SPAM">Spam</option>
                          <option value="OTHER">Other / Review</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* Manual Review Alert banner if applicable */}
                  {selectedEmail.needs_manual_review && (
                    <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-2 text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>
                          <strong>Low Confidence ({Math.round(selectedEmail.confidence_score * 100)}%):</strong>{" "}
                          {selectedEmail.classification_reasoning || "Please confirm or reclassify this email above."}
                        </span>
                      </div>
                      <button
                        onClick={() => handleReclassify(selectedEmail.category)}
                        className="btn text-xs py-1 px-2.5 bg-amber-600 hover:bg-amber-700 text-white shrink-0 ml-2"
                      >
                        Confirm as {CATEGORY_META[selectedEmail.category]?.label || "Valid"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Email Body: Isolated Iframe Viewer */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  <EmailViewer html={selectedEmail.body_html || `<p>${selectedEmail.body_preview}</p>`} />
                </div>

                {/* Reply Composer Station */}
                <div className="shrink-0 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>
                      Reply to: <strong>{selectedEmail.sender_email}</strong>
                    </span>
                    <span className="text-[11px] text-slate-400">Sent directly via connected Gmail</span>
                  </div>

                  <textarea
                    rows={3}
                    className="input w-full resize-none text-xs leading-relaxed"
                    placeholder={`Write your reply to ${selectedEmail.sender_name || 'recruiter'}…`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Ctrl+Enter to send</span>
                    <button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || sendingReply}
                      className="btn text-xs flex items-center gap-1.5 py-1.5 px-3"
                    >
                      <Send size={13} className={sendingReply ? "animate-spin" : ""} />
                      <span>{sendingReply ? "Dispatching..." : "Send Reply"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
