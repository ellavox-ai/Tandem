import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { refineRequirements } from "@/lib/agents/requirements-agent";
import type { RequirementsOutput } from "@/lib/agents/schemas";
import type { ExtractedTaskRow, JiraCreateResult } from "@/lib/types";

// ─── Atlassian Document Format (ADF) helpers ────────────────────────────────
// Jira REST API v3 requires description in ADF, not plain text.

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

/**
 * Build an ADF document for the requirements-based Jira description.
 */
/** @internal Exported for testing */
export function buildRequirementsAdf(requirements: RequirementsOutput): AdfNode {
  const content: AdfNode[] = [];

  // Main description as paragraphs
  for (const para of requirements.description.split("\n\n")) {
    const trimmed = para.trim();
    if (trimmed) content.push(paragraph(textNode(trimmed)));
  }

  // Acceptance criteria as a task list (checkboxes)
  if (requirements.acceptanceCriteria.length > 0) {
    content.push(rule());
    content.push(heading(3, "Acceptance Criteria"));
    content.push(taskList(requirements.acceptanceCriteria));
  }

  // Technical notes
  if (requirements.technicalNotes) {
    content.push(rule());
    content.push(heading(3, "Technical Notes"));
    for (const para of requirements.technicalNotes.split("\n\n")) {
      const trimmed = para.trim();
      if (trimmed) content.push(paragraph(textNode(trimmed)));
    }
  }

  // Dependencies
  if (requirements.blockedBy?.length) {
    content.push(rule());
    content.push(heading(3, "Dependencies"));
    content.push(bulletList(requirements.blockedBy));
  }

  return { type: "doc", version: 1, content };
}

/**
 * Build an ADF document for the legacy (non-requirements) Jira description.
 */
/** @internal Exported for testing */
export function buildLegacyAdf(task: ExtractedTaskRow): AdfNode {
  const content: AdfNode[] = [];

  // Main description
  for (const para of task.extracted_description.split("\n\n")) {
    const trimmed = para.trim();
    if (trimmed) content.push(paragraph(textNode(trimmed)));
  }

  // Source quotes
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

  // Interview responses
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

interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  defaultProject: string;
}

/** @internal Exported for testing */
export function getJiraConfig(): JiraConfig {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const defaultProject = process.env.JIRA_DEFAULT_PROJECT || "SCRUM";

  if (!baseUrl || !email || !apiToken) {
    throw new Error("JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN are required");
  }

  return { baseUrl, email, apiToken, defaultProject };
}

function jiraHeaders(config: JiraConfig): Record<string, string> {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  return {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Create a Jira issue from an extracted task.
 */
export async function createJiraIssue(
  task: ExtractedTaskRow,
  projectKey?: string
): Promise<JiraCreateResult> {
  const config = getJiraConfig();
  const project = projectKey || config.defaultProject;
  const log = logger.child({ taskId: task.id, project });

  // Resolve assignee if we have an email
  let assigneeAccountId: string | undefined;
  const primaryAssignee = task.inferred_assignees?.[0];
  if (primaryAssignee?.email) {
    assigneeAccountId = await lookupJiraAccountId(config, primaryAssignee.email);
  }

  const description = buildLegacyAdf(task);

  const payload: Record<string, unknown> = {
    fields: {
      project: { key: project },
      summary: task.extracted_title,
      description,
      issuetype: { name: "Task" },
      priority: { name: mapPriority(task.priority) },
      labels: task.labels || [],
    },
  };

  if (assigneeAccountId) {
    (payload.fields as Record<string, unknown>).assignee = {
      accountId: assigneeAccountId,
    };
  }

  log.info({ summary: task.extracted_title }, "Creating Jira issue");

  const response = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: jiraHeaders(config),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log.error(
      { status: response.status, body: errorBody },
      "Jira issue creation failed"
    );
    throw new Error(`Jira API error ${response.status}: ${errorBody}`);
  }

  const result = (await response.json()) as { key: string; self: string };

  // Add watchers for additional assignees
  if (task.inferred_assignees?.length > 1) {
    for (const assignee of task.inferred_assignees.slice(1)) {
      if (assignee.email) {
        const watcherAccountId = await lookupJiraAccountId(config, assignee.email);
        if (watcherAccountId) {
          await addWatcher(config, result.key, watcherAccountId).catch((err) =>
            log.warn({ err, email: assignee.email }, "Failed to add watcher")
          );
        }
      }
    }
  }

  const issueUrl = `${config.baseUrl}/browse/${result.key}`;
  log.info({ issueKey: result.key, issueUrl }, "Jira issue created");

  // Update the task row with the Jira issue key
  await supabaseAdmin
    .from("extracted_tasks")
    .update({ jira_issue_key: result.key })
    .eq("id", task.id);

  return { issueKey: result.key, issueUrl };
}

/**
 * Refine a task through the requirements agent, then create a Jira issue
 * from the structured output. This is the preferred path for all new issues.
 *
 * Accepts either a taskId (fetches from DB) or a pre-loaded task row.
 * Returns the Jira result plus the refined title for use in notifications.
 */
export async function createJiraIssueWithRequirements(
  taskOrId: string | ExtractedTaskRow,
  projectKey?: string
): Promise<JiraCreateResult & { refinedTitle: string }> {
  const config = getJiraConfig();
  const project = projectKey || config.defaultProject;

  let task: ExtractedTaskRow;
  if (typeof taskOrId === "string") {
    const { data, error } = await supabaseAdmin
      .from("extracted_tasks")
      .select("*, transcript:transcripts(*)")
      .eq("id", taskOrId)
      .single();
    if (error || !data) throw new Error(`Task not found: ${taskOrId}`);
    task = data;
  } else {
    task = taskOrId;
  }

  const log = logger.child({ taskId: task.id, project });

  const requirements = await refineRequirements(task);

  let assigneeAccountId: string | undefined;
  if (requirements.assignee?.email) {
    assigneeAccountId = await lookupJiraAccountId(
      config,
      requirements.assignee.email
    );
  }

  const description = buildRequirementsAdf(requirements);

  const payload: Record<string, unknown> = {
    fields: {
      project: { key: project },
      summary: requirements.title,
      description,
      issuetype: { name: requirements.issueType },
      priority: { name: mapPriority(requirements.priority) },
      labels: requirements.labels,
    },
  };

  if (assigneeAccountId) {
    (payload.fields as Record<string, unknown>).assignee = {
      accountId: assigneeAccountId,
    };
  }

  const storyPointsField = process.env.JIRA_STORY_POINTS_FIELD;
  if (requirements.storyPoints && storyPointsField) {
    (payload.fields as Record<string, unknown>)[storyPointsField] =
      Number(requirements.storyPoints);
  }

  log.info({ summary: requirements.title }, "Creating Jira issue from refined requirements");

  const response = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: jiraHeaders(config),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log.error(
      { status: response.status, body: errorBody },
      "Jira issue creation failed"
    );
    throw new Error(`Jira API error ${response.status}: ${errorBody}`);
  }

  const result = (await response.json()) as { key: string; self: string };
  const issueUrl = `${config.baseUrl}/browse/${result.key}`;

  // Add watchers for additional assignees from the original task
  if (task.inferred_assignees?.length > 1) {
    for (const assignee of task.inferred_assignees.slice(1)) {
      if (assignee.email) {
        const watcherAccountId = await lookupJiraAccountId(config, assignee.email);
        if (watcherAccountId) {
          await addWatcher(config, result.key, watcherAccountId).catch((err) =>
            log.warn({ err, email: assignee.email }, "Failed to add watcher")
          );
        }
      }
    }
  }

  log.info(
    {
      issueKey: result.key,
      issueUrl,
      issueType: requirements.issueType,
      storyPoints: requirements.storyPoints,
    },
    "Jira issue created from requirements"
  );

  await supabaseAdmin
    .from("extracted_tasks")
    .update({ jira_issue_key: result.key })
    .eq("id", task.id);

  return { issueKey: result.key, issueUrl, refinedTitle: requirements.title };
}

