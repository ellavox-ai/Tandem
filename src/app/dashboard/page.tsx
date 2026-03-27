"use client";

import { useEffect, useState } from "react";

interface Stats {
  totals: {
    transcripts: number;
    tasks: number;
    pendingInterviews: number;
    failedJiraCreations: number;
  };
  last24h: {
    transcriptsProcessed: number;
    tasksCreated: number;
  };
}

interface Transcript {
  id: string;
  provider: string;
  meeting_title: string;
  meeting_date: string;
  status: string;
  utterance_count: number;
  created_at: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, transcriptsRes] = await Promise.all([
          fetch("/api/dashboard/stats"),
          fetch("/api/transcripts?limit=20"),
        ]);
        const statsData = await statsRes.json();
        const transcriptsData = await transcriptsRes.json();
        setStats(statsData);
        setTranscripts(transcriptsData.transcripts || []);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-6 w-32 skeleton" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-64 skeleton rounded-xl" />
      </div>
    );
  }

  const STAT_CARDS = [
    {
      label: "Total Transcripts",
      value: stats?.totals.transcripts ?? 0,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      color: "var(--accent)",
    },
    {
      label: "Tasks Extracted",
      value: stats?.totals.tasks ?? 0,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "var(--success)",
    },
    {
      label: "Pending Reviews",
      value: stats?.totals.pendingInterviews ?? 0,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: (stats?.totals.pendingInterviews ?? 0) > 0 ? "var(--warning)" : "var(--foreground-tertiary)",
    },
    {
      label: "Failed Pushes",
      value: stats?.totals.failedJiraCreations ?? 0,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
      color: (stats?.totals.failedJiraCreations ?? 0) > 0 ? "var(--danger)" : "var(--foreground-tertiary)",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-[var(--foreground-secondary)] mt-1">
          Pipeline performance and processing overview
        </p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAT_CARDS.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: `color-mix(in srgb, ${card.color} 12%, transparent)`,
                  color: card.color,
                }}
              >
                {card.icon}
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: card.color }}>
              {card.value}
            </p>
            <p className="text-[11px] text-[var(--foreground-tertiary)] mt-0.5 uppercase tracking-wider font-medium">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* 24h stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[var(--foreground-tertiary)] uppercase tracking-wider font-medium">
              Transcripts (24h)
            </p>
            <p className="text-xl font-bold mt-1 tabular-nums">
              {stats?.last24h.transcriptsProcessed ?? 0}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[var(--foreground-tertiary)] uppercase tracking-wider font-medium">
              Tasks Created (24h)
            </p>
            <p className="text-xl font-bold mt-1 tabular-nums">
              {stats?.last24h.tasksCreated ?? 0}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[var(--success-muted)] flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        </div>
      </div>

      {/* Recent transcripts */}
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--foreground-tertiary)] mb-3">
          Recent Transcripts
        </h2>

        {transcripts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
            <p className="text-[13px] text-[var(--foreground-tertiary)]">
              No transcripts processed yet. Upload one to get started.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3">Meeting</th>
                  <th className="text-left px-4 py-3">Provider</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Segments</th>
                </tr>
              </thead>
              <tbody>
                {transcripts.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{t.meeting_title}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[var(--foreground-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--foreground-tertiary)]" />
                        {t.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--foreground-secondary)] tabular-nums">
                      {new Date(t.meeting_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--foreground-secondary)] tabular-nums font-mono text-[12px]">
                      {t.utterance_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string }> = {
    pending: { color: "var(--foreground-tertiary)", bg: "var(--surface-active)" },
    processing: { color: "var(--info)", bg: "var(--info-muted)" },
    completed: { color: "var(--success)", bg: "var(--success-muted)" },
    failed: { color: "var(--danger)", bg: "var(--danger-muted)" },
  };

  const c = config[status] || config.pending;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${status === "processing" ? "animate-pulse-dot" : ""}`}
        style={{ backgroundColor: c.color }}
      />
      {status}
    </span>
  );
}
