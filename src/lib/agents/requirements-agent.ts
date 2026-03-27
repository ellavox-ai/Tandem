import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requirementsOutputSchema } from "./schemas";
import type { RequirementsOutput } from "./schemas";
import type { ExtractedTaskRow } from "@/lib/types";

const log = logger.child({ service: "requirements-agent" });

const REQUIREMENTS_INSTRUCTIONS = `You are a senior technical product manager who writes exceptional Jira tickets. Your job is to take raw task data — extracted from meeting transcripts and optionally refined through interviews — and produce structured, actionable requirements that a developer can pick up and work on immediately.

Guidelines:
- **Title**: Write a concise, imperative summary (e.g., "Add retry logic to webhook delivery pipeline"). Avoid vague titles like "Fix the thing" or "Look into issue".
- **Issue Type**: Choose the most appropriate type:
  - Story: User-facing feature or capability ("As a user, I can...")
  - Task: Internal/technical work that doesn't directly map to a user story
  - Bug: Something is broken or behaving incorrectly
  - Spike: Research or investigation needed before implementation can begin
- **Description**: Write a rich description that includes:
  - Context: Why this work matters and what problem it solves
  - Scope: What's included and explicitly what's NOT included
  - Any relevant quotes or context from the meeting transcript
  - Interview responses if available
- **Acceptance Criteria**: Write 3-7 testable criteria using "Given/When/Then" or checkbox format. Each criterion should be independently verifiable.
- **Technical Notes**: Include architecture considerations, affected systems, suggested approach, or known gotchas. Leave empty if not applicable.
- **Story Points**: Estimate using the Fibonacci scale based on the described scope and complexity. Use your best judgment:
  - 1: Trivial change, < 1 hour
  - 2: Small, straightforward, < half day
  - 3: Medium, well-understood, ~1 day
  - 5: Larger, some unknowns, 2-3 days
  - 8: Complex, multiple components, ~1 week
  - 13: Very complex, significant unknowns, needs breakdown
- **Priority**: Validate or adjust the priority based on the full context.
- **Labels**: Refine and normalize labels (use lowercase, consistent naming).
- **Blocked By**: Identify any explicit or implied dependencies mentioned in the context.

Quality standards:
- Every ticket should be actionable without requiring the developer to re-read the transcript.
- Acceptance criteria should be specific enough that QA can verify them.
- If the task is too large (would be >13 points), note this in technical notes and suggest breaking it down, but still produce the best single ticket you can.`;

/**
 * Refine a raw extracted task into structured Jira-ready requirements.
 * Accepts either a taskId (will fetch from DB with transcript join)
 * or a pre-loaded task row (avoids double-fetch when caller already has it).
 */
export async function refineRequirements(
  taskOrId: string | ExtractedTaskRow
): Promise<RequirementsOutput> {
  let task: ExtractedTaskRow;

  if (typeof taskOrId === "string") {
    const { data, error } = await supabaseAdmin
      .from("extracted_tasks")
      .select("*, transcript:transcripts(*)")
      .eq("id", taskOrId)
      .single();

    if (error || !data) {
      throw new Error(`Task not found: ${taskOrId}`);
    }
    task = data;
  } else {
    task = taskOrId;
  }

  const prompt = buildPrompt(task);

  log.info({ taskId: task.id, title: task.extracted_title }, "Refining requirements");

  const { output } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: REQUIREMENTS_INSTRUCTIONS,
    prompt,
    output: Output.object({ schema: requirementsOutputSchema }),
  });

  if (!output) {
    throw new Error(`Requirements agent returned no output for task ${task.id}`);
  }

  log.info(
    {
      taskId: task.id,
      issueType: output.issueType,
      storyPoints: output.storyPoints,
      acCount: output.acceptanceCriteria.length,
    },
    "Requirements refined"
  );

  return output;
}

function buildPrompt(task: ExtractedTaskRow): string {
  const transcript = task.transcript as unknown as {
    meeting_title?: string;
    meeting_date?: string;
    attendees?: { name: string }[];
    full_text?: string;
  } | null;

  let prompt = `## Raw Task Data

**Title:** ${task.extracted_title}
**Description:** ${task.extracted_description}
**Confidence:** ${task.confidence}
**Priority (initial):** ${task.priority}
**Labels:** ${(task.labels || []).join(", ") || "none"}
**Status:** ${task.status}

**Assignee(s):** ${(task.inferred_assignees || []).map((a) => a.name + (a.email ? ` <${a.email}>` : "")).join(", ") || "Unassigned"}

**Missing Context (from extraction):**
${(task.missing_context || []).map((q, i) => `${i + 1}. ${q}`).join("\n") || "None"}

**Source Quotes:**
${(task.source_quotes || []).map((q) => `> "${q.text}"`).join("\n") || "None captured"}`;

  if (task.interview_responses && Object.keys(task.interview_responses).length > 0) {
    prompt += `\n\n## Interview Responses\n`;
    for (const [question, answer] of Object.entries(task.interview_responses)) {
      prompt += `\n**Q:** ${question}\n**A:** ${answer}\n`;
    }
  }

  if (transcript) {
    prompt += `\n\n## Meeting Context`;
    if (transcript.meeting_title) {
      prompt += `\n**Meeting:** ${transcript.meeting_title}`;
    }
    if (transcript.meeting_date) {
      prompt += ` (${new Date(transcript.meeting_date).toLocaleDateString()})`;
    }
    if (transcript.attendees?.length) {
      prompt += `\n**Attendees:** ${transcript.attendees.map((a) => a.name).join(", ")}`;
    }
    if (transcript.full_text) {
      prompt += `\n\n### Transcript Excerpt\n${transcript.full_text.substring(0, 4000)}`;
      if (transcript.full_text.length > 4000) {
        prompt += "\n\n...(transcript truncated)";
      }
    }
  }

  prompt += `\n\nRefine this into a high-quality, actionable Jira ticket.`;

  return prompt;
}
