"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProfile = async (authUser: User): Promise<UserProfile | null> => {
    try {
      const { data } = await supabase
        .from("users")
        .select("id, email, display_name, role")
        .eq("id", authUser.id)
        .single();

      if (data) {
        setProfile(data);
        return data;
      }

      // No profile row yet (trigger may not have fired) — build a fallback
      // from the auth user metadata so the app isn't blocked.
      const fallback: UserProfile = {
        id: authUser.id,
        email: authUser.email ?? "",
        display_name:
          authUser.user_metadata?.display_name ??
          authUser.email?.split("@")[0] ??
          "User",
        role: "member",
      };
      setProfile(fallback);
      return fallback;
    } catch {
      // Supabase query failed — use fallback
      const fallback: UserProfile = {
        id: authUser.id,
        email: authUser.email ?? "",
        display_name:
          authUser.user_metadata?.display_name ??
          authUser.email?.split("@")[0] ??
          "User",
        role: "member",
      };
      setProfile(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser) {
          setUser(authUser);
          await fetchProfile(authUser);
        } else {
          // Not authenticated — redirect to login
          window.location.href = "/login";
          return;
        }
      } catch {
        // Auth check failed — redirect to login
        window.location.href = "/login";
        return;
      }

      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent)] flex items-center justify-center animate-pulse">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <p className="text-[13px] text-[var(--foreground-tertiary)]">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
