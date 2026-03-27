import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";
import { parseListQuery } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const { limit } = parseListQuery(searchParams);
    const status = searchParams.get("status");
    const transcriptId = searchParams.get("transcriptId");

    let query = supabaseAdmin
      .from("extracted_tasks")
      .select("*, transcript:transcripts(id, meeting_title, meeting_date, provider)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (transcriptId) query = query.eq("transcript_id", transcriptId);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ tasks: data || [] });
  } catch (err) {
    return apiError(err, { route: "tasks" });
  }
}
