import { PenLine, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { StoryRevision, UserProfile } from "../../../shared/contracts";
import { api } from "../../api/client";

export function AccountPage(){const [user,setUser]=useState<UserProfile>();const [stories,setStories]=useState<StoryRevision[]>([]);const [error,setError]=useState("");useEffect(()=>{Promise.all([api.me(),api.myStories()]).then(([user,result])=>{setUser(user);setStories(result.stories);}).catch(()=>setError("请先使用 GitHub 登录。"));},[]);if(error)return <main className="page empty-state"><div><p>{error}</p><a className="button button--accent" href="/api/auth/github">GitHub 登录</a></div></main>;return <main className="page"><div className="workspace-head"><div><div className="eyebrow">/ HACKER PROFILE</div><h1>{user?.name||user?.login||"正在载入"}</h1><p>{user&&`@${user.login} · ${user.role}`}</p></div><div className="inline-actions">{(user?.role==="STAFF"||user?.role==="ADMIN")&&<Link className="button" to="/admin"><ShieldCheck size={15}/>管理后台</Link>}<Link className="button button--accent" to="/submit"><PenLine size={15}/>新投稿</Link></div></div><section className="account-list">{stories.map(story=><article className="account-item" key={story.storyId}><div className="review-meta"><span>{story.status.toUpperCase()}</span><span>{new Date(story.updatedAt).toLocaleString("zh-CN")}</span></div><h3>{story.title}</h3><p>{story.body.slice(0,180)}</p></article>)}{!stories.length&&<div className="empty-state">你还没有投稿。</div>}</section></main>}

