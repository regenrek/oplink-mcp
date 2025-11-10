import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalToolCache } from "../src/external/cache";

const { listToolsMock } = vi.hoisted(() => ({ listToolsMock: vi.fn() }));

vi.mock("../src/external-tools", async () => {
  const actual = await vi.importActual<any>("../src/external-tools");
  return {
    ...actual,
    listExternalServerTools: listToolsMock,
  };
});

describe("tool suggestions (uFuzzy)", () => {
  beforeEach(() => {
    listToolsMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("suggests close matches when tool is unknown", async () => {
    listToolsMock.mockResolvedValue([
      { name: "jira_search", description: "Search issues" },
      { name: "jira_get_issue", description: "Get issue" },
      { name: "jira_update_issue", description: "Update issue" },
      { name: "confluence_search", description: "Search pages" },
    ]);

    const cache = new ExternalToolCache("/tmp/config");
    await cache.ensureAliases(["atlassian"], { forceRefresh: true });

    await expect(
      cache.getTool("atlassian", "jira_search_issues")
    ).rejects.toThrow(/Did you mean: jira_search/);
  });
});
