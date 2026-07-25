import { FileCheck2, Home, Shield, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
export function AdminLayout(){return <div className="panel-layout"><aside className="side-nav"><NavLink to="/admin" end><Home size={17}/><span>管理概览</span></NavLink><NavLink to="/admin/reviews"><FileCheck2 size={17}/><span>待审核</span></NavLink><NavLink to="/admin/users"><Users size={17}/><span>用户与权限</span></NavLink><NavLink to="/"><Shield size={17}/><span>返回画廊</span></NavLink></aside><div className="workspace"><Outlet/></div></div>}

