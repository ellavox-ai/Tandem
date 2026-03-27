import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth";
import { apiError } from "@/lib/errors";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const log = logger.child({ route: "realtime-session" });

const VOICE_INTERVIEWER_INSTRUCTIONS = `You are a friendly, professional AI interviewer conducting a short voice conversation to gather missing context for a task that was extracted from a meeting transcript.

Your style:
- Warm and conversational, like a helpful colleague on a quick call
- Concise — keep your responses to 1-2 sentences before asking a question
- Ask one question at a time (you may naturally combine two very short related ones)
- Use the transcript context to ask smart, specific questions rather than generic ones
- If an answer implies something about other missing context, skip questions that are already answered
- Keep the whole interview under 5-6 exchanges total

Start by briefly greeting the person and asking your first clarifying question about the task.

When you've gathered enough context, call the complete_interview function with the refined task details. After calling it, thank the person and let them know you're all set.

If the person says this isn't a real task or it's already been handled, call complete_interview with should_create set to false and a brief reason in the description.`;

const COMPLETE_INTERVIEW_TOOL = {
  type: "function" as const,
  name: "complete_interview",
  description:
    "Call this when you have gathered enough information to create or dismiss the task. Do NOT call this until you are confident you have sufficient context.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Refined task title based on the conversation",
      },
      description: {
        type: "string",
        description:
          "Full task description incorporating the context gathered during the interview",
      },
      assignee: {
        type: "string",
        description: "Name of the person who should own this task, or empty string if unknown",
      },
      priority: {
        type: "string",
        enum: ["P0", "P1", "P2", "P3"],
        description: "Task priority",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Relevant labels for the task",
      },
      should_create: {
        type: "boolean",
        description:
          "Whether to create this as a real task. Set false if the person says it's not needed.",
      },
    },
    required: ["title", "description", "priority", "labels", "should_create"],
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    await requireAuth(request);
    await rateLimit(`realtime:${getClientIp(request)}`, { windowMs: 60_000, max: 5 });

    const sdp = await request.text();

    if (!sdp || !sdp.includes("v=0")) {
      return new Response("Invalid SDP", { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log.error("OPENAI_API_KEY is not configured");
      return new Response("Server configuration error", { status: 500 });
    }

    const { task, transcript } = await loadTaskWithTranscript(taskId);
    const context = buildInterviewContext(task, transcript);

    const sessionConfig = JSON.stringify({
      type: "realtime",
      model: "gpt-realtime",
      instructions: VOICE_INTERVIEWER_INSTRUCTIONS + "\n\n" + context,
      tools: [COMPLETE_INTERVIEW_TOOL],
      audio: {
        input: {
          transcription: { model: "gpt-4o-transcribe" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 700,
          },
        },
        output: { voice: "sage" },
      },
    });

    const fd = new FormData();
    fd.set("sdp", sdp);
    fd.set("session", sessionConfig);

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(
        { status: response.status, error: errorText },
        "OpenAI Realtime API error"
      );
      return new Response("Failed to create realtime session", { status: 502 });
    }

    const answerSdp = await response.text();
    log.info({ taskId }, "Realtime voice interview session created");

    return new Response(answerSdp, {
      headers: { "Content-Type": "application/sdp" },
    });
  } catch (err) {
    return apiError(err, { route: "realtime/[taskId]" });
  }
}

async function loadTaskWithTranscript(taskId: string) {
  const { data: task, error: taskError } = await supabaseAdmin
    .from("extracted_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (taskError || !task) throw new Error(`Task not found: ${taskId}`);

  const { data: transcript, error: txError } = await supabaseAdmin
    .from("transcripts")
    .select("*")
    .eq("id", task.transcript_id)
    .single();

  if (txError || !transcript)
    throw new Error(`Transcript not found for task: ${taskId}`);

  return { task, transcript };
}

function buildInterviewContext(
  task: Record<string, unknown>,
  transcript: Record<string, unknown>
): string {
  const missingContext = (task.missing_context as string[]) || [];
  const assignees = (
    (task.inferred_assignees as Array<{ name: string }>) || []
  )
    .map((a) => a.name)
    .join(", ");
  const quotes = (
    (task.source_quotes as Array<{ text: string }>) || []
  )
    .map((q) => `> "${q.text}"`)
    .join("\n");

  const attendees = (
    (transcript.attendees as Array<{ name: string }>) || []
  )
    .map((a) => a.name)
    .join(", ");

  return `--- TASK CONTEXT ---
Title: ${task.extracted_title}
Description: ${task.extracted_description}
Confidence: ${task.confidence}
Inferred assignee(s): ${assignees || "Unknown"}
Priority guess: ${task.priority}

What's missing:
${missingContext.map((q, i) => `${i + 1}. ${q}`).join("\n") || "Nothing specific flagged"}

Source quotes from the meeting:
${quotes || "None captured"}

Meeting: ${transcript.meeting_title} (${new Date(transcript.meeting_date as string).toLocaleDateString()})
Attendees: ${attendees || "Unknown"}`;
}
