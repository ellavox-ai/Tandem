import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json();

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      user: data.user
        ? { id: data.user.id, email: data.user.email }
        : null,
      session: !!data.session,
    });
  } catch (err) {
    return apiError(err, { route: "auth/signup" });
  }
}
