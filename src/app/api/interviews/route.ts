import { NextRequest, NextResponse } from "next/server";
import { getPendingInterviews } from "@/lib/services/interview-queue";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("userEmail") || user.email;

    const interviews = await getPendingInterviews(userEmail);
    return NextResponse.json({ interviews });
  } catch (err) {
    return apiError(err, { route: "interviews" });
  }
}
