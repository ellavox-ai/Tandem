import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { apiError, NotFoundError } from "@/lib/errors";
import { parseBody, configUpdateBody } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { key } = await params;

    const body = await request.json();
    const { value } = parseBody(configUpdateBody, body);

    const { data, error } = await supabaseAdmin
      .from("pipeline_config")
      .upsert({ key, value, updated_by: user.id }, { onConflict: "key" })
      .select("*")
      .single();

    if (error || !data) {
      throw new NotFoundError(`Failed to save config key "${key}"`);
    }

    return NextResponse.json({ config: data });
  } catch (err) {
    return apiError(err, { route: "config/[key]" });
  }
}
