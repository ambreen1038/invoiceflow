"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type CurrentUser = { email: string; name: string; initials: string };

function toUser(email: string | undefined, name: unknown): CurrentUser {
  const displayName = (typeof name === "string" && name.trim()) || email || "";
  const initials =
    displayName
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";
  return { email: email ?? "", name: displayName, initials };
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let alive = true;
    const auth = supabase().auth;
    auth.getUser().then(({ data }) => {
      if (alive && data.user) setUser(toUser(data.user.email, data.user.user_metadata?.full_name));
    });
    const { data: sub } = auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(toUser(session.user.email, session.user.user_metadata?.full_name));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return user;
}
