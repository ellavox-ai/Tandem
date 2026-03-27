import type { NormalizedTranscript, Utterance, Attendee } from "@/lib/types";
import type { TranscriptProviderAdapter, ProviderConfig } from "./base";
import { registerProvider } from "./base";
import { parseVTT } from "./zoom";
import { logger } from "@/lib/logger";
import { v4 as uuid } from "uuid";

/**
 * n8n automation provider.
 *
 * Accepts transcript file content directly in the webhook payload,
 * designed for n8n workflows that watch Google Drive (or other sources)
 * and forward downloaded transcript files to Ellavox.
 *
 * Unlike the previous implementation, the full payload is passed through
 * the `metadata` field rather than stashed in an in-memory Map, making
 * this safe for multi-instance / serverless deployments.
 */
export class N8nProvider implements TranscriptProviderAdapter {
  readonly name = "n8n";

  async initialize(_config: ProviderConfig) {
    logger.info({ provider: this.name }, "n8n provider initialized");
  }

  async startListening() {}
  async stopListening() {}

  validateWebhook(): boolean {
    return true;
  }

  parseWebhook(
    body: unknown
  ): { externalId: string; metadata?: Record<string, unknown> } | null {
    const payload = body as Partial<N8nWebhookPayload>;

    if (!payload?.fileContent) {
      logger.warn("n8n webhook missing fileContent");
      return null;
    }

    const externalId = payload.fileId || `n8n-${uuid()}`;

    return {
      externalId,
      metadata: {
        fileContent: payload.fileContent,
        fileName: payload.fileName,
        fileId: payload.fileId,
        meetingTitle: payload.meetingTitle,
        meetingDate: payload.meetingDate,
        attendees: payload.attendees,
        duration: payload.duration,
      },
    };
  }

  async fetchTranscript(
    externalId: string,
    metadata?: Record<string, unknown>
  ): Promise<NormalizedTranscript> {
    const payload = metadata as N8nWebhookPayload | undefined;
    if (!payload?.fileContent) {
      throw new Error(
        `No n8n payload for externalId: ${externalId}. ` +
          "The fileContent must be included in webhook metadata."
      );
    }

    const format = detectFormat(payload.fileName);
    const utterances = parseContent(payload.fileContent, format);
    const attendees = parseAttendees(payload.attendees, utterances);

    const title =
      payload.meetingTitle ||
      stripExtension(payload.fileName) ||
      "Untitled Meeting";

    return {
      provider: "n8n",
      externalId,
      meetingTitle: title,
      meetingDate: payload.meetingDate
        ? new Date(payload.meetingDate)
        : new Date(),
      duration: payload.duration || estimateDuration(utterances),
      attendees,
      utterances,
      rawFormat: format === "vtt" ? "vtt" : "text",
      metadata: {
        source: "n8n",
        fileName: payload.fileName,
        fileId: payload.fileId,
        receivedAt: new Date().toISOString(),
      },
    };
  }
}

interface N8nWebhookPayload {
  fileContent: string;
  fileName?: string;
  fileId?: string;
  meetingTitle?: string;
  meetingDate?: string;
  attendees?: string | Array<{ name: string; email?: string }>;
  duration?: number;
}

function detectFormat(fileName?: string): "vtt" | "srt" | "txt" {
  if (!fileName) return "txt";
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".vtt")) return "vtt";
  if (lower.endsWith(".srt")) return "srt";
  return "txt";
}

function parseContent(
  content: string,
  format: "vtt" | "srt" | "txt"
): Utterance[] {
  switch (format) {
    case "vtt":
      return parseVTT(content);
    case "srt":
      return parseSRT(content);
    case "txt":
      return parsePlainText(content);
  }
}

function parseSRT(content: string): Utterance[] {
  const utterances: Utterance[] = [];
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const timestampLine = lines[1];
    const match = timestampLine.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!match) continue;

    const startTime = parseSRTTimestamp(match[1]);
    const endTime = parseSRTTimestamp(match[2]);
    const text = lines.slice(2).join(" ").trim();

    const speakerMatch = text.match(/^([^:]+):\s*(.+)$/);
    const speaker = speakerMatch ? speakerMatch[1].trim() : "Unknown";
    const utteranceText = speakerMatch ? speakerMatch[2].trim() : text;

    if (utteranceText) {
      utterances.push({ speaker, text: utteranceText, startTime, endTime });
    }
  }

  return utterances;
}

function parseSRTTimestamp(ts: string): number {
  const [time, ms] = ts.split(",");
  const parts = time.split(":");
  const normalizedMs = parseInt((ms + "000").slice(0, 3), 10);
  return (
    parseInt(parts[0], 10) * 3600 +
    parseInt(parts[1], 10) * 60 +
    parseInt(parts[2], 10) +
    normalizedMs / 1000
  );
}

function parsePlainText(content: string): Utterance[] {
  const utterances: Utterance[] = [];
  const lines = content.split("\n").filter((l) => l.trim());
  let currentTime = 0;

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    const speaker = match ? match[1].trim() : "Unknown";
    const text = match ? match[2].trim() : line.trim();

    if (text) {
      utterances.push({
        speaker,
        text,
        startTime: currentTime,
        endTime: currentTime + 5,
      });
      currentTime += 5;
    }
  }

  return utterances;
}

function parseAttendees(
  raw: string | Array<{ name: string; email?: string }> | undefined,
  utterances: Utterance[]
): Attendee[] {
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  }

  const speakers = new Set(utterances.map((u) => u.speaker));
  return Array.from(speakers)
    .filter((s) => s !== "Unknown")
    .map((name) => ({ name }));
}

function estimateDuration(utterances: Utterance[]): number {
  if (utterances.length === 0) return 0;
  return Math.max(...utterances.map((u) => u.endTime));
}

function stripExtension(fileName?: string): string | undefined {
  if (!fileName) return undefined;
  return fileName.replace(/\.[^.]+$/, "");
}

registerProvider(new N8nProvider());
