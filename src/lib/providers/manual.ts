import type { NormalizedTranscript, Utterance, Attendee } from "@/lib/types";
import type { TranscriptProviderAdapter, ProviderConfig } from "./base";
import { registerProvider } from "./base";
import { parseVTT } from "./zoom";
import { logger } from "@/lib/logger";
import { v4 as uuid } from "uuid";

/**
 * Manual transcript upload provider.
 *
 * Supports .vtt, .txt, and .srt file uploads via the web UI.
 * User provides meeting metadata (title, date, attendees) manually.
 */
export class ManualProvider implements TranscriptProviderAdapter {
  readonly name = "manual";

  async initialize(_config: ProviderConfig) {
    logger.info({ provider: this.name }, "Manual provider initialized");
  }

  async startListening() {
    // No-op — manual uploads come through the API
  }

  async stopListening() {
    // No-op
  }

  validateWebhook(): boolean {
    // Manual uploads don't use webhooks
    return false;
  }

  parseWebhook(): null {
    return null;
  }

  async fetchTranscript(): Promise<NormalizedTranscript> {
    throw new Error("Manual provider does not support fetchTranscript. Use parseUpload instead.");
  }

  /**
   * Parse a manually uploaded transcript file with user-provided metadata.
   */
  parseUpload(
    fileContent: string,
    format: "vtt" | "txt" | "srt",
    metadata: {
      meetingTitle: string;
      meetingDate: Date;
      duration?: number;
      attendees?: Attendee[];
    }
  ): NormalizedTranscript {
    let utterances: Utterance[];

    switch (format) {
      case "vtt":
        utterances = parseVTT(fileContent);
        break;
      case "srt":
        utterances = parseSRT(fileContent);
        break;
      case "txt":
        utterances = parsePlainText(fileContent);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return {
      provider: "manual",
      externalId: `manual-${uuid()}`,
      meetingTitle: metadata.meetingTitle,
      meetingDate: metadata.meetingDate,
      duration: metadata.duration || estimateDuration(utterances),
      attendees: metadata.attendees || extractSpeakers(utterances),
      utterances,
      rawFormat: format === "vtt" ? "vtt" : "text",
      metadata: { uploadedAt: new Date().toISOString() },
    };
  }
}

/** Parse SRT subtitle format (similar to VTT but with different timestamp format) */
function parseSRT(content: string): Utterance[] {
  const utterances: Utterance[] = [];
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    // SRT: sequence number, timestamp, text
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
  // Normalize to 3-digit milliseconds (SRT spec requires 3 digits, but be defensive)
  const normalizedMs = parseInt((ms + "000").slice(0, 3), 10);
  return (
    parseInt(parts[0], 10) * 3600 +
    parseInt(parts[1], 10) * 60 +
    parseInt(parts[2], 10) +
    normalizedMs / 1000
  );
}

/** Parse plain text — assumes "Speaker: text" format, one per line */
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
        endTime: currentTime + 5, // Estimate 5 seconds per line
      });
      currentTime += 5;
    }
  }

  return utterances;
}

function estimateDuration(utterances: Utterance[]): number {
  if (utterances.length === 0) return 0;
  return Math.max(...utterances.map((u) => u.endTime));
}

function extractSpeakers(utterances: Utterance[]): Attendee[] {
  const speakers = new Set(utterances.map((u) => u.speaker));
  return Array.from(speakers)
    .filter((s) => s !== "Unknown")
    .map((name) => ({ name }));
}

// Self-register
registerProvider(new ManualProvider());
