import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "student";

type SessionSnapshot = {
  session: Session | null;
  loading: boolean;
};

const initialSessionSnapshot: SessionSnapshot = { session: null, loading: true };
let sessionSnapshot = initialSessionSnapshot;
let authListenerStarted = false;
const sessionListeners = new Set<() => void>();

function subscribeToSession(listener: () => void) {
  sessionListeners.add(listener);
  if (!authListenerStarted) {
    authListenerStarted = true;
    supabase.auth.onAuthStateChange((_event, session) => {
      sessionSnapshot = { session, loading: false };
      sessionListeners.forEach((notify) => notify());
    });
  }
  return () => sessionListeners.delete(listener);
}

function getSessionSnapshot() {
  return sessionSnapshot;
}

export function useSession() {
  const { session, loading } = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => initialSessionSnapshot,
  );
  return { session, user: session?.user ?? null, loading };
}

export function useRoles(user: User | null) {
  const { data: roles = [], isPending } = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((row) => row.role as AppRole);
    },
  });

  return {
    roles,
    loading: !!user && isPending,
    isAdmin: roles.includes("admin") || roles.includes("super_admin"),
    isSuperAdmin: roles.includes("super_admin"),
  };
}

export function levelFromPoints(points: number) {
  const level = Math.floor(points / 250) + 1;
  const inLevel = points % 250;
  return { level, inLevel, needed: 250, progress: (inLevel / 250) * 100 };
}
