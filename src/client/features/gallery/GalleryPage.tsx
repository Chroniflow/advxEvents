import { useEffect, useState } from "react";
import type { PublicStoryWithLikes } from "../../../shared/contracts";
import { api } from "../../api/client";
import { StoryCard } from "../../components/StoryCard";
import { demoStories } from "../../demo";

export function GalleryPage() {
  const [sort,setSort] = useState("latest"); const [stories,setStories] = useState<PublicStoryWithLikes[]>([]); const [loading,setLoading] = useState(true);
  useEffect(() => { setLoading(true); api.publicStories(sort).then(({stories}) => setStories(stories.length ? stories : (import.meta.env.DEV ? demoStories : []))).catch(() => setStories(import.meta.env.DEV ? demoStories : [])).finally(() => setLoading(false)); }, [sort]);
  return <main className="page"><section className="hero"><div><div className="eyebrow">/ STORIES FROM THE NIGHT</div><h1>把那个夏天，<br/>留在故事里。</h1><p>参赛者写下亲历的瞬间、没有被镜头记录的小事，以及创造发生之前与之后的人。</p></div><div className="archive-count"><strong>{stories.length}</strong> ANECDOTES ARCHIVED</div></section>
    <div className="gallery-toolbar"><div className="segmented" aria-label="故事排序">{[["latest","最新"],["hottest","最热"],["random","随机"]].map(([value,label]) => <button key={value} className={sort===value?"active":""} onClick={() => setSort(value)}>{label}</button>)}</div><span className="eyebrow">/ TEXT FIRST · IMAGES OPTIONAL</span></div>
    {loading ? <div className="loading-state">正在打开档案...</div> : stories.length ? <div className="gallery-grid">{stories.map((story,index) => <StoryCard key={story.storyId} story={story} index={index}/>)}</div> : <div className="empty-state"><div><b>还没有公开的轶事</b><p>第一篇故事，或许就从你开始。</p></div></div>}
  </main>;
}

