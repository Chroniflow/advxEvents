import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { StoryRevision, StoryRevisionView } from "../../../shared/contracts";
import { api } from "../../api/client";
import type { AdminOutletContext } from "./AdminLayout";

export function AdminOverview() {
  const { user } = useOutletContext<AdminOutletContext>();
  const [stories, setStories] = useState<StoryRevision[]>([]);
  const [deleted, setDeleted] = useState<StoryRevisionView[]>([]);
  const [gcMessage, setGcMessage] = useState("");
  useEffect(() => {
    api.reviews().then((result) => setStories(result.stories)).catch(() => undefined);
    api.deletedStories().then((result) => setDeleted(result.stories)).catch(() => undefined);
  }, []);
  const runGc = async () => {
    setGcMessage("");
    try {
      const result = await api.runGc();
      setGcMessage(`已清理 ${result.purgedStories} 个帖子，删除 ${result.deletedObjects} 个对象。`);
    } catch { setGcMessage("GC 运行失败，请重试。"); }
  };
  const restore = async (storyId: string) => {
    await api.restoreStory(storyId);
    setDeleted((items) => items.filter((item) => item.storyId !== storyId));
  };
  return <>
    <div className="workspace-head"><div><div className="eyebrow">/ ADMINISTRATION</div><h1>管理概览</h1><p>内容审核、站点状态与访问权限</p></div>{user.role === "ADMIN" && <button className="button" onClick={runGc}>立即运行 GC</button>}</div>
    {gcMessage && <p className="notice">{gcMessage}</p>}
    <div className="stat-grid"><div className="stat"><span>PENDING REVIEW</span><strong style={{color:"var(--accent)"}}>{stories.length}</strong></div><div className="stat"><span>DELETED</span><strong>{deleted.length}</strong></div><div className="stat"><span>USERS</span><strong>—</strong></div><div className="stat"><span>LIKES</span><strong>—</strong></div></div>
    <section className="panel"><div className="workspace-head"><h2><span className="section-slash">/</span> 待审核内容</h2><Link to="/admin/reviews">查看全部 →</Link></div><ReviewList stories={stories.slice(0,4)} onDone={(id) => setStories((items) => items.filter((item) => item.storyId !== id))}/></section>
    <section className="panel" style={{marginTop:14}}><h2><span className="section-slash">/</span> 待清理内容</h2><div className="review-list">{deleted.map((story) => <article className="review-item" key={story.storyId}><h3>{story.title}</h3><p>保留至 {new Date(story.deletion!.purgeAt).toLocaleString("zh-CN")}</p><button className="button" onClick={() => restore(story.storyId)}>恢复帖子</button></article>)}{!deleted.length && <div className="empty-state">没有待清理内容。</div>}</div></section>
  </>;
}

export function ReviewList({stories,onDone}:{stories:StoryRevision[];onDone?:(id:string)=>void}) {
  const decide = async (story: StoryRevision, decision: "approve"|"reject") => { const reason=decision==="reject"?window.prompt("请填写拒绝原因")||"":""; if(decision==="reject"&&!reason)return; await api.review(story.storyId,story.revisionId,decision,reason); onDone?.(story.storyId); };
  const remove = async (story: StoryRevision) => { if(!window.confirm("确认删除此帖子？")) return; await api.deleteStory(story.storyId); onDone?.(story.storyId); };
  return <div className="review-list">{stories.map(story=><article className="review-item" key={story.revisionId}><div className="review-meta"><span>{story.anonymous?"ANONYMOUS PUBLICATION":`@${story.authorLogin}`}</span><span>{story.images.length?`${story.images.length} 张图片`:"纯文本"}</span></div><h3>{story.title}</h3><p>{story.body.slice(0,220)}</p><div className="inline-actions"><button className="button button--danger" onClick={()=>remove(story)}>删除</button><button className="button" onClick={()=>decide(story,"reject")}>拒绝</button><button className="button button--accent" onClick={()=>decide(story,"approve")}>批准</button></div></article>)}{!stories.length&&<div className="empty-state">没有待审核内容。</div>}</div>;
}
