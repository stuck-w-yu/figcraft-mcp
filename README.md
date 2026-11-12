# FigCraft MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-green.svg)](https://modelcontextprotocol.io)

Model Context Protocol (MCP) server for [FigCraft](https://getartcraft.com/apps/figcraft) — an open-source interface design and prototyping tool (Figma alternative).

Enables AI agents (OpenCode, Claude, Cursor, Antigravity, Zed, Cline) to inspect, design, prototype, and export vectors and layouts in FigCraft.

---

## Features

- **Dual-Mode Operation**:
  - **Attached Mode**: Connects to an active FigCraft desktop session on `127.0.0.1:7979`.
  - **Headless Mode**: Runs headless via the built-in FigCraft engine when the desktop app is closed.
- **Smart Auto-Detection**: Automatically detects if the FigCraft desktop app is listening on the control port and selects the appropriate mode.
- **Full MCP Protocol Support**:
  - **19 Tools**: Layer creation, autolayout, property inspection, command catalog, export, screenshots, and undo/redo.
  - **Resources**: `figcraft://document`, `figcraft://node/{id}`, `figcraft://command/{id}`, `figcraft://comments`.
  - **Prompts**: `mobile_screen`, `design_system`, `landing_page`, `prototype_flow`, etc.
- **Confined Workspace Access**: Defaults to confining file access to `~/dev/design` for safety.

---

## Quick Start

### Run with npx (No install needed)

```bash
npx figcraft-mcp
```

### Or Install Globally

```bash
npm install -g figcraft-mcp
# or
pnpm add -g figcraft-mcp
```

---

## Prerequisites

- [FigCraft](https://github.com/storytold/figcraft) installed on your system (`figcraft` and `figcraft-cli`).
  - Arch Linux: `yay -S figcraft-bin`

---

## Client Configuration

### 1. OpenCode (`~/.config/opencode/opencode.json`)

```json
{
  "mcp": {
    "servers": {
      "figcraft": {
        "type": "local",
        "command": ["npx", "-y", "figcraft-mcp"]
      }
    }
  }
}
```

Or point to a local clone:

```json
{
  "mcp": {
    "servers": {
      "figcraft": {
        "type": "local",
        "command": ["node", "/home/stuckwyu/dev/code/figcraft-mcp/dist/index.js"]
      }
    }
  }
}
```

### 2. Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "figcraft": {
      "command": "npx",
      "args": ["-y", "figcraft-mcp"]
    }
  }
}
```

### 3. Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "figcraft": {
      "command": "npx",
      "args": ["-y", "figcraft-mcp"]
    }
  }
}
```

### 4. Antigravity / Gemini CLI (`~/.gemini/config/mcp_config.json`)

```json
{
  "mcpServers": {
    "figcraft": {
      "command": "node",
      "args": ["/home/stuckwyu/dev/code/figcraft-mcp/dist/index.js"],
      "timeout": 300
    }
  }
}
```

---

## Available Tools

| Tool | Description |
|---|---|
| `create_node` | Create layers (frames, rectangles, text, vector paths, components) |
| `set_properties` | Edit layout, fills, strokes, fonts, autolayout, constraints |
| `inspect_document` | Read the full layer tree and page structure |
| `get_node` | Inspect properties and bounds of a specific layer |
| `select` | Select layers on canvas |
| `list_commands` | Search 400+ FigCraft menu and UI commands |
| `run_command` | Execute an action or command by ID |
| `batch` | Run multiple commands atomically in one undo step |
| `undo` / `redo` | Step backward or forward through document history |
| `screenshot` | Render high-resolution PNG snapshots of frames or pages |
| `export` | Export layers to PNG, SVG, JPG, WebP, PDF, or .fig |
| `open_file` | Open or import `.figcraft`, `.fig`, `.sketch`, SVG, etc. |
| `save_file` | Save the active design file |
| `inspect_ui` | Check UI view state and panels |
| `pointer` / `key` / `type_text` | Simulate canvas inputs when semantic commands are unsuitable |
| `wait_for_changes` | Subscribe to cursor and comment updates |

---

## CLI Options & Environment Variables

```
Usage:
  figcraft-mcp [options]

Options:
  -p, --port <number>       FigCraft desktop app control port (default: 7979 or FIGCRAFT_PORT)
      --headless            Force headless mode (in-process engine session; no window)
      --attach              Force attach mode (fail if FigCraft app is not running)
      --root <path>         Confine automation read/write path (default: ~/dev/design)
      --timeout <seconds>   RPC timeout in seconds (default: 300)
      --cli <path>          Path to figcraft-cli binary
  -v, --verbose             Print debug logs to stderr
  -h, --help                Show help message
  -V, --version             Show version
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `FIGCRAFT_PORT` | Port to attach to | `7979` |
| `FIGCRAFT_ROOT` | Allowed root path for file read/write | `~/dev/design` |
| `FIGCRAFT_CLI` | Explicit path to `figcraft-cli` binary | Auto-detected |
| `FIGCRAFT_TIMEOUT` | RPC timeout in seconds | `300` |

---

## Development

```bash
# Clone
git clone https://github.com/stuck-w-yu/figcraft-mcp.git
cd figcraft-mcp

# Install
pnpm install

# Build
pnpm build

# Run locally
node dist/index.js
```

---

## License

MIT © [Wahyu Firmansyah](https://github.com/stuck-w-yu)
