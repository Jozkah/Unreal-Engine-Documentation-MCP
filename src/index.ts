#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchDocPage, searchDocs, listCategories, fetchApiReference } from "./scraper.js";

const SUPPORTED_VERSIONS = ["5.7", "5.6", "5.5", "5.4", "5.3", "5.2", "5.1", "5.0", "4.27"];
const DEFAULT_VERSION = "5.7";

const server = new McpServer({
  name: "unreal-engine-docs",
  version: "1.0.0",
});

// Tool: Search documentation
server.tool(
  "search_documentation",
  "Search the Unreal Engine documentation for a given query. Returns a list of matching pages with titles, descriptions, and URLs.",
  {
    query: z.string().describe("The search query (e.g. 'blueprint interface', 'actor lifecycle', 'UObject')"),
    version: z.enum(SUPPORTED_VERSIONS as [string, ...string[]]).default(DEFAULT_VERSION).describe("Unreal Engine version to search docs for"),
    maxResults: z.number().min(1).max(20).default(10).describe("Maximum number of results to return"),
  },
  async ({ query, version, maxResults }) => {
    try {
      const results = await searchDocs(query, version, maxResults);
      if (results.length === 0) {
        return { content: [{ type: "text", text: `No results found for "${query}" in UE ${version} documentation.` }] };
      }
      const formatted = results.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.description}\n   URL: ${r.url}`).join("\n\n");
      return { content: [{ type: "text", text: `Found ${results.length} results for "${query}" (UE ${version}):\n\n${formatted}` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error searching documentation: ${error.message}` }], isError: true };
    }
  }
);

// Tool: Get documentation page
server.tool(
  "get_documentation_page",
  "Fetch and read a specific Unreal Engine documentation page. Provide either a full URL or a page slug (e.g. 'blueprints-visual-scripting-in-unreal-engine').",
  {
    page: z.string().describe("Page slug (e.g. 'blueprints-visual-scripting-in-unreal-engine') or full URL"),
    version: z.enum(SUPPORTED_VERSIONS as [string, ...string[]]).default(DEFAULT_VERSION).describe("Unreal Engine version"),
  },
  async ({ page, version }) => {
    try {
      const content = await fetchDocPage(page, version);
      return { content: [{ type: "text", text: content }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error fetching page: ${error.message}` }], isError: true };
    }
  }
);

// Tool: List documentation categories
server.tool(
  "list_documentation_categories",
  "List all top-level documentation categories/sections available in the Unreal Engine documentation for a given version.",
  {
    version: z.enum(SUPPORTED_VERSIONS as [string, ...string[]]).default(DEFAULT_VERSION).describe("Unreal Engine version"),
  },
  async ({ version }) => {
    try {
      const categories = await listCategories(version);
      const formatted = categories.map((c, i) => `${i + 1}. **${c.title}**\n   ${c.description}\n   Slug: ${c.slug}`).join("\n\n");
      return { content: [{ type: "text", text: `UE ${version} Documentation Categories:\n\n${formatted}` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error listing categories: ${error.message}` }], isError: true };
    }
  }
);

// Tool: Get C++ API reference
server.tool(
  "get_api_reference",
  "Look up a specific class, struct, function, or module in the Unreal Engine C++ API Reference.",
  {
    symbol: z.string().describe("The C++ symbol to look up (e.g. 'AActor', 'UObject', 'FVector', 'UWorld::SpawnActor')"),
    version: z.enum(SUPPORTED_VERSIONS as [string, ...string[]]).default(DEFAULT_VERSION).describe("Unreal Engine version"),
  },
  async ({ symbol, version }) => {
    try {
      const content = await fetchApiReference(symbol, version);
      return { content: [{ type: "text", text: content }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error fetching API reference: ${error.message}` }], isError: true };
    }
  }
);

// Resource: Available versions
server.resource(
  "versions",
  "ue-docs://versions",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({
        supported_versions: SUPPORTED_VERSIONS,
        default_version: DEFAULT_VERSION,
        note: "Pass the 'version' parameter to any tool to target a specific UE version."
      }, null, 2)
    }]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Unreal Engine Documentation MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
