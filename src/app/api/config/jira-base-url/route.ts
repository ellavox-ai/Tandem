import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const url = process.env.JIRA_BASE_URL?.replace(/\/+$/, "") || null;
    return NextResponse.json({ jiraBaseUrl: url });
  } catch (err) {
    return apiError(err, { route: "config/jira-base-url" });
  }
}
