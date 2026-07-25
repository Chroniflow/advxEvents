import { Code2, PenLine, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import type { UserProfile } from "../../shared/contracts";

export type AuthStatus = "loading" | "anonymous" | "authenticated";

interface SiteHeaderProps {
  authStatus: AuthStatus;
  user: UserProfile | null;
}

export function SiteHeader({ authStatus, user }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" to="/">
          <span className="brand__slash">/</span> ADVX轶事
          <span className="brand__en">ADVX ANECDOTES</span>
        </Link>
        <nav className="header-actions">
          {authStatus === "anonymous" && (
            <a className="button button--ghost login-link" href="/api/auth/github">
              <Code2 size={15} />
              <span>GitHub 登录</span>
            </a>
          )}
          {authStatus === "authenticated" && user && (
            <Link className="button button--ghost account-link" to="/account" aria-label="我的">
              <UserRound size={15} />
              <span>我的</span>
            </Link>
          )}
          <Link className="button button--accent" to="/submit">
            <PenLine size={15} />投稿
          </Link>
        </nav>
      </div>
    </header>
  );
}
