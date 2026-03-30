import { NextResponse } from "next/server";
import { processMaintenance } from "@/lib/jobs/processors";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await processMaintenance({ type: "expire-claims" });
  await processMaintenance({ type: "expire-interviews" });

  return NextResponse.json({ ok: true });
}
