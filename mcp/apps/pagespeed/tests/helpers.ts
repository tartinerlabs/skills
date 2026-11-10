import { createMcpHandler } from "@modelcontextprotocol/server";
import type {
  PageSpeedClient,
  PageSpeedClientProvider,
} from "../src/google/client.ts";
import { createServer } from "../src/server.ts";

const PROTOCOL_VERSION = "2026-07-28";

export function mockClient(
  overrides: Partial<PageSpeedClient> = {},
): PageSpeedClientProvider {
  const notMocked = () => Promise.reject(new Error("not mocked"));
  const client: PageSpeedClient = {
    runPagespeed: notMocked,
    queryRecord: notMocked,
    queryHistoryRecord: notMocked,
    ...overrides,
  };
  return () => client;
}

/** A 2026-07-28 (modern, stateless) MCP request: per-request `_meta` envelope plus the standard headers. */
function mcpRequest(
  method: string,
  params: Record<string, unknown> = {},
): Request {
  const name = typeof params.name === "string" ? params.name : undefined;
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL_VERSION,
      "mcp-method": method,
      ...(name && { "mcp-name": name }),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

/** Parse a JSON-RPC message from a JSON or single-event SSE response body. */
async function readMessage(response: Response) {
  const text = await response.text();
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);
  return JSON.parse(data ?? text);
}

/** Call the shared server factory over the SDK's stateless handler (no auth, no network). */
export function createTestClient(
  getClient: PageSpeedClientProvider = mockClient(),
) {
  const handler = createMcpHandler(() => createServer(getClient), {
    legacy: "reject",
  });
  const rpc = async (method: string, params: Record<string, unknown> = {}) =>
    readMessage(await handler.fetch(mcpRequest(method, params)));
  const callTool = async (name: string, args: Record<string, unknown> = {}) => {
    const message = await rpc("tools/call", { name, arguments: args });
    const text: string = message.result.content[0].text;
    return { isError: message.result.isError === true, text };
  };
  return { rpc, callTool };
}
