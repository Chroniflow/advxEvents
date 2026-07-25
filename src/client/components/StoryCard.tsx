import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicStoryWithLikes } from "../../shared/contracts";

export function StoryCard({ story, index }: { story: PublicStoryWithLikes; index: number }) {
  const position = index % 5;
  const variant =
    position === 0
      ? " story-card--feature story-card--wide"
      : position === 2
        ? " story-card--narrow"
        : position === 4
          ? " story-card--xwide"
          : "";
  const author = story.author.anonymous ? "匿名投稿" : `@${story.author.login}`;
  return <Link className={`story-card${variant}`} to={`/stories/${story.storyId}`}>
    {story.images[0] && <img className="story-card__image" src={`/api/media/${story.images[0].assetId}`} alt={story.images[0].caption || story.title}/>} 
    <div className="story-card__meta"><span>{story.body.length > 280 ? "LONG READ" : "ANECDOTE"}</span><span>STORY {String(index + 1).padStart(3,"0")}</span></div>
    <h2>{story.title}</h2><p className="story-card__excerpt">{story.body}</p>
    <footer className="story-card__footer"><span>{author}</span><span className="like-count"><Heart size={13}/> {story.likeCount}</span></footer>
  </Link>;
}
