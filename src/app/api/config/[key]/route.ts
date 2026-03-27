import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { apiError, NotFoundError } from "@/lib/errors";
import { parseBody, configUpdateBody } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const user = await requireAdmin(request);
    const { key } = await params;

    const body = await request.json();
    const { value } = parseBody(configUpdateBody, body);

    const { data, error } = await supabaseAdmin
      .from("pipeline_config")
      .update({ value, updated_by: user.id })
      .eq("key", key)
      .select("*")
      .single();

    if (error || !data) {
      throw new NotFoundError("Config key not found");
    }

    return NextResponse.json({ config: data });
  } catch (err) {
    return apiError(err, { route: "config/[key]" });
  }
}
