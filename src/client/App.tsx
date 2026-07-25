import { Outlet } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";

export function App() {
  return <div className="site-shell"><SiteHeader/><Outlet/></div>;
}
