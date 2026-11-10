import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { createTestClient } from "./helpers.ts";

describe("MCP server", () => {
  it("should describe itself through server/discover", async () => {
    const { rpc } = createTestClient();
    const message = await rpc("server/discover");
    expect(message.result.supportedVersions).toEqual(["2026-07-28"]);
    expect(message.result._meta["io.modelcontextprotocol/serverInfo"]).toEqual({
      name: "app-store-connect",
      version: pkg.version,
    });
  });

  it("should register exactly the five read-only tools", async () => {
    const { rpc } = createTestClient();
    const message = await rpc("tools/list");
    const tools: { name: string; annotations: { readOnlyHint: boolean } }[] =
      message.result.tools;
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "app_versions",
      "customer_reviews",
      "list_apps",
      "list_builds",
      "ping",
    ]);
    for (const tool of tools) expect(tool.annotations.readOnlyHint).toBe(true);
  });

  it("should answer ping", async () => {
    const { callTool } = createTestClient();
    expect(await callTool("ping")).toEqual({
      isError: false,
      text: "App Store Connect MCP is running.",
    });
  });
});

describe("input validation", () => {
  it.each([
    ["list_apps", { limit: 201 }, "limit"],
    ["list_apps", { sort: "createdDate" }, "sort"],
    ["list_apps", { key_id: "abc" }, "key ID"],
    ["app_versions", {}, "app_id"],
    ["app_versions", { app_id: "../v1/users" }, "numeric"],
    [
      "app_versions",
      { app_id: "1", app_version_state: ["LIVE"] },
      "app_version_state",
    ],
    [
      "list_builds",
      { app_id: "1", processing_state: ["DONE"] },
      "processing_state",
    ],
    ["customer_reviews", { app_id: "1", rating: [6] }, "rating"],
    ["customer_reviews", { app_id: "1", territory: "US" }, "alpha-3"],
  ])("should reject bad input for %s (%j)", async (tool, args, expected) => {
    const { callTool } = createTestClient();
    const result = await callTool(tool, args);
    expect(result.isError).toBe(true);
    expect(result.text).toContain(expected);
  });
});
