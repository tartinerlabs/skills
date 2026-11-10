import { createMcpHandler } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../src/server.ts";
import { createTestClient, mcpRequest, mockClient } from "./helpers.ts";

const KEY = "test-key-not-secret";
const keyFile = (status = 200, text = KEY) =>
  vi.fn().mockResolvedValue({ status, text });

describe("submit_urls", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Calls submit_urls with fake timers, running out the retries. */
  async function submit(
    client: Parameters<typeof mockClient>[0],
    args: Record<string, unknown> = {},
  ) {
    vi.useFakeTimers();
    const { callTool } = createTestClient(
      mockClient({ fetchKeyFile: keyFile(), ...client }),
    );
    const pending = callTool("submit_urls", {
      urls: ["https://example.com/a"],
      key: KEY,
      ...args,
    });
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    return pending;
  }

  it("should submit the deduplicated urls and return the outcome", async () => {
    const submitUrls = vi.fn().mockResolvedValue(200);

    const result = await submit(
      { submit: submitUrls },
      {
        urls: [
          "https://example.com/a",
          "https://example.com/b",
          "https://example.com/a",
        ],
      },
    );

    expect(result.isError).toBe(false);
    expect(submitUrls).toHaveBeenCalledWith({
      host: "example.com",
      key: KEY,
      urlList: ["https://example.com/a", "https://example.com/b"],
    });
    expect(JSON.parse(result.text)).toEqual({
      host: "example.com",
      submitted: 2,
      status: 200,
      note: "Accepted.",
    });
  });

  it("should pass keyLocation through when the key file is not at the root", async () => {
    const keyLocation = `https://example.com/blog/${KEY}.txt`;
    const submitUrls = vi.fn().mockResolvedValue(202);

    const result = await submit(
      { submit: submitUrls },
      { urls: ["https://example.com/blog/post"], keyLocation },
    );

    expect(submitUrls).toHaveBeenCalledWith(
      expect.objectContaining({ keyLocation }),
    );
    expect(JSON.parse(result.text).note).toContain("will validate the key");
  });

  it("should report a failed submission's classified error", async () => {
    const result = await submit({
      fetchKeyFile: keyFile(404, ""),
      submit: vi.fn(),
    });

    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/^\[not_found\] .*was not found/);
  });

  it("should stream progress while the submission retries", async () => {
    vi.useFakeTimers();
    const handler = createMcpHandler(
      () =>
        createServer(
          mockClient({
            fetchKeyFile: vi
              .fn()
              .mockResolvedValueOnce({ status: 404, text: "" })
              .mockResolvedValue({ status: 200, text: KEY }),
            submit: vi.fn().mockResolvedValue(200),
          }),
        ),
      { legacy: "reject" },
    );
    const response = handler.fetch(
      mcpRequest("tools/call", {
        name: "submit_urls",
        arguments: { urls: ["https://example.com/a"], key: KEY },
        _meta: { progressToken: "submit-1" },
      }),
    );
    await vi.advanceTimersByTimeAsync(20_000);
    const body = (await response).text();
    await vi.advanceTimersByTimeAsync(20_000);

    const text = await body;
    expect(text).toContain('"method":"notifications/progress"');
    expect(text).toContain("Retrying in 15s: [not_found]");
    expect(text).toContain('\\"submitted\\": 1');
  });
});

describe("verify_key", () => {
  it("should report a live key file as valid", async () => {
    const { callTool } = createTestClient(
      mockClient({ fetchKeyFile: keyFile() }),
    );

    const result = await callTool("verify_key", {
      url: "https://example.com/some/page",
      key: KEY,
    });

    expect(JSON.parse(result.text)).toEqual({
      valid: true,
      keyLocation: `https://example.com/${KEY}.txt`,
    });
  });

  it("should explain why a key file fails, without erroring", async () => {
    const { callTool } = createTestClient(
      mockClient({ fetchKeyFile: keyFile(404, "") }),
    );

    const result = await callTool("verify_key", {
      url: "https://example.com",
      key: KEY,
    });

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text)).toMatchObject({ valid: false });
  });
});
