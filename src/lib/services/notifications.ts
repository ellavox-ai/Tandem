import { logger } from "@/lib/logger";
import type { ExtractedTaskRow, TranscriptRow } from "@/lib/types";

const log = logger.child({ service: "notifications" });

/**
 * Send a Slack notification about new interview items.
 */
export async function notifyNewInterviews(
  transcript: TranscriptRow,
  tasks: ExtractedTaskRow[]
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    log.warn("SLACK_WEBHOOK_URL not configured, skipping notification");
    return;
  }

  const interviewTasks = tasks.filter(
    (t) => t.status === "pending_interview"
  );
  if (interviewTasks.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `New interviews from: ${transcript.meeting_title}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${interviewTasks.length}* task(s) need human input from the meeting on ${new Date(transcript.meeting_date).toLocaleDateString()}.`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: interviewTasks
          .map(
            (t) =>
              `• *${t.extracted_title}* (${t.confidence} confidence, ${t.priority})`
          )
          .join("\n"),
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open Interview Queue" },
          url: `${appUrl}/interviews`,
          style: "primary",
        },
      ],
    },
  ];

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      log.error(
        { status: response.status },
        "Failed to send Slack notification"
      );
    } else {
      log.info(
        { meetingTitle: transcript.meeting_title, count: interviewTasks.length },
        "Slack notification sent"
      );
    }
  } catch (err) {
    log.error({ err }, "Error sending Slack notification");
  }
}

/**
 * Send a Slack notification about auto-created tasks.
 */
export async function notifyAutoCreatedTasks(
  transcript: TranscriptRow,
  tasks: Array<{ title: string; jiraKey: string }>
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const jiraBaseUrl = process.env.JIRA_BASE_URL || "";

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Tasks auto-created from: ${transcript.meeting_title}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: tasks
          .map(
            (t) =>
              `• <${jiraBaseUrl}/browse/${t.jiraKey}|${t.jiraKey}>: ${t.title}`
          )
          .join("\n"),
      },
    },
  ];

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      log.error(
        { status: response.status },
        "Failed to send Slack notification for auto-created tasks"
      );
    }
  } catch (err) {
    log.error({ err }, "Error sending Slack notification for auto-created tasks");
  }
}
