import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { apiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { data, error } = await supabaseAdmin
      .from("pipeline_config")
      .select("*")
      .order("key");

    if (error) {
      throw error;
    }

    const config: Record<string, unknown> = {};
    for (const row of data || []) {
      config[row.key] = row.value;
    }

    return NextResponse.json({ config });
  } catch (err) {
    return apiError(err, { route: "config" });
  }
}
