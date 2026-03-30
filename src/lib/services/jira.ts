/**
 * Backward-compatibility facade.
 * All logic has moved to @/lib/issue-tracker/jira.
 * New code should import from @/lib/issue-tracker directly.
 */
import { getIssueTracker } from "@/lib/issue-tracker";
import { supabaseAdmin } from "@/lib/supabase";
import type { ExtractedTaskRow } from "@/lib/types";
import type { IssueCreateResult } from "@/lib/issue-tracker";

export type { IssueCreateResult as JiraCreateResult };

export {
  buildRequirementsAdf,
  buildLegacyAdf,
  mapPriority,
  normalizeString,
  levenshteinSimilarity,
  levenshteinDistance,
} from "@/lib/issue-tracker/jira/jira-helpers";

export { JiraProvider } from "@/lib/issue-tracker/jira/jira-provider";

export function getJiraConfig() {
  const { JiraProvider } = require("@/lib/issue-tracker/jira/jira-provider") as typeof import("@/lib/issue-tracker/jira/jira-provider");
  return new JiraProvider().getConfig();
}

export async function createJiraIssue(
  task: ExtractedTaskRow,
  projectKey?: string
): Promise<IssueCreateResult> {
  return getIssueTracker().createIssue(task, projectKey);
}

export async function createJiraIssueWithRequirements(
  taskOrId: string | ExtractedTaskRow,
  projectKey?: string
): Promise<IssueCreateResult & { refinedTitle: string }> {
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
  return getIssueTracker().createIssue(task, projectKey);
}

export async function checkForDuplicates(
  _config: unknown,
  title: string,
  projectKey: string,
  lookbackDays?: number
) {
  return getIssueTracker().checkForDuplicates(title, projectKey, lookbackDays);
}

export async function retryJiraCreation(taskId: string): Promise<IssueCreateResult> {
  return getIssueTracker().retryFailedIssue(taskId);
}