/**
 * Look up a Jira account ID by email address.
 */
async function lookupJiraAccountId(
  config: JiraConfig,
  email: string
): Promise<string | undefined> {
  try {
    const response = await fetch(
      `${config.baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(email)}`,
      { headers: jiraHeaders(config) }
    );

    if (!response.ok) return undefined;

    const users = (await response.json()) as Array<{ accountId: string }>;
    return users[0]?.accountId;
  } catch (err) {
    logger.warn({ err, email }, "Failed to look up Jira account");
    return undefined;
  }
}

async function addWatcher(
  config: JiraConfig,
  issueKey: string,
  accountId: string
): Promise<void> {
  await fetch(`${config.baseUrl}/rest/api/3/issue/${issueKey}/watchers`, {
    method: "POST",
    headers: jiraHeaders(config),
    body: JSON.stringify(accountId),
  });
}

/**
 * Check for potential duplicate Jira issues.
 * Returns matching issues with similarity scores.
 */
export async function checkForDuplicates(
  config: JiraConfig | null,
  title: string,
  projectKey: string,
  lookbackDays: number = 14
): Promise<Array<{ key: string; summary: string; similarity: number }>> {
  const jiraConfig = config || getJiraConfig();

  // Search recent issues in the project
  const jql = `project = ${projectKey} AND created >= -${lookbackDays}d ORDER BY created DESC`;
  const response = await fetch(
    `${jiraConfig.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary&maxResults=50`,
    { headers: jiraHeaders(jiraConfig) }
  );

  if (!response.ok) return [];

  const data = (await response.json()) as {
    issues: Array<{ key: string; fields: { summary: string } }>;
  };

  const normalizedTitle = normalizeString(title);
  const duplicates: Array<{ key: string; summary: string; similarity: number }> = [];

  for (const issue of data.issues) {
    const similarity = levenshteinSimilarity(
      normalizedTitle,
      normalizeString(issue.fields.summary)
    );
    if (similarity > 0.7) {
      duplicates.push({
        key: issue.key,
        summary: issue.fields.summary,
        similarity,
      });
    }
  }

  return duplicates.sort((a, b) => b.similarity - a.similarity);
}

/** @internal Exported for testing */
export function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @internal Exported for testing */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;

  const distance = levenshteinDistance(longer, shorter);
  return 1 - distance / longer.length;
}

/** @internal Exported for testing */
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

/** @internal Exported for testing */
export function mapPriority(priority: string): string {
  switch (priority) {
    case "P0":
      return "Highest";
    case "P1":
      return "High";
    case "P2":
      return "Medium";
    case "P3":
      return "Low";
    default:
      return "Medium";
  }
}

/**
 * Retry creating a Jira issue for a failed task.
 */
export async function retryJiraCreation(taskId: string): Promise<JiraCreateResult> {
  const { data: task, error } = await supabaseAdmin
    .from("extracted_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error || !task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  if (task.status !== "jira_failed") {
    throw new Error(`Task ${taskId} is not in jira_failed status`);
  }

  // Clear the error and retry with requirements refinement
  await supabaseAdmin
    .from("extracted_tasks")
    .update({ jira_error: null })
    .eq("id", taskId);

  return createJiraIssueWithRequirements(taskId);
}
