import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  ExternalLink,
  Send,
  Building2,
  Briefcase,
  Sparkles,
  Inbox as InboxIcon,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import {
  fetchHRInbox,
  markHREmailRead,
  reclassifyHREmail,
  replyHREmail,
  syncHRInbox,
  useS,
  HRInboxItem,
  toast,
} from "@/lib/store";
import { Page, Skeleton, Empty, fmt } from "@/components/ui";

// Category visual metadata
interface CatMeta {
  label: string;
  badgeClass: string;
}

const CATEGORY_META: Record<string, CatMeta> = {
  HR_RECRUITER: {
    label: "HR Recruiter",
    badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
  },
  INTERVIEW_INVITATION: {
    label: "Interview",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
  },
  APPLICATION_CONFIRMATION: {
    label: "Application",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  },
  ASSESSMENT: {
    label: "Assessment / Test",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
  },
  REJECTION: {
    label: "Rejection",
    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
  },
  OFFER_RECEIVED: {
    label: "Offer 🎉",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold",
  },
  JOB_ALERT: {
    label: "Job Opportunity",
    badgeClass: "bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-200 dark:border-teal-800",
  },
  MARKETING: {
    label: "Marketing",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
  },
  NEWSLETTER: {
    label: "Newsletter",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
  },
  SPAM: {
    label: "Spam",
    badgeClass: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
  },
  PERSONAL: {
    label: "Personal",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
  },
  OTHER: {
    label: "Review Needed",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-semibold",
  },
};

