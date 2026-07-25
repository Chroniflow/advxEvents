import { FileCheck2, Files, Home, Shield, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import type { UserProfile } from "../../../shared/contracts";
import { api } from "../../api/client";

export interface AdminOutletContext { user: UserProfile }

export function AdminLayout(){
  const [user,setUser]=useState<UserProfile>(); const [denied,setDenied]=useState(false);
  useEffect(()=>{api.me().then(profile=>{if(profile.role==="USER")setDenied(true);else setUser(profile)}).catch(()=>setDenied(true))},[]);
  if(denied)return <main className="page empty-state"><div><p>此区域仅对 STAFF 和 ADMIN 开放。</p><a className="button button--accent" href="/api/auth/github">GitHub 登录</a></div></main>;
  if(!user)return <main className="page loading-state">正在验证权限...</main>;
  return <div className="panel-layout"><aside className="side-nav"><NavLink to="/admin" end><Home size={17}/><span>管理概览</span></NavLink><NavLink to="/admin/content"><Files size={17}/><span>内容管理</span></NavLink><NavLink to="/admin/reviews"><FileCheck2 size={17}/><span>待审核</span></NavLink>{user.role==="ADMIN"&&<NavLink to="/admin/users"><Users size={17}/><span>用户与权限</span></NavLink>}<NavLink to="/"><Shield size={17}/><span>返回画廊</span></NavLink></aside><div className="workspace"><Outlet context={{ user } satisfies AdminOutletContext}/></div></div>
}
