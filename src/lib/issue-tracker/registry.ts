import type { IssueTrackerProvider } from "./types";
import { JiraProvider } from "./jira/jira-provider";

let _instance: IssueTrackerProvider | null = null;

export function getIssueTracker(): IssueTrackerProvider {
  if (_instance) return _instance;

  const provider = (process.env.ISSUE_TRACKER || "jira").toLowerCase();

  switch (provider) {
    case "jira":
      _instance = new JiraProvider();
      return _instance;
    default:
      throw new Error(
        `Unknown issue tracker provider: "${provider}". Supported: jira`
      );
  }
}

/** Reset the cached instance (for testing). */
export function resetIssueTracker(): void {
  _instance = null;
}
