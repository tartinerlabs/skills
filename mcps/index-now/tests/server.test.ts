import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { createTestClient } from "./helpers.ts";

describe("MCP server", () => {
  it("should describe itself through server/discover", async () => {
    const { rpc } = createTestClient();
    const message = await rpc("server/discover");
    expect(message.result.supportedVersions).toEqual(["2026-07-28"]);
    expect(message.result._meta["io.modelcontextprotocol/serverInfo"]).toEqual({
      name: "index-now",
      version: pkg.version,
    });
  });

  it("should register the read-only tools and the one write tool, submit_urls", async () => {
    const { rpc } = createTestClient();
    const message = await rpc("tools/list");
    const tools: {
      name: string;
      annotations: { readOnlyHint: boolean; destructiveHint?: boolean };
    }[] = message.result.tools;
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "ping",
      "submit_urls",
      "verify_key",
    ]);
    for (const tool of tools) {
      expect(tool.annotations.readOnlyHint).toBe(tool.name !== "submit_urls");
    }
    const submit = tools.find((tool) => tool.name === "submit_urls");
    expect(submit?.annotations.destructiveHint).toBe(false);
  });

  it("should answer ping", async () => {
    const { callTool } = createTestClient();
    expect(await callTool("ping")).toEqual({
      isError: false,
      text: "IndexNow MCP is running.",
    });
  });
});

const KEY = "test-key-not-secret";

describe("input validation", () => {
  it.each([
    ["a non-URL", { urls: ["example.com/a"], key: KEY }, "public host name"],
    [
      "localhost",
      { urls: ["http://localhost:3000/a"], key: KEY },
      "public host name",
    ],
    [
      "an IP address",
      { urls: ["https://203.0.113.5/a"], key: KEY },
      "public host name",
    ],
    ["no urls", { urls: [], key: KEY }, "urls"],
    [
      "a short key",
      { urls: ["https://example.com/a"], key: "abc" },
      "8 to 128",
    ],
    [
      "a key with dots",
      { urls: ["https://example.com/a"], key: "test-key.txt" },
      "8 to 128",
    ],
    [
      "urls on two hosts",
      {
        urls: ["https://example.com/a", "https://blog.example.com/b"],
        key: KEY,
      },
      "one host",
    ],
    [
      "a keyLocation on another host",
      {
        urls: ["https://example.com/a"],
        key: KEY,
        keyLocation: `https://cdn.example.com/${KEY}.txt`,
      },
      "keyLocation",
    ],
    [
      "a keyLocation below the urls",
      {
        urls: ["https://example.com/a"],
        key: KEY,
        keyLocation: `https://example.com/blog/${KEY}.txt`,
      },
      "keyLocation",
    ],
  ])("should reject %s for submit_urls", async (_label, args, expected) => {
    const { callTool } = createTestClient();
    const result = await callTool("submit_urls", args);
    expect(result.isError).toBe(true);
    expect(result.text).toContain(expected);
  });
});
