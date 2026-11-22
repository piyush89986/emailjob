import { useEffect, useRef, useState } from "react";
import {
  Globe,
  Sparkles,
  MessageSquare,
  Heart,
  Send,
  Lightbulb,
  ThumbsUp,
  Mail,
  Building,
  Copy,
  Check,
  Plus,
  Share2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  Clock,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  useS,
  fetchHubPosts,
  createHubPost,
  toggleLikePost,
  addPostComment,
  fetchHubChat,
  sendHubChatMessage,
  prepareApplyFromHub,
  fetchFeedbacks,
  submitFeedback,
  voteFeedback,
  sendPosterApplication,
  toast,
  type HubPost,
  type HubComment,
  type HubChatMessage,
  type FeedbackItem,
  type RoleResume,
} from "@/lib/store";

export default function Hub() {
  const user = useS((s) => s.user);
  const hubPosts = useS((s) => s.hubPosts);
  const hubChat = useS((s) => s.hubChat);
  const feedbacks = useS((s) => s.feedbacks);
  const roleResumes = useS((s) => s.roleResumes);

  // Active Hub Tab: "posts" | "chat" | "feedback"
  const [activeTab, setActiveTab] = useState<"posts" | "chat" | "feedback">("posts");

  // Loading states
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);

  // --- POSTS STATE ---
  const [searchPost, setSearchPost] = useState("");
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [expandedJds, setExpandedJds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Post Modal
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostData, setNewPostData] = useState({
    title: "",
    company: "",
    hr_email: "",
    location: "",
    skills: "",
    jd: "",
    image_url: "",
  });
  const [submittingPost, setSubmittingPost] = useState(false);

  // 1-Click Apply Confirmation Modal
  const [applyModalData, setApplyModalData] = useState<{
    post: HubPost;
    prepData: any;
    selectedResumeId: string;
    subject: string;
    bodyHtml: string;
  } | null>(null);
  const [preparingApplyPostId, setPreparingApplyPostId] = useState<string | null>(null);
  const [sendingApplication, setSendingApplication] = useState(false);

  // Image Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // --- CHAT STATE ---
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // --- FEEDBACK STATE ---
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState("all");
  const [feedbackForm, setFeedbackForm] = useState({
    title: "",
    category: "Feature Request",
    impact: "High Impact",
    description: "",
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Initial load
  useEffect(() => {
    setLoadingPosts(true);
    fetchHubPosts().finally(() => setLoadingPosts(false));

    setLoadingChat(true);
    fetchHubChat().finally(() => setLoadingChat(false));

    setLoadingFeedbacks(true);
    fetchFeedbacks().finally(() => setLoadingFeedbacks(false));
  }, []);

  // Poll chat every 6 seconds when chat tab is active
  useEffect(() => {
    if (activeTab !== "chat") return;
    const interval = setInterval(() => {
      fetchHubChat();
    }, 6000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [hubChat, activeTab]);

  const handleCopyEmail = (email: string, id: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    toast("Recruiter email copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLike = async (postId: string) => {
    await toggleLikePost(postId);
  };

  const handleAddComment = async (postId: string) => {
    const text = (newCommentText[postId] || "").trim();
    if (!text) {
      toast("Please enter a comment", "err");
      return;
    }
    await addPostComment(postId, text);
    setNewCommentText((prev) => ({ ...prev, [postId]: "" }));
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostData.title || !newPostData.company || !newPostData.hr_email) {
      toast("Title, Company, and HR Email are required", "err");
      return;
    }
    setSubmittingPost(true);
    try {
      const skillsArray = newPostData.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await createHubPost({
        title: newPostData.title,
        company: newPostData.company,
        hr_email: newPostData.hr_email,
        location: newPostData.location || undefined,
        skills: skillsArray,
        jd: newPostData.jd || undefined,
        image_url: newPostData.image_url || undefined,
        post_type: "manual",
      });
      setShowNewPostModal(false);
      setNewPostData({
        title: "",
        company: "",
        hr_email: "",
        location: "",
        skills: "",
        jd: "",
        image_url: "",
      });
    } catch {
      // toast handled in store
    } finally {
      setSubmittingPost(false);
    }
  };

  // 1-Click Apply Flow
  const handleInitiateApply = async (post: HubPost) => {
    setPreparingApplyPostId(post.id);
    try {
      const prep = await prepareApplyFromHub(post.id);
      const chosenResumeId = prep.selected_resume?.id || roleResumes[0]?.id || "";
      setApplyModalData({
        post,
        prepData: prep,
        selectedResumeId: chosenResumeId,
        subject: prep.email_draft?.subject || `Application for ${post.title} - ${user?.name || "Candidate"}`,
        bodyHtml: prep.email_draft?.body || `<p>Dear Hiring Team,</p><p>I am excited to submit my application for the <strong>${post.title}</strong> role at <strong>${post.company}</strong>.</p><p>Best regards,<br/>${user?.name || "Candidate"}</p>`,
      });
    } catch {
      // toast handled in store
    } finally {
      setPreparingApplyPostId(null);
    }
  };

  const handleConfirmAndSendApplication = async () => {
    if (!applyModalData) return;
    setSendingApplication(true);
    try {
      const { post, selectedResumeId, subject, bodyHtml } = applyModalData;
      await sendPosterApplication(post.id, {
        toEmail: post.hr_email,
        subject,
        bodyHtml,
        resumeId: selectedResumeId,
        extractedData: {
          job_title: post.title,
          company_name: post.company,
          hr_email: post.hr_email,
          location: post.location || "",
          required_skills: post.skills || [],
          job_responsibilities: [],
          candidate_requirements: [],
          confidence_score: 1.0,
          requires_manual_verification: false,
        },
        generatedJd: post.jd || "",
      });
      toast(`🚀 Application dispatched to ${post.hr_email} via Gmail!`);
      setApplyModalData(null);
    } catch (err: any) {
      toast(err.message || "Failed to dispatch application", "err");
    } finally {
      setSendingApplication(false);
    }
  };

  // Chat send
  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    if (text.length > 2000) {
      toast("Message exceeds 2000 characters limit", "err");
      return;
    }
    setSendingChat(true);
    try {
      await sendHubChatMessage(text);
      setChatInput("");
    } catch {
      // handled
    } finally {
      setSendingChat(false);
    }
  };

  // Feedback submit
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackForm.title.trim() || !feedbackForm.description.trim()) {
      toast("Title and description are required", "err");
      return;
    }
    setSubmittingFeedback(true);
    try {
      await submitFeedback({
        category: feedbackForm.category,
        title: feedbackForm.title.trim(),
        description: feedbackForm.description.trim(),
        impact: feedbackForm.impact,
      });
      setShowFeedbackModal(false);
      setFeedbackForm({
        title: "",
        category: "Feature Request",
        impact: "High Impact",
        description: "",
      });
    } catch {
      // handled
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const filteredPosts = hubPosts.filter((p) => {
    if (!searchPost.trim()) return true;
    const query = searchPost.toLowerCase();
    return (
      p.title.toLowerCase().includes(query) ||
      p.company.toLowerCase().includes(query) ||
      p.hr_email.toLowerCase().includes(query) ||
      (p.skills || []).some((s) => s.toLowerCase().includes(query))
    );
  });

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (feedbackCategoryFilter === "all") return true;
    return f.category.toLowerCase() === feedbackCategoryFilter.toLowerCase();
  });

  const currentUserId = (user as any)?.id || user?.email || "";

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      {/* Top Header & Tab Navigation Bar */}
      <div className="shrink-0 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Globe size={18} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Community Hub
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Crowdsourced recruiter openings, peer group chat & platform improvement suggestions.
            </p>
          </div>

          {/* Action Button based on Active Tab */}
          <div className="flex items-center gap-2">
            {activeTab === "posts" && (
              <button
                onClick={() => setShowNewPostModal(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Share Job Lead</span>
              </button>
            )}
            {activeTab === "feedback" && (
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
              >
                <Lightbulb size={14} />
                <span>Suggest Improvement</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab("posts")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "posts"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <Share2 size={13} />
            <span>Job Leads Feed</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === "posts"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              }`}
            >
              {hubPosts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("chat")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "chat"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <MessageSquare size={13} />
            <span>Group Chat</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab("feedback")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "feedback"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <Lightbulb size={13} />
            <span>Product Improvements</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === "feedback"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              }`}
            >
              {feedbacks.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT 1: SHARED JOB POSTS FEED */}
      {activeTab === "posts" && (
        <div className="flex-1 min-h-0 overflow-y-auto pt-3 pb-6 flex flex-col">
          {/* Search bar */}
          <div className="mb-4">
            <input
              type="text"
              value={searchPost}
              onChange={(e) => setSearchPost(e.target.value)}
              placeholder="Search by role, company name, HR email, or tech stack..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
            />
          </div>

          {loadingPosts && (
            <div className="py-12 text-center text-xs text-slate-400">Loading community job feed...</div>
          )}

          {!loadingPosts && filteredPosts.length === 0 && (
            <div className="my-auto text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
              <Globe size={28} className="mx-auto text-slate-400 mb-2" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No job leads found
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Whenever you or anyone applies via Apply Studio (poster or direct email), the opening is automatically shared here for the community!
              </p>
              <button
                onClick={() => setShowNewPostModal(true)}
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
              >
                <Plus size={13} />
                <span>Share First Lead</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPosts.map((post) => {
              const isLiked = post.likes.includes(currentUserId);
              const isCommentsOpen = !!expandedComments[post.id];
              const isJdOpen = !!expandedJds[post.id];
              const hasPosterImage = Boolean(post.image_url);

              return (
                <div
                  key={post.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div>
                    {/* Header: Submitter + Type Badge */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-bold">
                          {post.user_name ? post.user_name[0].toUpperCase() : "U"}
                        </div>
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {post.user_name}
                        </span>
                        <span>•</span>
                        <span>{new Date(post.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {post.post_type === "poster" ? "Hiring Poster" : "Direct HR Lead"}
                      </span>
                    </div>

                    {/* Job Title & Company */}
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {post.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
                      <Building size={13} />
                      <span>{post.company}</span>
                      {post.location && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-slate-500 dark:text-slate-400">{post.location}</span>
                        </>
                      )}
                    </div>

                    {/* HR Email Capsule Pill with Copy Button */}
                    <div className="mt-2.5 flex items-center justify-between rounded-xl bg-slate-50 p-2 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Mail size={13} className="text-indigo-500 shrink-0" />
                        <span className="truncate text-xs font-mono font-medium text-slate-700 dark:text-slate-200">
                          {post.hr_email}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyEmail(post.hr_email, post.id)}
                        title="Copy Recruiter Email"
                        className="rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        {copiedId === post.id ? (
                          <Check size={13} className="text-emerald-500" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>

                    {/* Poster Image preview if available */}
                    {hasPosterImage && (
                      <div className="mt-3 relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-36 bg-slate-950 flex items-center justify-center">
                        <img
                          src={post.image_url!}
                          alt={post.title}
                          className="w-full object-cover max-h-36 group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                          onClick={() => setLightboxImage(post.image_url!)}
                        />
                        <button
                          onClick={() => setLightboxImage(post.image_url!)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1 transition-opacity cursor-pointer"
                        >
                          <ExternalLink size={14} />
                          <span>View Full Poster</span>
                        </button>
                      </div>
                    )}

                    {/* Skills pills */}
                    {post.skills && post.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {post.skills.slice(0, 6).map((skill, idx) => (
                          <span
                            key={idx}
                            className="rounded-md bg-indigo-50/80 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50"
                          >
                            {skill}
                          </span>
                        ))}
                        {post.skills.length > 6 && (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            +{post.skills.length - 6} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* JD snippet */}
                    {post.jd && (
                      <div className="mt-2.5">
                        <div
                          className={`text-xs text-slate-600 dark:text-slate-300 leading-relaxed ${
                            isJdOpen ? "" : "line-clamp-2"
                          }`}
                        >
                          {post.jd}
                        </div>
                        <button
                          onClick={() =>
                            setExpandedJds((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                          }
                          className="mt-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          {isJdOpen ? (
                            <>
                              <span>Show less</span>
                              <ChevronUp size={12} />
                            </>
                          ) : (
                            <>
                              <span>Show full description</span>
                              <ChevronDown size={12} />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions Row: Likes, Comments Toggle, and 1-Click Apply */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Like Capsule Button */}
                      <button
                        onClick={() => handleLike(post.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                          isLiked
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                            : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Heart
                          size={13}
                          className={isLiked ? "fill-rose-500 text-rose-500" : ""}
                        />
                        <span>{post.likes.length}</span>
                      </button>

                      {/* Comments Capsule Button */}
                      <button
                        onClick={() =>
                          setExpandedComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                        }
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <MessageSquare size={13} />
                        <span>{post.comments.length}</span>
                      </button>
                    </div>

                    {/* 1-Click Apply Capsule Button */}
                    <button
                      onClick={() => handleInitiateApply(post)}
                      disabled={preparingApplyPostId === post.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:from-indigo-500 hover:to-violet-500 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {preparingApplyPostId === post.id ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Matching...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          <span>Apply</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expandable Comments Drawer */}
                  {isCommentsOpen && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                        {post.comments.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">No comments yet. Be the first to reply!</p>
                        ) : (
                          post.comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/50"
                            >
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {comment.user_name}
                                </span>
                                <span>{new Date(comment.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300">{comment.text}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add Comment Input */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newCommentText[post.id] || ""}
                          onChange={(e) =>
                            setNewCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddComment(post.id);
                          }}
                          placeholder="Write a comment..."
                          className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: GROUP CHAT */}
      {activeTab === "chat" && (
        <div className="flex-1 min-h-0 flex flex-col pt-2 pb-2">
          {/* Group Chat Banner */}
          <div className="shrink-0 mb-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-2.5 text-xs text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                <strong>BJob Community Lounge</strong>: Real-time discussion for recruiter leads, interview questions, and referral exchanges.
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live</span>
            </div>
          </div>

          {/* Messages Feed Area */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-3 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
            {loadingChat && (
              <div className="py-12 text-center text-xs text-slate-400">Loading conversation...</div>
            )}

            {!loadingChat && hubChat.length === 0 && (
              <div className="py-16 text-center text-xs text-slate-400">
                <MessageSquare size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No messages yet!</p>
                <p className="mt-1 text-slate-400">Say hi or share an opening with fellow members.</p>
              </div>
            )}

            {hubChat.map((msg) => {
              const isMe = msg.user_id === currentUserId || msg.user_email === user?.email;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isMe ? "justify-end" : "justify-start"}`}
                >
                  {!isMe && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-bold">
                      {msg.user_name ? msg.user_name[0].toUpperCase() : "U"}
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[78%] ${isMe ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {isMe ? "You" : msg.user_name}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                        isMe
                          ? "bg-indigo-600 text-white rounded-tr-xs"
                          : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 rounded-tl-xs"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>

                  {isMe && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold">
                      {user?.name ? user.name[0].toUpperCase() : "Y"}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Bar with Validation */}
          <form onSubmit={handleSendChat} className="mt-3 shrink-0 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message the community (max 2000 chars)..."
              maxLength={2000}
              className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={sendingChat || !chatInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
            >
              {sendingChat ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Send size={13} />
              )}
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB CONTENT 3: PRODUCT IMPROVEMENTS & FEEDBACK */}
      {activeTab === "feedback" && (
        <div className="flex-1 min-h-0 overflow-y-auto pt-3 pb-6 flex flex-col">
          {/* Subheader & Category Filter Pills */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {["all", "Feature Request", "UI/UX", "Workflow & Engine", "Gmail Sync", "Bug Report"].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setFeedbackCategoryFilter(cat)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer capitalize ${
                      feedbackCategoryFilter === cat
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {cat === "all" ? "All Categories" : cat}
                  </button>
                )
              )}
            </div>
          </div>

          {loadingFeedbacks && (
            <div className="py-12 text-center text-xs text-slate-400">Loading suggestions...</div>
          )}

          {!loadingFeedbacks && filteredFeedbacks.length === 0 && (
            <div className="my-auto text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
              <Lightbulb size={28} className="mx-auto text-amber-500 mb-2" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                What can be improved in BJob?
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Help us make BJob faster and better. Suggest an improvement, report UI rough edges, or vote on upcoming features!
              </p>
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
              >
                <Plus size={13} />
                <span>Submit Idea</span>
              </button>
            </div>
          )}

          <div className="space-y-3">
            {filteredFeedbacks.map((item) => {
              const hasVoted = item.votes.includes(currentUserId);
              const statusColors: Record<string, string> = {
                under_review: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
                planned: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
                in_progress: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900",
                completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
              };

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex items-start gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  {/* Upvote Button on Left */}
                  <button
                    onClick={() => voteFeedback(item.id)}
                    className={`flex flex-col items-center justify-center rounded-xl px-2.5 py-2 border transition-all cursor-pointer ${
                      hasVoted
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <ThumbsUp size={14} className={hasVoted ? "fill-indigo-600 text-indigo-600" : ""} />
                    <span className="text-xs font-bold mt-1">{item.votes.length}</span>
                  </button>

                  {/* Feedback Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {item.category}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          statusColors[item.status] || statusColors.under_review
                        }`}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                      {item.impact && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {item.impact}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {item.description}
                    </p>

                    <div className="mt-2 text-[10px] text-slate-400">
                      Suggested by {item.user_name} • {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: 1-CLICK APPLY PERMISSION & REVIEW MODAL */}
      {applyModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Apply to {applyModalData.post.company}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Review and confirm before dispatching via your connected Gmail.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApplyModalData(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3.5 space-y-3 flex-1">
              {/* Target info */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-800 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Role: {applyModalData.post.title}
                  </span>
                  <span className="text-slate-500">{applyModalData.post.company}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Mail size={13} className="text-indigo-500" />
                  <span className="font-mono font-medium">{applyModalData.post.hr_email}</span>
                </div>
              </div>

              {/* Resume Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Select Role Resume to Attach:
                </label>
                <select
                  value={applyModalData.selectedResumeId}
                  onChange={(e) =>
                    setApplyModalData((prev) =>
                      prev ? { ...prev, selectedResumeId: e.target.value } : null
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  {roleResumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.role} ({r.filename}) {r.isDefault ? "★ Default" : ""}
                    </option>
                  ))}
                  {roleResumes.length === 0 && (
                    <option value="">No custom role resume uploaded (Standard Profile will be attached)</option>
                  )}
                </select>
              </div>

              {/* Email Subject */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Subject Line:
                </label>
                <input
                  type="text"
                  value={applyModalData.subject}
                  onChange={(e) =>
                    setApplyModalData((prev) =>
                      prev ? { ...prev, subject: e.target.value } : null
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Email Body Draft */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Personalized Email Body:
                </label>
                <textarea
                  rows={6}
                  value={applyModalData.bodyHtml.replace(/<[^>]+>/g, "\n").trim()}
                  onChange={(e) =>
                    setApplyModalData((prev) =>
                      prev ? { ...prev, bodyHtml: `<p>${e.target.value.replace(/\n/g, "<br/>")}</p>` } : null
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Permission & Confirmation Alert Banner */}
              <div className="rounded-xl border border-amber-300/80 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2">
                <ShieldCheck size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">User Permission Required:</span>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    By confirming, BJob will send this email directly from your connected Gmail address with your selected resume PDF attached, and track replies automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setApplyModalData(null)}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSendApplication}
                disabled={sendingApplication}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
              >
                {sendingApplication ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Dispatching via Gmail...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Authorize & Send via Gmail</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SHARE NEW JOB OPENING MODAL */}
      {showNewPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreatePost}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Share2 size={16} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Share Job Opening with Community
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPostModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3.5 space-y-2.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Job Title / Role *
                </label>
                <input
                  type="text"
                  required
                  value={newPostData.title}
                  onChange={(e) => setNewPostData({ ...newPostData, title: e.target.value })}
                  placeholder="e.g. Frontend Engineer, MERN Developer"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPostData.company}
                    onChange={(e) => setNewPostData({ ...newPostData, company: e.target.value })}
                    placeholder="e.g. Nexes, Swiggy"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    HR Recruiter Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newPostData.hr_email}
                    onChange={(e) => setNewPostData({ ...newPostData, hr_email: e.target.value })}
                    placeholder="recruiter@company.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Required Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={newPostData.skills}
                  onChange={(e) => setNewPostData({ ...newPostData, skills: e.target.value })}
                  placeholder="React, Node.js, TypeScript, Docker"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Job Description / Notes
                </label>
                <textarea
                  rows={3}
                  value={newPostData.jd}
                  onChange={(e) => setNewPostData({ ...newPostData, jd: e.target.value })}
                  placeholder="Brief details about the role or requirements..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewPostModal(false)}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPost}
                className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {submittingPost ? "Posting..." : "Share with Hub"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: SUBMIT FEEDBACK & IMPROVEMENT MODAL */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSubmitFeedback}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Lightbulb size={16} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Suggest Platform Improvement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3.5 space-y-2.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Improvement Title *
                </label>
                <input
                  type="text"
                  required
                  value={feedbackForm.title}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, title: e.target.value })}
                  placeholder="e.g. Add dark mode table contrast, WhatsApp follow-ups"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Category
                  </label>
                  <select
                    value={feedbackForm.category}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="Feature Request">Feature Request</option>
                    <option value="UI/UX">UI/UX Design</option>
                    <option value="Workflow & Engine">Workflow & Engine</option>
                    <option value="Gmail Sync">Gmail Sync</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Impact
                  </label>
                  <select
                    value={feedbackForm.impact}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, impact: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="High Impact">High Impact</option>
                    <option value="Nice to have">Nice to have</option>
                    <option value="Critical fix">Critical fix</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  What can be improved & why? *
                </label>
                <textarea
                  rows={4}
                  required
                  value={feedbackForm.description}
                  onChange={(e) =>
                    setFeedbackForm({ ...feedbackForm, description: e.target.value })
                  }
                  placeholder="Explain how this feature or fix will improve your job application workflow..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingFeedback}
                className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {submittingFeedback ? "Submitting..." : "Submit Suggestion"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POSTER LIGHTBOX */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-black">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/90 cursor-pointer z-10"
            >
              <X size={18} />
            </button>
            <img
              src={lightboxImage}
              alt="Full Poster"
              className="max-h-[90vh] w-auto object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
