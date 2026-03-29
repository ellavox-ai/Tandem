import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.JIRA_BASE_URL?.replace(/\/+$/, "") || null;
  return NextResponse.json({ jiraBaseUrl: url });
}
