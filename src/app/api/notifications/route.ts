import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";

/** GET /api/notifications — list notifications for the current user */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    let query = supabaseAdmin
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ notifications: data ?? [] });
  } catch (err) {
    return apiError(err, { route: "notifications" });
  }
}

/** PATCH /api/notifications — mark notifications as read */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { ids, all } = await request.json();

    if (all) {
      // Mark all as read for this user
      await supabaseAdmin
        .from("notifications")
        .update({ read: true })
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq("read", false);
    } else if (Array.isArray(ids) && ids.length > 0) {
      // Mark specific IDs as read
      await supabaseAdmin
        .from("notifications")
        .update({ read: true })
        .in("id", ids)
        .or(`user_id.eq.${user.id},user_id.is.null`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, { route: "notifications/read" });
  }
}
