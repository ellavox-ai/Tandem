import type { ExtractedTaskRow } from "@/lib/types";

export interface IssueCreateResult {
  issueKey: string;
  issueUrl: string;
}

export interface IssueTrackerProvider {
  readonly name: string;

  createIssue(
    task: ExtractedTaskRow,
    project?: string
  ): Promise<IssueCreateResult & { refinedTitle: string }>;

  checkForDuplicates(
    title: string,
    project: string,
    lookbackDays?: number
  ): Promise<Array<{ key: string; summary: string; similarity: number }>>;

  retryFailedIssue(taskId: string): Promise<IssueCreateResult>;
}
