import Link from "next/link";

const FEATURES = [
  {
    title: "Upload Transcript",
    description: "Ingest meeting transcripts from any provider or paste them directly.",
    href: "/upload",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
    accent: "var(--accent)",
  },
  {
    title: "Interview Queue",
    description: "AI-powered interviews refine ambiguous tasks before they reach Jira.",
    href: "/interviews",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    accent: "var(--purple)",
  },
  {
    title: "Task Management",
    description: "Review completed interviews and push refined tasks to Jira.",
    href: "/tasks",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: "var(--success)",
  },
  {
    title: "Pipeline Analytics",
    description: "Monitor extraction performance, processing rates, and error states.",
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    accent: "var(--info)",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-12 py-8 animate-fade-in">
      {/* Hero */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-72 h-72 bg-[var(--accent)] opacity-[0.03] rounded-full blur-3xl pointer-events-none" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)] mb-3">
          Meeting Intelligence
        </p>
        <h1 className="text-3xl font-bold tracking-tight leading-tight">
          From meetings to action,
          <br />
          <span className="text-[var(--foreground-secondary)]">automatically.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--foreground-secondary)] max-w-lg">
          Ellavox extracts action items from meeting transcripts, interviews humans for
          missing context, and creates Jira tickets — all on autopilot.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FEATURES.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--border-accent)] hover:bg-[var(--surface-hover)] transition-all duration-200"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ backgroundColor: `color-mix(in srgb, ${feature.accent} 12%, transparent)`, color: feature.accent }}
            >
              {feature.icon}
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
              {feature.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--foreground-secondary)]">
              {feature.description}
            </p>
            <svg
              className="absolute top-5 right-5 w-4 h-4 text-[var(--foreground-tertiary)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ))}
      </div>

      {/* Quick setup nudge */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--warning-muted)] flex items-center justify-center">
            <svg className="w-5 h-5 text-[var(--warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--foreground)]">Configure your pipeline</p>
            <p className="text-[12px] text-[var(--foreground-tertiary)]">Connect Jira and set confidence thresholds to get started</p>
          </div>
        </div>
        <Link
          href="/setup"
          className="text-[13px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          Setup Guide &rarr;
        </Link>
      </div>
    </div>
  );
}
