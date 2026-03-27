# Insights Agent — Feature Proposal

An agent that evaluates meeting transcripts across time to surface common themes, gaps in follow-through, risks/caveats, and actionable improvements.

## Motivation

The current pipeline extracts tasks from individual transcripts, but never looks across meetings. Patterns like "this topic keeps coming up and never gets resolved" or "we always defer decisions about X" are invisible today.

## What the Agent Produces

| Section | Description |
|---------|-------------|
| **Themes** | Recurring topics, projects, or concerns across meetings — with frequency counts and supporting quotes |
| **Gaps** | Action items discussed but never extracted, follow-ups that stalled, decisions deferred without resolution |
| **Caveats / Risks** | Concerns raised but not addressed, dependencies flagged but not tracked |
| **Improvements** | Meeting efficiency suggestions, communication patterns, decision-making observations |
| **Executive Summary** | 2-3 sentence overview of the analysis |

## Architecture

```
User clicks "Generate Insights"
  → POST /api/insights/generate
  → insights-agent.ts
    → Fetches completed transcripts (full_text) + extracted tasks from Supabase
    → Builds prompt with transcript texts, meeting metadata, task outcomes
    → Calls Claude via generateText + Output.object({ schema })
  → Stores result in meeting_insights table
  → Returns to /insights page
```

Follows the same pattern as `extraction-agent.ts`: function-based module, Zod schema, Vercel AI SDK `generateText`, `supabaseAdmin` for persistence.

## New Files

- `src/lib/agents/insights-agent.ts` — agent with `generateInsights()` and `storeInsights()`
- `src/lib/agents/schemas.ts` — add Zod schemas (themes, gaps, caveats, improvements)
- `src/lib/services/insights.ts` — thin service wrapper + `listInsights()`
- `src/lib/types/index.ts` — add `InsightsResult`, `MeetingInsightsRow`
- `src/lib/agents/index.ts` — add exports
- `supabase/migrations/005_add_meeting_insights.sql` — new table
- `src/app/api/insights/route.ts` — GET list of past reports
- `src/app/api/insights/generate/route.ts` — POST to generate new report
- `src/app/api/insights/[id]/route.ts` — GET single report
- `src/app/insights/page.tsx` — new page with generate button, results display, history
- `src/app/layout.tsx` — add "Insights" nav link

## Database Table

```sql
create table meeting_insights (
  id                 uuid primary key default uuid_generate_v4(),
  summary            text not null,
  themes             jsonb not null default '[]',
  gaps               jsonb not null default '[]',
  caveats            jsonb not null default '[]',
  improvements       jsonb not null default '[]',
  transcript_count   integer not null,
  date_range_start   timestamptz,
  date_range_end     timestamptz,
  processing_time_ms integer,
  created_at         timestamptz not null default now()
);
```

## Open Design Questions

### 1. Token budget / scale

The insights agent needs to process many transcripts in a single Claude call. With 30 transcripts at ~10k tokens each, that's 300k input tokens — potentially exceeding context limits or getting very expensive.

**Options:**
- **Two-pass**: Summarize each transcript individually, then analyze summaries (better quality, 2x cost)
- **Recent cap**: Only analyze the most recent N transcripts (simpler, might miss older patterns)
- **Start simple**: Cap at N transcripts now, add two-pass later if needed

### 2. Processing model

Generating insights could take 30-60+ seconds. A synchronous API call might time out.

**Options:**
- **Synchronous with spinner**: Simple, but risky for large transcript sets
- **Background job via BullMQ**: Robust (matches existing pipeline), more complex to wire up
- **Synchronous for now**: Switch to background job if timeouts become a problem

### 3. Minimum transcript threshold

"Find common themes" is meaningless with 0 or 1 transcripts. Need a minimum (2+) and a helpful empty state message.

### 4. Recurring vs. one-off meetings

A "Weekly Standup" series would benefit from isolated trend analysis vs. being mixed with ad-hoc meetings. Should we support filtering by meeting title pattern or series?

### 5. Task outcome awareness

The agent should cross-reference extracted tasks to identify gaps. But `pending_interview` tasks aren't "dropped" — they're just not processed yet. The prompt needs to distinguish:
- **Dropped**: discussed in meeting, never became a task
- **Stalled**: extracted but sitting in pending_interview for a long time
- **In progress**: pending_interview or claimed — not a gap

### 6. Missing TypeScript type

Migration 002 added `full_text` to the `transcripts` table, but `TranscriptRow` in `src/lib/types/index.ts` was never updated. Must fix this for the insights agent to work.

### 7. Incremental vs. standalone reports

Should each insights report be standalone, or should new reports reference previous ones to show how things are trending? Standalone is simpler; incremental is more useful over time.
