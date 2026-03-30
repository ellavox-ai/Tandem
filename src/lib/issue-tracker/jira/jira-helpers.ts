import type { RequirementsOutput } from "@/lib/agents/schemas";
import type { ExtractedTaskRow } from "@/lib/types";

// ─── Atlassian Document Format (ADF) ─────────────────────────────────────────

type AdfNode =
  | { type: "doc"; version: 1; content: AdfNode[] }
  | { type: "paragraph"; content: AdfInlineNode[] }
  | { type: "bulletList"; content: AdfNode[] }
  | { type: "orderedList"; content: AdfNode[] }
  | { type: "listItem"; content: AdfNode[] }
  | { type: "blockquote"; content: AdfNode[] }
  | { type: "rule" }
  | { type: "heading"; attrs: { level: number }; content: AdfInlineNode[] }
  | { type: "taskList"; attrs: { localId: string }; content: AdfNode[] }
  | { type: "taskItem"; attrs: { localId: string; state: "TODO" | "DONE" }; content: AdfInlineNode[] };

type AdfInlineNode =
  | { type: "text"; text: string; marks?: AdfMark[] }
  | { type: "hardBreak" };

type AdfMark =
  | { type: "strong" }
  | { type: "em" };

function textNode(text: string, marks?: AdfMark[]): AdfInlineNode {
  const node: AdfInlineNode = { type: "text", text };
  if (marks?.length) (node as { marks?: AdfMark[] }).marks = marks;
  return node;
}

function paragraph(...content: AdfInlineNode[]): AdfNode {
  return { type: "paragraph", content };
}

function heading(level: number, text: string): AdfNode {
  return { type: "heading", attrs: { level }, content: [textNode(text)] };
}

function bulletList(items: string[]): AdfNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem" as const,
      content: [paragraph(textNode(item))],
    })),
  };
}

function taskList(items: string[]): AdfNode {
  return {
    type: "taskList",
    attrs: { localId: crypto.randomUUID() },
    content: items.map((item) => ({
      type: "taskItem" as const,
      attrs: { localId: crypto.randomUUID(), state: "TODO" as const },
      content: [textNode(item)],
    })),
  };
}

function blockquote(text: string): AdfNode {
  return {
    type: "blockquote",
    content: [paragraph(textNode(text))],
  };
}

function rule(): AdfNode {
  return { type: "rule" };
}

export function buildRequirementsAdf(requirements: RequirementsOutput): AdfNode {
  const content: AdfNode[] = [];

  for (const para of requirements.description.split("\n\n")) {
    const trimmed = para.trim();
    if (trimmed) content.push(paragraph(textNode(trimmed)));
  }

  if (requirements.acceptanceCriteria.length > 0) {
    content.push(rule());
    content.push(heading(3, "Acceptance Criteria"));
    content.push(taskList(requirements.acceptanceCriteria));
  }

  if (requirements.technicalNotes) {
    content.push(rule());
    content.push(heading(3, "Technical Notes"));
    for (const para of requirements.technicalNotes.split("\n\n")) {
      const trimmed = para.trim();
      if (trimmed) content.push(paragraph(textNode(trimmed)));
    }
  }

  if (requirements.blockedBy?.length) {
    content.push(rule());
    content.push(heading(3, "Dependencies"));
    content.push(bulletList(requirements.blockedBy));
  }

  return { type: "doc", version: 1, content };
}

export function buildLegacyAdf(task: ExtractedTaskRow): AdfNode {
  const content: AdfNode[] = [];

  for (const para of task.extracted_description.split("\n\n")) {
    const trimmed = para.trim();
    if (trimmed) content.push(paragraph(textNode(trimmed)));
  }

  if (task.source_quotes?.length) {
    content.push(rule());
    content.push(
      paragraph(textNode("Source quotes from meeting transcript:", [{ type: "em" }]))
    );
    for (const quote of task.source_quotes) {
      const ts = quote.timestamp
        ? ` (${Math.floor(quote.timestamp / 60)}:${String(Math.floor(quote.timestamp % 60)).padStart(2, "0")})`
        : "";
      content.push(blockquote(`${quote.text}${ts}`));
    }
  }

  if (task.interview_responses) {
    content.push(rule());
    content.push(paragraph(textNode("Interview responses:", [{ type: "em" }])));
    for (const [question, answer] of Object.entries(task.interview_responses)) {
      content.push(
        paragraph(textNode(question, [{ type: "strong" }]))
      );
      content.push(paragraph(textNode(answer)));
    }
  }

  return { type: "doc", version: 1, content };
}

export function mapPriority(priority: string): string {
  switch (priority) {
    case "P0": return "Highest";
    case "P1": return "High";
    case "P2": return "Medium";
    case "P3": return "Low";
    default: return "Medium";
  }
}

export function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;

  const distance = levenshteinDistance(longer, shorter);
  return 1 - distance / longer.length;
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}
