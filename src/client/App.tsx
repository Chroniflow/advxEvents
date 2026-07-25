import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Outlet } from "react-router-dom";

import type { UserProfile } from "../shared/contracts";
import { api } from "./api/client";
import { SiteHeader, type AuthStatus } from "./components/SiteHeader";

export interface AuthOutletContext {
  user: UserProfile | null;
  setUser: Dispatch<SetStateAction<UserProfile | null>>;
}

export function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let active = true;
    api.me().then((profile) => {
      if (!active) return;
      setUser(profile);
      setAuthStatus("authenticated");
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setAuthStatus("anonymous");
    });
    return () => {
      active = false;
    };
  }, []);

  const updateUser: Dispatch<SetStateAction<UserProfile | null>> = (value) => {
    setUser((current) => {
      const next = typeof value === "function" ? value(current) : value;
      setAuthStatus(next ? "authenticated" : "anonymous");
      return next;
    });
  };

  return (
    <div className="site-shell">
      <SiteHeader authStatus={authStatus} user={user} />
      <Outlet context={{ user, setUser: updateUser } satisfies AuthOutletContext} />
    </div>
  );
}
