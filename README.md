# Unreal Engine Documentation MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives AI assistants in **any IDE** full read access to the official [Unreal Engine documentation](https://dev.epicgames.com/documentation/unreal-engine). Supports version selection from UE 4.27 through 5.7.

## What is this?

This MCP server acts as a bridge between your AI coding assistant and Epic Games' Unreal Engine documentation. Instead of the AI guessing or hallucinating UE APIs, it can directly fetch accurate, up-to-date documentation pages, search for topics, browse the C++ API reference, and more — all version-aware.

### What it does

- **Searches** the entire UE documentation by keyword
- **Reads** any documentation page and returns clean, structured markdown
- **Lists** all top-level documentation categories/sections
- **Looks up** C++ API references (classes, structs, functions, modules)
- **Supports version selection** — target any UE version from 4.27 to 5.7

### Who is this for?

- Unreal Engine developers who use AI assistants (Copilot, Claude, Cursor, etc.)
- Anyone wanting accurate UE documentation context in their AI workflows
- Teams building UE projects who want their AI tools to reference correct APIs

---

## Requirements

- **Node.js** 18 or later
- **npm** (comes with Node.js)
- An MCP-compatible client (VS Code, Claude Desktop, Cursor, Windsurf, etc.)

---

## Installation

### Option 1: Clone and Build

```bash
git clone https://github.com/Jozkah/Unreal-Engine-Documentation-MCP.git
cd Unreal-Engine-Documentation-MCP
npm install
npm run build
```

### Option 2: Download Release

Download the latest release from the [Releases](https://github.com/Jozkah/Unreal-Engine-Documentation-MCP/releases) page and extract it.

---

## Configuration

After building, you need to register this server with your MCP client. The server communicates over **stdio** (standard input/output).

### VS Code (GitHub Copilot)

Create or edit `.vscode/mcp.json` in your workspace (or configure globally in VS Code settings):

```json
{
  "servers": {
    "unreal-engine-docs": {
      "command": "node",
      "args": ["/absolute/path/to/Unreal-Engine-Documentation-MCP/dist/index.js"]
    }
  }
}
```

### Claude Desktop

Edit your Claude Desktop config file:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "unreal-engine-docs": {
      "command": "node",
      "args": ["/absolute/path/to/Unreal-Engine-Documentation-MCP/dist/index.js"]
    }
  }
}
```

### Cursor

Add to your MCP configuration in Cursor settings:

```json
{
  "unreal-engine-docs": {
    "command": "node",
    "args": ["/absolute/path/to/Unreal-Engine-Documentation-MCP/dist/index.js"]
  }
}
```

### Windsurf / Other MCP Clients

Use the stdio transport with:
- **Command:** `node`
- **Args:** `["/absolute/path/to/Unreal-Engine-Documentation-MCP/dist/index.js"]`

> **Note:** Replace `/absolute/path/to/` with the actual path where you cloned/extracted the project.

---

## Available Tools

Once configured, your AI assistant will have access to these tools:

### `search_documentation`

Search the Unreal Engine documentation for a given query.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query (e.g., "actor lifecycle", "blueprint interface") |
| `version` | string | No | `"5.7"` | Target UE version |
| `maxResults` | number | No | `10` | Maximum results to return (1–20) |

### `get_documentation_page`

Fetch and read a specific documentation page. Returns clean markdown content.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | string | Yes | — | Page slug (e.g., `blueprints-visual-scripting-in-unreal-engine`) or full URL |
| `version` | string | No | `"5.7"` | Target UE version |

### `list_documentation_categories`

List all top-level documentation sections available for a given version.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `version` | string | No | `"5.7"` | Target UE version |

### `get_api_reference`

Look up a C++ class, struct, function, or module in the API Reference.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `symbol` | string | Yes | — | C++ symbol (e.g., `AActor`, `UObject`, `FVector`, `UWorld::SpawnActor`) |
| `version` | string | No | `"5.7"` | Target UE version |

---

## Supported Versions

| Version | Status |
|---------|--------|
| **5.7** | Latest (default) |
| 5.6 | Supported |
| 5.5 | Supported |
| 5.4 | Supported |
| 5.3 | Supported |
| 5.2 | Supported |
| 5.1 | Supported |
| 5.0 | Supported |
| 4.27 | Supported (legacy) |

Pass the `version` parameter to any tool to target a specific engine version.

---

## Usage Examples

Once configured, you can ask your AI assistant things like:

> "Search the UE docs for actor lifecycle"

> "Get the documentation page for blueprints-visual-scripting-in-unreal-engine"

> "Look up AActor in the UE 5.6 C++ API reference"

> "List all documentation categories for Unreal Engine 5.4"

> "How does the Enhanced Input system work in UE 5.7?"

The AI will use the appropriate MCP tools to fetch real documentation and provide accurate answers.

---

## Development

```bash
# Run in development mode (auto-compiles TypeScript)
npm run dev

# Build for production
npm run build

# Run the built server
npm start
```

### Project Structure

```
Unreal-Engine-Documentation-MCP/
├── src/
│   ├── index.ts          # MCP server setup and tool definitions
│   └── scraper.ts        # Documentation fetching and parsing logic
├── dist/                  # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
└── README.md
```

---

## How It Works

1. The MCP server registers tools with your AI client over stdio
2. When the AI needs UE documentation, it calls the appropriate tool
3. The server fetches the page from `dev.epicgames.com/documentation`
4. HTML is parsed and converted to clean, structured markdown
5. The content is returned to the AI for it to reason over

No API keys or authentication required — it reads the public documentation.

---

## Troubleshooting

### Server not showing up in my IDE
- Ensure the path in your config is an **absolute path** to `dist/index.js`
- Verify Node.js 18+ is installed: `node --version`
- Make sure you ran `npm run build` after cloning

### Getting HTTP errors
- The server fetches live pages from Epic's documentation site
- Check your internet connection
- Some pages may be temporarily unavailable

### Content seems outdated
- The server fetches live content on each request — it does not cache
- Ensure you're specifying the correct `version` parameter

---

## License

MIT

---

## Disclaimer

This project is not affiliated with or endorsed by Epic Games. It accesses publicly available documentation from [dev.epicgames.com](https://dev.epicgames.com/documentation/unreal-engine). All Unreal Engine trademarks belong to Epic Games, Inc.
