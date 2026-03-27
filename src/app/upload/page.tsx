"use client";

import { useState, useRef } from "react";

export default function UploadPage() {
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [attendees, setAttendees] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteContent, setPasteContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    transcriptId?: string;
    error?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!meetingTitle || !meetingDate) return;
    if (!file && !pasteContent.trim()) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.set("meetingTitle", meetingTitle);
      formData.set("meetingDate", meetingDate);

      if (attendees.trim()) {
        formData.set("attendees", attendees.trim());
      }

      if (pasteMode) {
        const blob = new Blob([pasteContent], { type: "text/plain" });
        formData.set("file", blob, "transcript.txt");
      } else if (file) {
        formData.set("file", file);
      }

      const res = await fetch("/api/transcripts/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ ok: true, transcriptId: data.transcriptId });
        setMeetingTitle("");
        setPasteContent("");
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setResult({ ok: false, error: data.error });
      }
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Upload Transcript</h1>
        <p className="mt-1 text-[13px] text-[var(--foreground-secondary)]">
          Upload a meeting transcript or paste it directly. The pipeline will extract
          action items and route them.
        </p>
      </div>

      {/* Result banner */}
      {result && (
        <div
          className={`rounded-lg border p-4 mb-6 animate-fade-in ${
            result.ok
              ? "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[var(--success-muted)]"
              : "border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[var(--danger-muted)]"
          }`}
        >
          {result.ok ? (
            <div>
              <p className="text-[13px] font-medium text-[var(--success)]">
                Transcript uploaded and queued for processing.
              </p>
              <p className="text-[12px] mt-1 text-[var(--foreground-secondary)]">
                ID: <span className="font-mono">{result.transcriptId?.slice(0, 8)}</span> &mdash;{" "}
                <a href="/interviews" className="text-[var(--accent)] hover:underline">
                  Interview Queue
                </a>{" "}
                &middot;{" "}
                <a href="/dashboard" className="text-[var(--accent)] hover:underline">
                  Dashboard
                </a>
              </p>
            </div>
          ) : (
            <p className="text-[13px] font-medium text-[var(--danger)]">
              {result.error}
            </p>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[12px] font-medium text-[var(--foreground-secondary)] uppercase tracking-wider mb-1.5">
            Meeting Title
          </label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="e.g., Sprint Planning — Week 13"
            required
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[var(--foreground-secondary)] uppercase tracking-wider mb-1.5">
            Meeting Date
          </label>
          <input
            type="datetime-local"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            required
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[var(--foreground-secondary)] uppercase tracking-wider mb-1.5">
            Attendees
            <span className="ml-1 font-normal normal-case tracking-normal text-[var(--foreground-tertiary)]">
              (optional, comma-separated)
            </span>
          </label>
          <input
            type="text"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            placeholder='Sean, Alex, Jordan'
            className="w-full"
          />
        </div>

        {/* Mode toggle */}
        <div>
          <label className="block text-[12px] font-medium text-[var(--foreground-secondary)] uppercase tracking-wider mb-2">
            Transcript Source
          </label>
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--background-secondary)] p-0.5">
            <button
              type="button"
              onClick={() => setPasteMode(false)}
              className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all ${
                !pasteMode
                  ? "bg-[var(--surface-active)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setPasteMode(true)}
              className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all ${
                pasteMode
                  ? "bg-[var(--surface-active)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
              }`}
            >
              Paste Text
            </button>
          </div>
        </div>

        {pasteMode ? (
          <div>
            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              rows={12}
              placeholder={`Paste your transcript here...\n\nSean: Let's talk about the AppFolio integration.\nAlex: I can take that. I'll have the webhook done by Friday.\nSean: Great. Jordan, can you handle the latency investigation?\nJordan: Sure, I'll look into it this week.`}
              className="w-full font-mono text-[13px] leading-relaxed"
            />
          </div>
        ) : (
          <div className="relative">
            <div
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                file
                  ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                  : "border-[var(--border)] hover:border-[var(--foreground-tertiary)]"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".vtt,.srt,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {file ? (
                <div>
                  <svg className="w-8 h-8 mx-auto text-[var(--accent)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[13px] font-medium text-[var(--foreground)]">{file.name}</p>
                  <p className="text-[11px] text-[var(--foreground-tertiary)] mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 mx-auto text-[var(--foreground-tertiary)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-[13px] text-[var(--foreground-secondary)]">
                    Drop a file here or click to browse
                  </p>
                  <p className="text-[11px] text-[var(--foreground-tertiary)] mt-0.5">
                    Supports .vtt, .srt, or .txt
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !meetingTitle || (!file && !pasteContent.trim())}
          className="w-full rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(99,132,255,0.15)] hover:shadow-[0_0_30px_rgba(99,132,255,0.25)]"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : (
            "Upload & Process"
          )}
        </button>
      </form>
    </div>
  );
}
