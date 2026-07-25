import { useEffect, useState } from "react";import type { StoryRevision } from "../../../shared/contracts";import { api } from "../../api/client";import { ReviewList } from "./AdminOverview";
export function ReviewsPage(){const[stories,setStories]=useState<StoryRevision[]>([]);useEffect(()=>{api.reviews().then(result=>setStories(result.stories))},[]);return <><div className="workspace-head"><div><div className="eyebrow">/ CONTENT REVIEW</div><h1>待审核</h1></div></div><ReviewList stories={stories} onDone={id=>setStories(items=>items.filter(item=>item.storyId!==id))}/></>}

