// Minimal stateless MCP server over Streamable HTTP for dogfooding mcp-gate.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "node:http";
import { z } from "zod";

// A fresh McpServer per request: one shared instance cannot serve multiple
// per-request transports ("Already connected to a transport").
function createMcpServer() {
  const server = new McpServer({ name: "mcp-gate-demo", version: "1.0.0" });

  server.registerTool(
    "echo",
    { title: "Echo", description: "Echoes text back", inputSchema: { text: z.string() } },
    async ({ text }) => ({ content: [{ type: "text", text: `echo: ${text}` }] }),
  );

  server.registerResource(
    "demo",
    "demo://info",
    { description: "Demo resource" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/plain", text: "demo resource body" }],
    }),
  );

  server.registerPrompt(
    "greet",
    { title: "Greet", argsSchema: { name: z.string() } },
    async ({ name }) => ({
      messages: [{ role: "user", content: { type: "text", text: `Hello, ${name}!` } }],
    }),
  );

  return server;
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/health") {
      res.writeHead(200).end("ok");
      return;
    }
    if (url.pathname !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonValidation: false,
      });
      res.on("close", () => transport.close());
      await createMcpServer().connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("handler error", err);
      if (!res.headersSent) res.writeHead(500).end();
    }
  })
  .listen(3123, () => console.log("demo MCP server on http://localhost:3123/mcp"));
