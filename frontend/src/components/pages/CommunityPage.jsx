import { useEffect, useState } from "react";
import { useFlow } from "../../context/FlowContext";

function formatTime(value) {
  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  if (difference < 60_000) return "just now";
  if (difference < 3_600_000)
    return `${Math.max(1, Math.floor(difference / 60_000))} min`;
  if (difference < 86_400_000)
    return `${Math.floor(difference / 3_600_000)} hr`;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function initial(name) {
  return (name || "A").slice(0, 1).toUpperCase();
}

function feedIdFromPath() {
  const match = window.location.pathname.match(
    /^\/community\/feed\/([^/]+)\/?$/,
  );
  return match?.[1] || "";
}

function CommunitySidebar({ count, className }) {
  return (
    <aside className={className} data-count={count}>
      <div className="community-sidebar-content animate-community-card">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-on-primary shadow-[0_8px_20px_rgb(44,107,39,0.28)]">
          <span className="material-symbols-outlined text-3xl">forum</span>
        </div>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
          Careflow Community
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-on-surface">
          Circle Feed
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
          A community space to share stories and support one another in a way
          that is safe and full of empathy.
        </p>
        <div className="mt-6 border-t border-primary-container pt-4 text-xs font-semibold text-on-surface-variant">
          {count} stories shared
        </div>
      </div>
    </aside>
  );
}

export default function CommunityPage() {
  const {
    authUser,
    communityPosts,
    loadCommunity,
    loadCommunityPost,
    createCommunityPost,
    addCommunityComment,
    toggleCommunityLike,
    recordCommunityShare,
    authError,
    setAuthError,
    startLogin,
  } = useFlow();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [feedId, setFeedId] = useState(feedIdFromPath);
  const [detailPost, setDetailPost] = useState(null);

  useEffect(() => {
    if (authUser?.role !== "user") {
      setLoading(false);
      return;
    }
    loadCommunity().finally(() => setLoading(false));
  }, [authUser?.id]);
  useEffect(() => {
    const syncFeedRoute = () => setFeedId(feedIdFromPath());
    window.addEventListener("popstate", syncFeedRoute);
    return () => window.removeEventListener("popstate", syncFeedRoute);
  }, []);
  useEffect(() => {
    if (!feedId || !["user", "psychologist"].includes(authUser?.role)) {
      setDetailPost(null);
      return;
    }
    setLoading(true);
    loadCommunityPost(feedId)
      .then(setDetailPost)
      .catch((error) => setAuthError(error.message))
      .finally(() => setLoading(false));
  }, [feedId, authUser?.id]);

  const posts = feedId ? (detailPost ? [detailPost] : []) : communityPosts;
  const openFeed = (postId) => {
    window.history.pushState({}, "", `/community/feed/${postId}`);
    setFeedId(postId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const closeFeed = () => {
    window.history.pushState({}, "", "/community/");
    setFeedId("");
    setDetailPost(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const publish = async (input) => {
    setAuthError("");
    await createCommunityPost(input);
    setNotice(
      input.isAnonymous
        ? "Your anonymous story has been shared safely."
        : "Your story has been shared to the Circle Feed.",
    );
  };
  const like = async (post) => {
    setAuthError("");
    const result = await toggleCommunityLike(post.id);
    if (feedId)
      setDetailPost((current) =>
        current
          ? {
              ...current,
              likedByMe: result.liked,
              likeCount: Math.max(
                0,
                current.likeCount + (result.liked ? 1 : -1),
              ),
            }
          : current,
      );
  };
  const comment = async (postId, body) => {
    setAuthError("");
    await addCommunityComment(postId, body);
    if (feedId) setDetailPost(await loadCommunityPost(postId));
  };
  const share = async (post) => {
    setAuthError("");
    await recordCommunityShare(post.id);
    if (feedId)
      setDetailPost((current) =>
        current ? { ...current, shareCount: current.shareCount + 1 } : current,
      );
    const url = new URL(
      `/community/feed/${post.id}`,
      window.location.origin,
    ).toString();
    const text = `${post.authorName}: ${post.body}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: "A story from Careflow Community",
          text,
          url,
        });
      else if (navigator.clipboard) await navigator.clipboard.writeText(url);
      setNotice("The story link is ready to share.");
    } catch (error) {
      if (error?.name !== "AbortError")
        setNotice(
          "Share recorded. Copy the link from this page if needed.",
        );
    }
  };

  if (!authUser)
    return (
      <section className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-xl items-center px-4 py-10">
        <div className="w-full rounded-[2rem] bg-surface-container-lowest p-8 text-center shadow-[0_5px_0_#121214]">
          <span className="material-symbols-outlined text-5xl text-primary">
            diversity_3
          </span>
          <h1 className="mt-4 text-3xl font-bold text-on-surface">
            Sign in to join
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Careflow Community is a safe space to share, give support, and grow
            together.
          </p>
          <button
            type="button"
            onClick={startLogin}
            className="community-tap mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-on-primary shadow-[0_10px_24px_rgb(44,107,39,0.28)]"
          >
            Sign in to Careflow
          </button>
        </div>
      </section>
    );

  return (
    <section className="w-full py-7">
      <div className="mt-6 min-h-[calc(100vh-8rem)] w-full lg:pl-[22rem]">
        <CommunitySidebar
          count={communityPosts.length}
          className="h-fit rounded-[2rem] border border-primary-container bg-gradient-to-b from-primary-container via-surface-container-lowest to-surface-container-lowest p-6 shadow-[0_4px_0_#121214] sm:mx-6 lg:fixed lg:top-20 lg:bottom-0 lg:left-0 lg:z-[60] lg:h-[calc(100vh-5rem)] lg:w-[22rem] lg:overflow-hidden lg:rounded-none lg:border-y-0 lg:border-l-0 lg:border-r lg:border-primary-container lg:p-8 lg:shadow-none"
        />
        <main className="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-4 pb-8 sm:px-6 lg:px-10">
          {authError && (
            <p
              role="alert"
              className="animate-community-panel rounded-2xl bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container"
            >
              {authError}
            </p>
          )}
          {notice && (
            <div className="animate-community-panel flex items-center justify-between gap-3 rounded-2xl bg-primary-container px-4 py-3 text-sm font-semibold text-on-primary-container">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Close message"
                className="community-tap rounded-full p-1 hover:bg-white/30"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}
          {!feedId && authUser.role === "user" && (
            <PostComposer onPublish={publish} authUser={authUser} />
          )}
          <div className="flex items-center justify-between gap-3">
            <div>
              {feedId && authUser.role !== "psychologist" ? (
                <button
                  type="button"
                  onClick={closeFeed}
                  className="community-tap mb-2 inline-flex items-center gap-1 rounded-full bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-high"
                >
                  <span className="material-symbols-outlined text-base">
                    arrow_back
                  </span>
                  Back to Community
                </button>
              ) : null}
              <h2 className="text-xl font-bold text-on-surface">
                {feedId ? "Story details" : "Circle Feed"}
              </h2>
              <p className="text-xs text-on-surface-variant">
                {feedId
                  ? "Read the story and community responses with more focus."
                  : "The latest stories from a space that looks out for each other."}
              </p>
            </div>
            {feedId && authUser.role === "psychologist" ? (
              <button
                type="button"
                onClick={() => window.history.back()}
                className="community-tap inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  arrow_back
                </span>
                Back to Psychologist Panel
              </button>
            ) : null}
            {!feedId && (
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  loadCommunity().finally(() => setLoading(false));
                }}
                className="community-tap flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface shadow-[0_2px_6px_rgb(27,27,29,0.08)] hover:bg-surface-container-high"
                aria-label="Reload community"
              >
                <span
                  className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`}
                >
                  refresh
                </span>
              </button>
            )}
          </div>
          {loading ? (
            <FeedSkeleton />
          ) : posts.length === 0 ? (
            <EmptyFeed detail={Boolean(feedId)} />
          ) : (
            posts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                index={index}
                onLike={() => like(post)}
                onComment={comment}
                onShare={() => share(post)}
                onOpen={() => openFeed(post.id)}
                forceCommentsOpen={Boolean(feedId)}
                readOnly={authUser.role === "psychologist"}
              />
            ))
          )}
        </main>
      </div>
    </section>
  );
}

