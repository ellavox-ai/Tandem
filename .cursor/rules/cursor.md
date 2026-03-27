# Ellavox — Cursor Agent Instructions

You are working on **Ellavox**, a meeting intelligence pipeline that converts meeting transcripts into structured, routed Jira cards.

## Pipeline

Ingestion → Extraction (Claude) → Confidence Routing → Interview (if needed) → Requirements Refinement → Routing Agent → Jira Creation

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS 4 via PostCSS, design tokens as CSS variables in `globals.css` |
| Database | Supabase (Postgres, Auth, Realtime, RLS) |
| Queue | Redis + BullMQ |
| AI | Claude Sonnet via Vercel AI SDK (`generateText` + `Output.object`) |
| Voice | OpenAI Realtime API (WebRTC data channel) |
| Issue Tracker | Jira Cloud REST API v3 (ADF descriptions) |
| Notifications | Slack Incoming Webhooks (Block Kit format) |
| Logging | Pino structured JSON (child loggers per service) |
| Testing | Vitest + vite-tsconfig-paths |
| Module | ESM (`"type": "module"`) |

## Before You Code

- Read before editing — always read a file before modifying it
- Check `lib/types/index.ts` for shared types and `CONFIG_KEYS` before creating new ones
- Check `lib/agents/schemas.ts` for existing Zod schemas before adding new ones
- Check `src/components/` for existing UI components before creating new ones

## Code Style (non-negotiable)

- Double quotes, semicolons, 2-space indent
- `@/` path alias for all imports from `src/`
- `import type` for type-only imports
- No `any` — use `unknown` with narrowing
- No `console.log` — use Pino: `const log = logger.child({ service: "name" })`
- No comments that narrate what code does — comments explain *why*, not *what*
- Explicit return types on all exported functions
- `async/await` over raw `.then()` chains

## Project Structure

| Location | Convention |
|----------|-----------|
| `src/app/**/page.tsx` | Server Component by default, `"use client"` only when needed |
| `src/app/api/**/route.ts` | Route Handlers with `NextRequest`/`NextResponse` |
| `src/components/` | Shared UI components (Sidebar, etc.) |
| `src/lib/agents/*.ts` | AI agents using Vercel AI SDK, Zod schemas for I/O |
| `src/lib/services/*.ts` | Business logic, Supabase queries, external API calls |
| `src/lib/providers/*.ts` | Transcript source adapters implementing `TranscriptProviderAdapter` |
| `src/lib/jobs/*.ts` | BullMQ queue definitions and job processors |
| `src/hooks/*.ts` | React hooks for client-side state and subscriptions |
| `src/lib/types/index.ts` | All shared types + `CONFIG_KEYS` constants |
| `src/lib/agents/schemas.ts` | All Zod schemas for agent I/O |
| `supabase/migrations/*.sql` | Sequential numbered SQL files |
| `src/**/__tests__/*.test.ts` | Co-located Vitest tests |
| `test/fixtures/` | Sample transcript files for tests |

## What NOT to Do

- Don't store secrets in the database — use `.env` / `.env.local`
- Don't create Tailwind config files — v4 uses PostCSS + `globals.css`
- Don't add new dependencies without checking if the existing stack covers it
- Don't use `fetch` for Supabase queries — use `supabaseAdmin` or `createSupabaseClient`
- Don't skip error handling on Supabase or Jira API calls
- Don't use plain text for Jira descriptions — use ADF (Atlassian Document Format)
- Don't use `console.log` — use Pino child loggers

## Running & Testing

| Command | Purpose |
|---------|---------|
| `npm run dev:all` | Start everything (Supabase, Redis, worker, Next.js) |
| `npm run dev` | Next.js dev server only |
| `npm run worker` | BullMQ worker only |
| `npm run lint` | ESLint via Next.js |
| `npm run stop` | Tear down all services |
| `npx vitest` | Run tests |
| Local Supabase Studio | http://127.0.0.1:54323 |
