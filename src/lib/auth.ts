import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase";
import { AuthError, ForbiddenError } from "./errors";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "member";
}

/**
 * Extract the authenticated user from the request's Supabase session cookie.
 * Returns null if no valid session exists.
 */
export async function getAuthUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Read-only in route handlers; session refresh is handled by middleware
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("email", user.email)
    .single();

  return {
    id: dbUser?.id ?? user.id,
    email: user.email,
    role: (dbUser?.role as "admin" | "member") ?? "member",
  };
}

/** Throws `AuthError` (401) when no valid session is present. */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) throw new AuthError();
  return user;
}

/** Throws `ForbiddenError` (403) when the user is not an admin. */
export async function requireAdmin(request: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (user.role !== "admin") throw new ForbiddenError();
  return user;
}
