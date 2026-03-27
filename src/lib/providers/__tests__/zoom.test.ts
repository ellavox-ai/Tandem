import { describe, it, expect } from "vitest";
import { parseVTT, ZoomProvider } from "../zoom";
import fs from "fs";
import path from "path";

describe("parseVTT", () => {
  it("parses a multi-speaker VTT into utterances", () => {
    const vtt = fs.readFileSync(
      path.join(process.cwd(), "test/fixtures/sample.vtt"),
      "utf-8"
    );
    const utterances = parseVTT(vtt);

    expect(utterances).toHaveLength(4);
    expect(utterances[0]).toEqual({
      speaker: "Sean",
      text: "Alright, let's get started. First up, the AppFolio webhook integration.",
      startTime: 1,
      endTime: 5,
    });
    expect(utterances[1].speaker).toBe("Alex");
    expect(utterances[3].speaker).toBe("Jordan");
  });

  it("returns an empty array for empty string", () => {
    expect(parseVTT("")).toEqual([]);
  });

  it("returns an empty array for WEBVTT header only", () => {
    expect(parseVTT("WEBVTT\n\n")).toEqual([]);
  });

  it("skips malformed blocks without timestamp lines", () => {
    const vtt = `WEBVTT

This is not a timestamp
Sean: Some text

00:00:01.000 --> 00:00:05.000
Alex: Valid utterance`;

    const utterances = parseVTT(vtt);
    expect(utterances).toHaveLength(1);
    expect(utterances[0].speaker).toBe("Alex");
  });

  it("parses single-speaker VTT", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
Narrator: Welcome to the meeting.

00:00:04.000 --> 00:00:08.000
Narrator: Let's begin.`;

    const utterances = parseVTT(vtt);
    expect(utterances).toHaveLength(2);
    expect(utterances[0].speaker).toBe("Narrator");
    expect(utterances[1].speaker).toBe("Narrator");
  });

  it("handles text without speaker attribution", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:05.000
Just some text without a speaker`;

    const utterances = parseVTT(vtt);
    expect(utterances).toHaveLength(1);
    expect(utterances[0].speaker).toBe("Unknown");
    expect(utterances[0].text).toBe("Just some text without a speaker");
  });

  it("parses timestamps correctly including hours", () => {
    const vtt = `WEBVTT

01:30:00.000 --> 01:30:05.500
Sean: Late in the meeting`;

    const utterances = parseVTT(vtt);
    expect(utterances[0].startTime).toBe(5400);
    expect(utterances[0].endTime).toBe(5405.5);
  });
});

describe("ZoomProvider", () => {
  const provider = new ZoomProvider();

  describe("validateWebhook", () => {
    it("returns true for URL validation events", () => {
      const result = provider.validateWebhook({}, {
        event: "endpoint.url_validation",
      });
      expect(result).toBe(true);
    });

    it("returns true for regular events without verification token", () => {
      const result = provider.validateWebhook(
        {},
        { event: "recording.completed" }
      );
      expect(result).toBe(true);
    });
  });

  describe("parseWebhook", () => {
    it("parses a valid recording.completed event", () => {
      const body = {
        event: "recording.completed",
        payload: {
          object: {
            uuid: "meeting-uuid-123",
            id: 12345,
            topic: "Sprint Planning",
            start_time: "2026-03-26T10:00:00Z",
            duration: 60,
            recording_files: [
              {
                id: "file-1",
                file_type: "TRANSCRIPT",
                download_url: "https://zoom.us/download/transcript",
                recording_type: "audio_transcript",
              },
            ],
          },
        },
      };

      const result = provider.parseWebhook(body);
      expect(result).toEqual({
        externalId: "meeting-uuid-123",
        metadata: {
          meetingId: 12345,
          topic: "Sprint Planning",
          startTime: "2026-03-26T10:00:00Z",
          duration: 60,
          downloadUrl: "https://zoom.us/download/transcript",
        },
      });
    });

    it("returns null for non-recording events", () => {
      expect(
        provider.parseWebhook({ event: "meeting.started" })
      ).toBeNull();
    });

    it("returns null for missing event field", () => {
      expect(provider.parseWebhook({})).toBeNull();
    });

    it("returns null when no transcript file in recording", () => {
      const body = {
        event: "recording.completed",
        payload: {
          object: {
            uuid: "uuid-456",
            recording_files: [
              { id: "f1", file_type: "MP4", download_url: "", recording_type: "shared_screen" },
            ],
          },
        },
      };
      expect(provider.parseWebhook(body)).toBeNull();
    });

    it("returns null when recording has no uuid", () => {
      const body = {
        event: "recording.completed",
        payload: { object: {} },
      };
      expect(provider.parseWebhook(body)).toBeNull();
    });
  });
});
