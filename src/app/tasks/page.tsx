"use client";

import { useEffect, useState, useCallback } from "react";

interface TaskTranscript {
  id: string;
  meeting_title: string;
  meeting_date: string;
  provider: string;
}

interface Task {
  id: string;
  extracted_title: string;
  extracted_description: string;
  inferred_assignees: { name: string; email?: string }[];
  confidence: string;
  priority: string;
  labels: string[];
  status: string;
  interview_responses: Record<string, string> | null;
  source_quotes: { text: string; timestamp: number }[];
  jira_project: string | null;
  jira_issue_key: string | null;
  jira_error: string | null;
  created_at: string;
  updated_at: string;
  transcript?: TaskTranscript;
}

type TabId = "completed" | "auto_created" | "pushed" | "failed";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "completed",
    label: "Reviewed",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "auto_created",
    label: "Auto-Created",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    id: "pushed",
    label: "In Jira",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    ),
  },
  {
    id: "failed",
    label: "Failed",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
];

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<TabId>("completed");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [pushingTasks, setPushingTasks] = useState<Set<string>>(new Set());
  const [pushResults, setPushResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [jiraBaseUrl, setJiraBaseUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => { if (data.jiraBaseUrl) setJiraBaseUrl(data.jiraBaseUrl); })
      .catch(() => {});
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let url: string;
      if (activeTab === "pushed") {
        const [completedRes, autoRes] = await Promise.all([
          fetch("/api/tasks?status=completed&limit=100"),
          fetch("/api/tasks?status=auto_created&limit=100"),
        ]);
        const [completedData, autoData] = await Promise.all([
          completedRes.json(),
          autoRes.json(),
        ]);
        const all = [...(completedData.tasks || []), ...(autoData.tasks || [])];
        setTasks(all.filter((t: Task) => t.jira_issue_key));
        setLoading(false);
        return;
      } else if (activeTab === "failed") {
        url = "/api/tasks?status=jira_failed&limit=100";
      } else {
        url = `/api/tasks?status=${activeTab}&limit=100`;
      }

      const res = await fetch(url);
      const data = await res.json();
      let filtered = data.tasks || [];

      if (activeTab === "completed" || activeTab === "auto_created") {
        filtered = filtered.filter((t: Task) => !t.jira_issue_key);
      }

      setTasks(filtered);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const pushToJira = async (taskId: string) => {
    setPushingTasks((prev) => new Set(prev).add(taskId));
    setPushResults((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });

    try {
      const res = await fetch(`/api/tasks/${taskId}/push-jira`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setPushResults((prev) => ({
          ...prev,
          [taskId]: {
            ok: true,
            message: data.alreadyExists
              ? `Already in Jira: ${data.issueKey}`
              : `Created ${data.issueKey}`,
          },
        }));
        setTimeout(fetchTasks, 1500);
      } else {
        setPushResults((prev) => ({
          ...prev,
          [taskId]: { ok: false, message: data.error || "Push failed" },
        }));
      }
    } catch (err) {
      setPushResults((prev) => ({
        ...prev,
        [taskId]: {
          ok: false,
          message: err instanceof Error ? err.message : "Network error",
        },
      }));
    } finally {
      setPushingTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const pushAll = async () => {
    const unpushed = tasks.filter((t) => !t.jira_issue_key);
    for (const task of unpushed) {
      await pushToJira(task.id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-[13px] text-[var(--foreground-secondary)] mt-1">
            Review extracted tasks and push to Jira
          </p>
        </div>
        {(activeTab === "completed" || activeTab === "auto_created") &&
          tasks.length > 0 && (
            <button
              onClick={pushAll}
              className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all shadow-[0_0_20px_rgba(99,132,255,0.15)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Push All ({tasks.length})
            </button>
          )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setExpandedTask(null);
            }}
            className={`flex items-center gap-1.5 flex-1 px-3 py-2 text-[13px] font-medium rounded-md transition-all ${
              activeTab === tab.id
                ? "bg-[var(--surface-active)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-16 text-center">
          <svg className="w-8 h-8 mx-auto text-[var(--foreground-tertiary)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p className="text-[13px] text-[var(--foreground-tertiary)]">No tasks in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              expanded={expandedTask === task.id}
              onToggle={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
              pushing={pushingTasks.has(task.id)}
              pushResult={pushResults[task.id]}
              onPush={() => pushToJira(task.id)}
              jiraBaseUrl={jiraBaseUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  expanded,
  onToggle,
  pushing,
  pushResult,
  onPush,
  jiraBaseUrl,
}: {
  task: Task;
  expanded: boolean;
  onToggle: () => void;
  pushing: boolean;
  pushResult?: { ok: boolean; message: string };
  onPush: () => void;
  jiraBaseUrl: string | null;
}) {
  return (
    <div
      className={`rounded-xl border bg-[var(--surface)] overflow-hidden transition-all ${
        expanded ? "border-[var(--border-accent)]" : "border-[var(--border)]"
      }`}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-medium truncate">
              {task.extracted_title}
            </h3>
            <PriorityBadge priority={task.priority} />
            <ConfidenceBadge confidence={task.confidence} />
            {task.jira_project && (
              <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-[var(--purple-muted)] text-[var(--purple)]">
                {task.jira_project}
              </span>
            )}
            {task.labels?.map((label) => (
              <span
                key={label}
                className="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-[var(--surface-active)] text-[var(--foreground-secondary)]"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--foreground-tertiary)]">
            {task.inferred_assignees?.length > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                {task.inferred_assignees.map((a) => a.name).join(", ")}
              </span>
            )}
            {task.transcript && (
              <span>{task.transcript.meeting_title}</span>
            )}
            <span className="tabular-nums">
              {new Date(task.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {task.jira_issue_key ? (
            <a
              href={jiraBaseUrl ? `${jiraBaseUrl}/browse/${task.jira_issue_key}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-[var(--success-muted)] text-[var(--success)] hover:bg-[var(--success)] hover:text-[var(--foreground-inverted)] transition-all"
              title={jiraBaseUrl ? `Open ${task.jira_issue_key} in Jira` : task.jira_issue_key}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {task.jira_issue_key}
              <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          ) : pushResult?.ok ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-[var(--success-muted)] text-[var(--success)] animate-fade-in">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {pushResult.message}
            </span>
          ) : (
            <button
              onClick={onPush}
              disabled={pushing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all"
            >
              {pushing ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Pushing...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Push to Jira
                </>
              )}
            </button>
          )}

          {(task.jira_error || pushResult?.ok === false) && (
            <span className="text-[10px] text-[var(--danger)] max-w-[160px] truncate" title={task.jira_error || pushResult?.message}>
              {task.jira_error || pushResult?.message}
            </span>
          )}

          <svg
            className={`w-4 h-4 text-[var(--foreground-tertiary)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-4 space-y-4 animate-fade-in">
          {/* Description */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-tertiary)] mb-1.5">
              Description
            </h4>
            <p className="text-[13px] leading-relaxed text-[var(--foreground-secondary)] whitespace-pre-wrap">
              {task.extracted_description}
            </p>
          </div>

          {/* Source quotes */}
          {task.source_quotes?.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-tertiary)] mb-1.5">
                Source Quotes
              </h4>
              <div className="space-y-1.5">
                {task.source_quotes.map((quote, i) => (
                  <blockquote
                    key={i}
                    className="text-[13px] italic border-l-2 border-[var(--accent)] pl-3 py-0.5 text-[var(--foreground-secondary)]"
                  >
                    &ldquo;{quote.text}&rdquo;
                    {quote.timestamp > 0 && (
                      <span className="text-[10px] font-mono ml-1.5 text-[var(--foreground-tertiary)] not-italic">
                        {Math.floor(quote.timestamp / 60)}:{String(Math.floor(quote.timestamp % 60)).padStart(2, "0")}
                      </span>
                    )}
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {/* Interview responses */}
          {task.interview_responses && Object.keys(task.interview_responses).length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-tertiary)] mb-2">
                Interview Responses
              </h4>
              <div className="space-y-3 rounded-lg bg-[var(--background-secondary)] p-3">
                {Object.entries(task.interview_responses).map(([question, answer], i) => (
                  <div key={i} className="text-[13px]">
                    <p className="font-medium text-[var(--foreground-tertiary)]">{question}</p>
                    <p className="mt-0.5 text-[var(--foreground-secondary)]">{answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-[var(--foreground-tertiary)] pt-3 border-t border-[var(--border-subtle)]">
            <span>{task.id.slice(0, 8)}</span>
            <span>{task.status}</span>
            {task.jira_project && <span>{task.jira_project}</span>}
            <span>{new Date(task.created_at).toLocaleString()}</span>
            {task.transcript && <span>{task.transcript.provider}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { color: string; bg: string }> = {
    P0: { color: "var(--danger)", bg: "var(--danger-muted)" },
    P1: { color: "var(--warning)", bg: "var(--warning-muted)" },
    P2: { color: "var(--info)", bg: "var(--info-muted)" },
    P3: { color: "var(--foreground-tertiary)", bg: "var(--surface-active)" },
  };
  const c = config[priority] || config.P3;
  return (
    <span
      className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {priority}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const config: Record<string, { color: string; bg: string }> = {
    high: { color: "var(--success)", bg: "var(--success-muted)" },
    medium: { color: "var(--warning)", bg: "var(--warning-muted)" },
    low: { color: "var(--danger)", bg: "var(--danger-muted)" },
  };
  const c = config[confidence] || config.low;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: c.color }} />
      {confidence}
    </span>
  );
}
