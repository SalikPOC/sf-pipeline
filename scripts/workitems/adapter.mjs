/**
 * Work-item tracker adapter interface (REQUIREMENTS.md E2.6).
 *
 * PoC scope: only StubAdapter is implemented — no network calls. Real Jira and
 * Azure DevOps adapters are post-PoC; they implement the same four methods
 * (see docs/WORKITEMS.md "Connecting Jira/ADO later").
 *
 * interface WorkItemAdapter {
 *   extractIdsFromText(text: string): string[]
 *   validateId(id: string): Promise<{exists: boolean, url?: string}>
 *   getWorkItem(id: string): Promise<{id, title, status, assignee, url, type}>
 *   postDeploymentStatus(id: string, d: DeploymentInfo): Promise<void>
 * }
 * DeploymentInfo: {env, seq, status: "deployed"|"failed"|"rolled-back", runUrl, actor, timestamp}
 */
import { extractIdsFromText, classify } from "./extract.mjs";

export class StubAdapter {
  constructor(log = console.log) {
    this.log = log;
    /** Recorded postbacks — surfaced into orbitops-summary.json by callers. */
    this.recorded = [];
  }

  extractIdsFromText(text) {
    return extractIdsFromText(text);
  }

  // Any well-formed ID "exists" — format validation happened at extraction.
  async validateId(id) {
    return { exists: true, url: null };
  }

  async getWorkItem(id) {
    return {
      id,
      title: "(tracker not connected)",
      status: null,
      assignee: null,
      url: null,
      type: classify(id),
    };
  }

  async postDeploymentStatus(id, d) {
    const entry = { id, tracker: classify(id), ...d };
    this.recorded.push(entry);
    this.log(`[workitems] ${id}: ${d.status} in ${d.env} (seq ${d.seq}) — ${d.runUrl}`);
  }
}

/** Router: returns the adapter for an ID. PoC: always the stub. */
export function adapterFor(_id, stub = defaultStub) {
  return stub;
}

const defaultStub = new StubAdapter();
export default defaultStub;