function PostComposer({ onPublish, authUser }) {
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [media, setMedia] = useState(null);
  const [mediaError, setMediaError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const chooseMedia = (event) => {
    const file = event.target.files?.[0];
    setMediaError("");
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setMediaError("Choose a photo or video file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setMediaError("Photo or video size can be at most 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setMedia({
        name: file.name,
        type: file.type,
        data: String(reader.result),
      });
    reader.onerror = () =>
      setMediaError("The media could not be read. Try another file.");
    reader.readAsDataURL(file);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setPublishing(true);
    try {
      await onPublish({
        body,
        topicTag: "Safe space",
        isAnonymous,
        mediaMime: media?.type || "",
        mediaData: media?.data || "",
      });
      setBody("");
      setMedia(null);
      setIsAnonymous(false);
    } catch (error) {
      setMediaError(
        error.message || "The post could not be shared. Please try again.",
      );
    } finally {
      setPublishing(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      aria-busy={publishing}
      className="community-composer-shell relative rounded-[2rem] border border-surface-container bg-surface-container-lowest p-5 shadow-[0_8px_24px_rgb(27,27,29,0.06)] transition-shadow sm:p-6"
    >
      {publishing && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[2rem] bg-surface-container-lowest/90 text-center backdrop-blur-md">
          <span className="material-symbols-outlined animate-spin text-3xl text-primary">
            progress_activity
          </span>
          <strong className="mt-2 text-sm text-on-surface">
            Sharing your story…
          </strong>
          <span className="mt-1 text-xs text-on-surface-variant">
            Please wait a moment, don't close the page.
          </span>
        </div>
      )}
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold transition-colors duration-300 ${isAnonymous ? "bg-inverse-surface text-inverse-on-surface" : "bg-primary-container text-on-primary-container"}`}
        >
          {isAnonymous ? (
            <span className="material-symbols-outlined">visibility_off</span>
          ) : (
            initial(authUser?.name)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="community-post">
            Share your story
          </label>
          <textarea
            id="community-post"
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength="2000"
            rows="3"
            placeholder="What would you like to share today?"
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-on-surface outline-none placeholder:text-on-surface-variant/70"
          />
        </div>
      </div>
      {media && (
        <div className="animate-community-panel relative mt-4 overflow-hidden rounded-2xl bg-surface-container">
          <button
            type="button"
            onClick={() => setMedia(null)}
            className="community-tap absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-inverse-surface text-inverse-on-surface shadow-[0_2px_6px_rgb(27,27,29,0.18)]"
            aria-label="Remove media"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
          {media.type.startsWith("video/") ? (
            <video
              src={media.data}
              controls
              className="max-h-80 w-full object-cover"
            />
          ) : (
            <img
              src={media.data}
              alt="Post attachment preview"
              className="max-h-80 w-full object-cover"
            />
          )}
        </div>
      )}
      {mediaError && (
        <p className="animate-community-panel mt-3 text-xs font-semibold text-error">{mediaError}</p>
      )}
      <div className="mt-4 flex flex-col gap-3 border-t border-surface-container pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="community-tap cursor-pointer rounded-full bg-surface-container px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-high">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              onChange={chooseMedia}
              className="sr-only"
            />
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">
                perm_media
              </span>
              Photo / video
            </span>
          </label>
          <button
            type="button"
            onClick={() => setIsAnonymous((value) => !value)}
            aria-pressed={isAnonymous}
            className={`community-tap rounded-full px-3 py-2 text-xs font-bold ${isAnonymous ? "bg-inverse-surface text-inverse-on-surface" : "bg-surface-container text-on-surface-variant"}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">
                {isAnonymous ? "visibility_off" : "person"}
              </span>
              {isAnonymous ? "Posting anonymously" : "Show name"}
            </span>
          </button>
        </div>
        <button
          disabled={publishing || !body.trim()}
          className="community-tap rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-on-primary shadow-[0_8px_20px_rgb(44,107,39,0.28)] disabled:opacity-50 disabled:shadow-none"
        >
          {publishing ? "Sharing…" : "Share story"}
        </button>
      </div>
    </form>
  );
}

function PostCard({
  post,
  index = 0,
  onLike,
  onComment,
  onShare,
  onOpen,
  forceCommentsOpen = false,
  readOnly = false,
}) {
  const [commentsOpen, setCommentsOpen] = useState(forceCommentsOpen);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [likeBurstKey, setLikeBurstKey] = useState(0);
  const submitComment = async (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    try {
      await onComment(post.id, comment);
      setComment("");
      setCommentsOpen(true);
    } finally {
      setSending(false);
    }
  };
  const handleLike = () => {
    if (!post.likedByMe) setLikeBurstKey((value) => value + 1);
    onLike();
  };
  return (
    <article
      id={`post-${post.id}`}
      onClick={(event) => {
        if (
          !forceCommentsOpen &&
          !event.target.closest("button, input, textarea, select, video")
        )
          onOpen();
      }}
      onKeyDown={(event) => {
        if (
          !forceCommentsOpen &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          onOpen();
        }
      }}
      role={!forceCommentsOpen ? "link" : undefined}
      tabIndex={!forceCommentsOpen ? 0 : undefined}
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
      className={`community-card-surface animate-community-card overflow-hidden rounded-[2rem] border border-surface-container bg-surface-container-lowest shadow-[0_8px_24px_rgb(27,27,29,0.06)] ${!forceCommentsOpen ? "cursor-pointer" : ""}`}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold transition-colors duration-300 ${post.isAnonymous ? "bg-inverse-surface text-inverse-on-surface" : "bg-primary-container text-on-primary-container"}`}
            >
              {post.isAnonymous ? (
                <span className="material-symbols-outlined">
                  visibility_off
                </span>
              ) : (
                initial(post.authorName)
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-bold text-on-surface">
                  {post.authorName}
                </h3>
                {post.isAnonymous && (
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
                    Anonymous
                  </span>
                )}
                {post.isAnonymous && post.isMine && (
                  <span className="rounded-full bg-primary-container px-2 py-0.5 text-[9px] font-bold text-on-primary-container">
                    Only you can see this is you
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">
                {formatTime(post.createdAt)} · Careflow
              </p>
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((value) => !value);
              }}
              aria-label="Post menu"
              className="community-tap flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
            >
              <span className="material-symbols-outlined">more_horiz</span>
            </button>
            {menuOpen && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen(false);
                  onShare();
                }}
                className="animate-community-panel community-tap absolute right-0 top-9 z-20 rounded-xl bg-surface-container-lowest px-3 py-2 text-xs font-bold text-on-surface shadow-[0_8px_20px_rgb(27,27,29,0.12)]"
              >
                Share
              </button>
            )}
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-on-surface">
          {post.body}
        </p>
      </div>
      {post.mediaData && (
        <div className="bg-surface-container">
          {post.mediaMime?.startsWith("video/") ? (
            <video
              controls
              preload="metadata"
              src={post.mediaData}
              className="max-h-[32rem] w-full object-contain"
            />
          ) : (
            <img
              src={post.mediaData}
              alt="Community story attachment"
              className="max-h-[32rem] w-full object-contain"
            />
          )}
        </div>
      )}
      <div className="p-3 sm:px-5 sm:pb-5">
        {readOnly ? (
          <div className="flex items-center justify-end gap-3">
            <p className="rounded-xl bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface-variant">
              View Activity · Psychologist Mode
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1 border-y border-surface-container py-2">
            <ActionButton
              onClick={handleLike}
              active={post.likedByMe}
              icon={post.likedByMe ? "favorite" : "favorite_border"}
              label={post.likeCount || "Like"}
              burstKey={likeBurstKey}
            />
            <ActionButton
              onClick={() => setCommentsOpen((value) => !value)}
              icon="chat_bubble_outline"
              label={post.commentCount || "Reply"}
            />
            <ActionButton
              onClick={onShare}
              icon="ios_share"
              label={post.shareCount || "Share"}
            />
          </div>
        )}
        {commentsOpen && (
          <div className="animate-community-panel pt-4">
            <div className="space-y-3">
              {post.comments?.length ? (
                post.comments.map((item) => (
                  <div key={item.id} className="flex gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-[10px] font-bold text-on-tertiary-container">
                      {initial(item.authorName)}
                    </div>
                    <div className="rounded-2xl bg-surface-container px-3 py-2">
                      <p className="text-[11px] font-bold text-on-surface">
                        {item.authorName}{" "}
                        <span className="font-normal text-on-surface-variant">
                          · {formatTime(item.createdAt)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-on-surface">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))
              ) : readOnly ? null : (
                <p className="rounded-2xl bg-surface-container p-3 text-xs text-on-surface-variant">
                  No replies yet. Be the first to offer support.
                </p>
              )}
            </div>
            {!readOnly && (
              <form onSubmit={submitComment} className="mt-4 flex gap-2">
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={1200}
                  placeholder="Write a warm response…"
                  className="min-w-0 flex-1 rounded-full bg-surface-container px-4 py-2.5 text-xs text-on-surface outline-none transition-shadow focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  disabled={sending || !comment.trim()}
                  className="community-tap rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-on-primary disabled:opacity-50"
                >
                  {sending ? "…" : "Send"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function ActionButton({ onClick, active, icon, label, burstKey = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`community-tap relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold ${active ? "bg-error-container text-on-error-container" : "text-on-surface-variant hover:bg-surface-container"}`}
    >
      {burstKey > 0 && (
        <span
          key={burstKey}
          aria-hidden="true"
          className="animate-community-like-ring pointer-events-none absolute h-6 w-6 rounded-full bg-error-container/70"
        />
      )}
      <span
        key={`icon-${burstKey}`}
        className={`material-symbols-outlined text-[18px] ${burstKey > 0 ? "animate-community-like-pop" : ""}`}
        style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_4px_0_#121214]"
        >
          <div className="h-11 w-48 rounded-2xl bg-surface-container" />
          <div className="mt-5 h-4 w-full rounded bg-surface-container" />
          <div className="mt-2 h-4 w-4/5 rounded bg-surface-container" />
        </div>
      ))}
    </div>
  );
}
function EmptyFeed({ detail }) {
  return (
    <div className="animate-community-card rounded-[2rem] bg-surface-container-lowest p-10 text-center shadow-[0_8px_24px_rgb(27,27,29,0.06)]">
      <span className="material-symbols-outlined text-5xl text-primary">
        forum
      </span>
      <h3 className="mt-4 text-xl font-bold text-on-surface">
        {detail ? "Story not found" : "Start the first story"}
      </h3>
      <p className="mt-2 text-sm text-on-surface-variant">
        {detail
          ? "This link may no longer be available or you may not have access."
          : "This space is ready to receive the story you'd like to share."}
      </p>
    </div>
  );
}
