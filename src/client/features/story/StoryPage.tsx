import { ArrowLeft, Heart, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { PublicStoryWithLikes } from "../../../shared/contracts";
import { api } from "../../api/client";
import { demoStories } from "../../demo";

export function StoryPage() {
  const { storyId = "" } = useParams(); const [story,setStory] = useState<PublicStoryWithLikes>(); const [liked,setLiked] = useState(false); const [error,setError] = useState("");
  useEffect(() => { api.publicStory(storyId).then(setStory).catch(() => { const demo=demoStories.find(item=>item.storyId===storyId); if(demo) setStory(demo); else setError("这篇轶事不存在或尚未公开。"); }); api.likeState(storyId).then(value=>setLiked(value.liked)).catch(()=>undefined); },[storyId]);
  if(error) return <main className="page empty-state">{error}</main>; if(!story) return <main className="page loading-state">正在读取...</main>;
  const toggleLike=async()=>{try{const next=await api.like(storyId,!liked);setLiked(next.liked);setStory({...story,likeCount:next.count});}catch{window.location.href="/api/auth/github";}};
  return <main className="page story-page"><Link className="button button--ghost" to="/"><ArrowLeft size={15}/>返回画廊</Link><header className="story-head"><div className="eyebrow">/ ADVX ANECDOTE</div><h1>{story.title}</h1><div className="story-byline"><span>{story.author.anonymous?"匿名投稿":`@${story.author.login}`}</span><span>{new Date(story.publishedAt).toLocaleDateString("zh-CN")}</span></div></header><article className="story-body">{story.body}</article>{story.images.map(image=><figure className="story-figure" key={image.assetId}><img src={`/api/media/${image.assetId}`} alt={image.caption||story.title}/>{image.caption&&<figcaption>{image.caption}</figcaption>}</figure>)}<div className="inline-actions"><button className={`button ${liked?"button--accent":""}`} onClick={toggleLike}><Heart size={16} fill={liked?"currentColor":"none"}/>{story.likeCount}</button><button className="icon-button" title="分享" onClick={()=>navigator.share?.({title:story.title,url:location.href})}><Share2 size={16}/></button></div></main>;
}

