import { useEffect, useState } from "react";

import type { StoryRevision, StoryRevisionView } from "../../../shared/contracts";
import { api } from "../../api/client";

export function ContentManagementPage() {
  const [published, setPublished] = useState<StoryRevision[]>([]);
  const [deleted, setDeleted] = useState<StoryRevisionView[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.publishedStories(), api.deletedStories()])
      .then(([publishedResult, deletedResult]) => {
        setPublished(publishedResult.stories);
        setDeleted(deletedResult.stories);
      })
      .catch(() => setError("无法加载内容列表，请稍后重试。"));
  }, []);

  async function remove(story: StoryRevision) {
    if (!window.confirm("帖子将保留 14 天，期间可以恢复。确认删除？")) return;
    setBusyId(story.storyId);
    setError("");
    try {
      const deletion = await api.deleteStory(story.storyId);
      setPublished((items) => items.filter((item) => item.storyId !== story.storyId));
      setDeleted((items) => [{ ...story, deletion }, ...items]);
    } catch {
      setError("删除失败，请重试。");
    } finally {
      setBusyId("");
    }
  }

  async function restore(story: StoryRevisionView) {
    setBusyId(story.storyId);
    setError("");
    try {
      const restored = await api.restoreStory(story.storyId);
      setDeleted((items) => items.filter((item) => item.storyId !== story.storyId));
      if (restored.status === "published") setPublished((items) => [restored, ...items]);
    } catch {
      setError("恢复失败，请重试。");
    } finally {
      setBusyId("");
    }
  }

  return <>
    <div className="workspace-head"><div><div className="eyebrow">/ CONTENT MANAGEMENT</div><h1>内容管理</h1><p>管理已发布和保留期内的帖子</p></div></div>
    {error && <p className="notice">{error}</p>}
    <section className="panel"><h2><span className="section-slash">/</span> 已发布</h2><div className="review-list">{published.map((story) => <article className="review-item" key={story.storyId}><div className="review-meta"><span>@{story.authorLogin}</span><span>{story.publishedAt ? new Date(story.publishedAt).toLocaleString("zh-CN") : ""}</span></div><h3>{story.title}</h3><p>{story.body.slice(0, 220)}</p><button className="button button--danger" disabled={busyId === story.storyId} onClick={() => remove(story)}>{busyId === story.storyId ? "正在删除" : "删除帖子"}</button></article>)}{!published.length && <div className="empty-state">没有已发布内容。</div>}</div></section>
    <section className="panel" style={{ marginTop: 14 }}><h2><span className="section-slash">/</span> 待清理</h2><div className="review-list">{deleted.map((story) => <article className="review-item" key={story.storyId}><div className="review-meta"><span>@{story.authorLogin}</span><span>保留至 {new Date(story.deletion!.purgeAt).toLocaleString("zh-CN")}</span></div><h3>{story.title}</h3><button className="button" disabled={busyId === story.storyId} onClick={() => restore(story)}>{busyId === story.storyId ? "正在恢复" : "恢复帖子"}</button></article>)}{!deleted.length && <div className="empty-state">没有待清理内容。</div>}</div></section>
  </>;
}
