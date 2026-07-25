import { LogOut, PenLine, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";

import type { StoryRevision } from "../../../shared/contracts";
import type { AuthOutletContext } from "../../App";
import { api } from "../../api/client";

export function AccountPage() {
  const { user, setUser } = useOutletContext<AuthOutletContext>();
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryRevision[]>([]);
  const [storiesError, setStoriesError] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    api.myStories().then((result) => {
      if (active) setStories(result.stories);
    }).catch(() => {
      if (active) setStoriesError("无法加载你的投稿，请稍后重试。");
    });
    return () => {
      active = false;
    };
  }, [user]);

  async function logout() {
    setLogoutBusy(true);
    setLogoutError("");
    try {
      await api.logout();
      setUser(null);
      navigate("/");
    } catch {
      setLogoutError("退出失败，请重试。");
    } finally {
      setLogoutBusy(false);
    }
  }

  if (!user) {
    return (
      <main className="page empty-state">
        <div>
          <p>请先使用 GitHub 登录。</p>
          <a className="button button--accent" href="/api/auth/github">GitHub 登录</a>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="workspace-head">
        <div>
          <div className="eyebrow">/ HACKER PROFILE</div>
          <h1>{user.name || user.login}</h1>
          <p>@{user.login} · {user.role}</p>
        </div>
        <div className="inline-actions">
          {(user.role === "STAFF" || user.role === "ADMIN") && (
            <Link className="button" to="/admin">
              <ShieldCheck size={15} />管理后台
            </Link>
          )}
          <Link className="button button--accent" to="/submit">
            <PenLine size={15} />新投稿
          </Link>
          <button className="button button--ghost" disabled={logoutBusy} onClick={logout}>
            <LogOut size={15} />{logoutBusy ? "正在退出" : "退出登录"}
          </button>
        </div>
      </div>
      {logoutError && <p className="notice">{logoutError}</p>}
      {storiesError && <p className="notice">{storiesError}</p>}
      <section className="account-list">
        {stories.map((story) => (
          <article className="account-item" key={story.storyId}>
            <div className="review-meta">
              <span>{story.status.toUpperCase()}</span>
              <span>{new Date(story.updatedAt).toLocaleString("zh-CN")}</span>
            </div>
            <h3>{story.title}</h3>
            <p>{story.body.slice(0, 180)}</p>
          </article>
        ))}
        {!stories.length && !storiesError && <div className="empty-state">你还没有投稿。</div>}
      </section>
    </main>
  );
}
