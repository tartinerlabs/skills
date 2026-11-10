import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { createTestClient } from "./helpers.ts";

describe("MCP server", () => {
  it("should describe itself through server/discover", async () => {
    const { rpc } = createTestClient();
    const message = await rpc("server/discover");
    expect(message.result.supportedVersions).toEqual(["2026-07-28"]);
    expect(message.result._meta["io.modelcontextprotocol/serverInfo"]).toEqual({
      name: "pagespeed",
      version: pkg.version,
    });
  });

  it("should register exactly the four read-only tools", async () => {
    const { rpc } = createTestClient();
    const message = await rpc("tools/list");
    const tools: { name: string; annotations: { readOnlyHint: boolean } }[] =
      message.result.tools;
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "crux_history",
      "crux_query",
      "pagespeed_analyze",
      "ping",
    ]);
    for (const tool of tools) expect(tool.annotations.readOnlyHint).toBe(true);
  });

  it("should answer ping", async () => {
    const { callTool } = createTestClient();
    expect(await callTool("ping")).toEqual({
      isError: false,
      text: "PageSpeed Insights MCP is running.",
    });
  });
});

describe("input validation", () => {
  it.each([
    ["a non-URL", { url: "example.com" }, "http:// or https:// URL"],
    ["an ftp URL", { url: "ftp://example.com/" }, "http:// or https:// URL"],
    [
      "an unknown strategy",
      { url: "https://example.com/", strategy: "tablet" },
      "strategy",
    ],
    [
      "an unknown category",
      { url: "https://example.com/", categories: ["pwa"] },
      "categories",
    ],
    [
      "a duplicated category",
      { url: "https://example.com/", categories: ["seo", "seo"] },
      "only once",
    ],
    [
      "maxFindings above 50",
      { url: "https://example.com/", maxFindings: 51 },
      "maxFindings",
    ],
  ])(
    "should reject %s for pagespeed_analyze",
    async (_label, args, expected) => {
      const { callTool } = createTestClient();
      const result = await callTool("pagespeed_analyze", args);
      expect(result.isError).toBe(true);
      expect(result.text).toContain(expected);
    },
  );

  it.each([
    ["neither url nor origin", {}, "exactly one of url or origin"],
    [
      "both url and origin",
      { url: "https://example.com/a", origin: "https://example.com" },
      "exactly one of url or origin",
    ],
    [
      "an origin with a path",
      { origin: "https://example.com/blog" },
      "scheme and host only",
    ],
    [
      "an origin with a query",
      { origin: "https://example.com/?a=1" },
      "scheme and host only",
    ],
    [
      "an unknown form factor",
      { origin: "https://example.com", formFactor: "WATCH" },
      "formFactor",
    ],
    [
      "an unknown metric",
      { origin: "https://example.com", metrics: ["first_input_delay"] },
      "metrics",
    ],
  ])("should reject %s for crux_query", async (_label, args, expected) => {
    const { callTool } = createTestClient();
    const result = await callTool("crux_query", args);
    expect(result.isError).toBe(true);
    expect(result.text).toContain(expected);
  });

  it.each([
    ["zero weeks", 0],
    ["more than 40 weeks", 41],
  ])("should reject %s for crux_history", async (_label, weeks) => {
    const { callTool } = createTestClient();
    const result = await callTool("crux_history", {
      origin: "https://example.com",
      weeks,
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("weeks");
  });
});