/**
 * Sandboxed, self-resizing iframe viewer to render rich HTML email without CSS leaking into main DOM
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
              padding: 14px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              background-color: #ffffff;
              word-break: break-word;
              overflow-x: auto;
              font-size: 13.5px;
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
    const t1 = setTimeout(resize, 250);
    const t2 = setTimeout(resize, 800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [html]);

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white shadow-xs min-h-[140px] my-1">
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hrEmails = useS((s) => s.hrInbox);
  const counts = useS((s) => s.hrCounts);

  // Load emails on mount and when filter changes
  useEffect(() => {
    setLoading(true);
    fetchHRInbox(activeFilter, searchTerm).finally(() => setLoading(false));
  }, [activeFilter]);

  // Handle search debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchHRInbox(activeFilter, searchTerm);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Auto-select first email on desktop
  useEffect(() => {
    if (!selectedEmailId && hrEmails.length > 0 && window.innerWidth >= 768) {
      setSelectedEmailId(hrEmails[0].id);
    }
  }, [hrEmails.length]);

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
      await fetchHRInbox(activeFilter, searchTerm);
      toast("HR Inbox synchronized with Gmail!");
    } catch {
      toast("Sync finished");
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
      toast("Reply dispatched via Gmail!");
    } catch {
      // toast handled in store
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

  const filterTabs = [
    { key: "all", label: "All", count: counts.all },
    { key: "received", label: "Received", count: counts.received ?? 0 },
    { key: "sent", label: "Sent", count: counts.sent ?? 0 },
    { key: "interviews", label: "Interviews", count: counts.interviews },
    { key: "applications", label: "Applications", count: counts.applications },
    { key: "rejections", label: "Rejections", count: counts.rejections },
    { key: "unread", label: "Unread", count: counts.unread },
    { key: "review", label: "Review Queue", count: counts.review },
  ];

  return (
    <Page
      title="HR Inbox"
      actions={
        <div className="flex items-center gap-2">
          <Link to="/inbox" className="btn-ghost text-xs text-slate-500">
            Open standard Inbox →
          </Link>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn text-xs py-1.5 px-3 flex items-center gap-1.5"
            title="Fetch and classify new recruiter emails from Gmail"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            <span>{syncing ? "Syncing..." : "Sync emails"}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col md:grid md:grid-cols-[360px_minmax(0,1fr)] gap-4 flex-1 min-h-0 h-full overflow-hidden w-full max-w-full">
        {/* Left Column: HR Email List (Matching Inbox.tsx 360px structure) */}
        <div
          className={`flex flex-col min-h-0 h-full w-full md:w-[360px] shrink-0 overflow-hidden ${
            selectedEmailId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search box */}
          <div className="shrink-0 mb-2">
            <input
              className="input w-full text-xs"
              placeholder="Search HR sender, company, role, or subject…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter tabs */}
          <div className="shrink-0 mb-2.5 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
            {filterTabs.map((tab) => {
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`rounded-full px-2.5 py-1 text-xs capitalize shrink-0 font-medium transition-colors flex items-center gap-1 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === "number" && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? "bg-white/25 text-white"
                          : "bg-slate-300/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* HR Emails List */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {loading ? (
              <Skeleton n={5} />
            ) : hrEmails.length === 0 ? (
              <Empty
                title="No HR emails found"
                hint="Only recruiter communications, job applications, interview invites, and opportunities appear here."
              />
            ) : (
              <div className="space-y-1.5 pb-2">
                {hrEmails.map((e) => {
                  const isSelected = selectedEmailId === e.id;
                  const isOut = e.direction === "out";
                  const meta = CATEGORY_META[e.category] || CATEGORY_META.OTHER;

                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEmailId(e.id)}
                      className={`card w-full text-left transition-all p-3 hover:border-slate-300 dark:hover:border-slate-700 ${
                        isSelected
                          ? "ring-2 ring-indigo-500 border-transparent shadow-sm bg-indigo-50/40 dark:bg-indigo-950/30"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-sm truncate flex items-center gap-1.5 ${
                            !e.is_read ? "font-bold text-indigo-600 dark:text-indigo-400" : "font-medium"
                          }`}
                        >
                          {isOut ? (
                            <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                              <ArrowUpRight size={13} className="text-indigo-500 shrink-0" />
                              <span className="truncate">To: {e.to_email || "Recruiter"}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-900 dark:text-white">
                              <ArrowDownLeft size={13} className="text-emerald-500 shrink-0" />
                              <span className="truncate">{e.sender_name || e.sender_email}</span>
                            </span>
                          )}
                        </span>

                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            isOut
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                          }`}
                        >
                          {isOut ? "Sent" : "Received"}
                        </span>
                      </div>

                      <div className="truncate text-sm font-medium mt-1 text-slate-800 dark:text-slate-200">
                        {e.subject || "(No subject)"}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                        {e.company && (
                          <span className="text-[10px] text-slate-500 truncate flex items-center gap-0.5">
                            <Building2 size={10} />
                            <span>{e.company}</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto shrink-0">{fmt(e.received_at)}</span>
                      </div>

                      <div className="truncate text-xs text-slate-500 mt-1">{e.body_preview || ""}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active HR Email & Reader (Matching Inbox.tsx structure) */}
        <div
          className={`flex flex-col min-h-0 h-full min-w-0 w-full overflow-hidden ${
            !selectedEmailId ? "hidden md:flex" : "flex"
          }`}
        >
          {!selectedEmail ? (
            <div className="card h-full flex flex-col items-center justify-center text-center p-8">
              <Empty
                title="Select an HR email"
                hint="Choose any recruiter or interview communication on the left to read and reply."
              />
            </div>
          ) : (
            <div className="card h-full flex flex-col min-h-0 min-w-0 w-full overflow-hidden p-4">
              {/* Header */}
              <div className="shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 md:hidden mb-2">
                  <button onClick={() => setSelectedEmailId(null)} className="btn-ghost text-xs py-1 px-2">
                    ← Back to list
                  </button>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-lg truncate leading-tight text-slate-900 dark:text-white">
                      {selectedEmail.subject || "(No subject)"}
                    </h2>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {selectedEmail.direction === "out" ? (
                        <span>
                          <strong>Sent To:</strong> {selectedEmail.to_email}
                        </span>
                      ) : (
                        <span>
                          <strong>From:</strong> {selectedEmail.sender_name} &lt;{selectedEmail.sender_email}&gt;
                        </span>
                      )}

                      {selectedEmail.company && (
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Building2 size={12} className="text-slate-400" />
                          <span>{selectedEmail.company}</span>
                        </span>
                      )}

                      {selectedEmail.job_title && (
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Briefcase size={12} className="text-slate-400" />
                          <span>{selectedEmail.job_title}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        selectedEmail.direction === "out"
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                      }`}
                    >
                      {selectedEmail.direction === "out" ? "Sent" : "Received"}
                    </span>

                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        CATEGORY_META[selectedEmail.category]?.badgeClass || CATEGORY_META.OTHER.badgeClass
                      }`}
                    >
                      {CATEGORY_META[selectedEmail.category]?.label || selectedEmail.category}
                    </span>

                    <a
                      href={gmailThreadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg"
                      title="Open in Gmail"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </div>

                {/* Manual Reclassification Dropdown */}
                <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-100/70 dark:border-slate-800/60">
                  <span className="text-[11px] text-slate-400">
                    {selectedEmail.direction === "out"
                      ? "Dispatched cold job application"
                      : selectedEmail.classification_reasoning || "Classified by AI Engine"}
                  </span>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400">Category:</span>
                    <select
                      className="input py-0.5 px-2 text-[11px]"
                      value={selectedEmail.category}
                      onChange={(e) => handleReclassify(e.target.value)}
                    >
                      <option value="HR_RECRUITER">HR Recruiter</option>
                      <option value="INTERVIEW_INVITATION">Interview Invitation</option>
                      <option value="APPLICATION_CONFIRMATION">Application Received</option>
                      <option value="ASSESSMENT">Assessment / Test</option>
                      <option value="OFFER_RECEIVED">Offer Received</option>
                      <option value="JOB_ALERT">Job Opportunity</option>
                      <option value="REJECTION">Rejection</option>
                      <option value="OTHER">Review Queue</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Email Content scroll view */}
              <div className="flex-1 min-h-0 overflow-y-auto py-3 pr-2 w-full min-w-0">
                <EmailViewer html={selectedEmail.body_html || `<p>${selectedEmail.body_preview}</p>`} />
                <div ref={messagesEndRef} />
              </div>

              {/* Reply box: pinned at bottom */}
              <div className="shrink-0 pt-3 border-t border-slate-100 dark:border-slate-800 w-full min-w-0">
                <textarea
                  className="input resize-none w-full text-xs"
                  rows={3}
                  placeholder={`Write a reply to ${
                    selectedEmail.direction === "out" ? selectedEmail.to_email : selectedEmail.sender_email
                  }… (Ctrl+Enter to send)`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Ctrl+Enter to send via connected Gmail</span>
                  <button
                    className="btn shrink-0 text-xs py-1.5 px-3 flex items-center gap-1.5"
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sendingReply}
                  >
                    <Send size={13} className={sendingReply ? "animate-spin" : ""} />
                    <span>{sendingReply ? "Sending..." : "Send reply"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
