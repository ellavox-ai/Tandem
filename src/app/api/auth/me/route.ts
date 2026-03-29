import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null, profile: null });
    }

    // Try to get profile from public.users
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("id, email, display_name, role")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      profile: profile ?? {
        id: user.id,
        email: user.email ?? "",
        display_name:
          user.user_metadata?.display_name ??
          user.email?.split("@")[0] ??
          "User",
        role: "member",
      },
    });
  } catch {
    return NextResponse.json({ user: null, profile: null });
  }
}
