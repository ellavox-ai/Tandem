import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";
import { NotFoundError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);

    const { id } = await params;

    const { data: transcript, error: tError } = await supabaseAdmin
      .from("transcripts")
      .select("*")
      .eq("id", id)
      .single();

    if (tError || !transcript) {
      throw new NotFoundError("Transcript not found");
    }

    const { data: tasks } = await supabaseAdmin
      .from("extracted_tasks")
      .select("*")
      .eq("transcript_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ transcript, tasks: tasks || [] });
  } catch (err) {
    return apiError(err, { route: "transcripts/[id]" });
  }
}
