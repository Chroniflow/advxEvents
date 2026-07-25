import { Code2, PenLine } from "lucide-react";
import { Link } from "react-router-dom";

export function SiteHeader() {
  return <header className="site-header"><div className="site-header__inner">
    <Link className="brand" to="/"><span className="brand__slash">/</span> ADVX轶事 <span className="brand__en">ADVX ANECDOTES</span></Link>
    <nav className="header-actions"><Link className="button button--ghost" to="/account">我的轶事</Link><a className="button button--ghost" href="/api/auth/github"><Code2 size={15}/> GitHub 登录</a><Link className="button button--accent" to="/submit"><PenLine size={15}/>投稿</Link></nav>
  </div></header>;
}
