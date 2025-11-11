# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next AI Draw.io is a Next.js web application that integrates AI capabilities with draw.io diagrams. Users can create, modify, and enhance diagrams through natural language commands and AI-assisted visualization. The app supports multiple AI providers (OpenAI, Google, AWS Bedrock, OpenRouter) and features real-time diagram editing with version history.

## Development Commands

```bash
# Development server (runs on port 6002 with Turbopack)
npm run dev

# Production build
npm run build

# Start production server (runs on port 6001)
npm start

# Lint the codebase
npm run lint
```

## Environment Setup

Copy `env.example` to `.env.local` and configure at least one AI provider:

- `GOOGLE_GENERATIVE_AI_API_KEY` - For Google Gemini models
- `OPENAI_API_KEY` - For OpenAI models
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` - For AWS Bedrock
- `OPENROUTER_API_KEY` - For OpenRouter models

Not all variables are required - only the provider(s) you intend to use.

## Architecture

### Core Data Flow

1. **User Input** → `ChatPanel` component receives text/image input
2. **XML Fetching** → Before sending to AI, current diagram XML is exported via `onFetchChart()`
3. **AI Processing** → Request sent to `/api/chat/route.ts` with message history and current XML
4. **Tool Execution** → AI responds with either:
   - `display_diagram` - Generate new diagram from scratch
   - `edit_diagram` - Make targeted edits to existing diagram
5. **Diagram Update** → XML is loaded into draw.io embed via `DiagramContext`

### Key Components

**DiagramContext** (`contexts/diagram-context.tsx`)
- Central state management for diagram XML, SVG, and history
- Provides `drawioRef` for controlling the embedded draw.io editor
- Manages diagram export/import operations
- Tracks version history for undo functionality

**ChatPanel** (`components/chat-panel.tsx`)
- Main UI orchestrator combining chat interface with diagram controls
- Handles tool call execution (`display_diagram`, `edit_diagram`)
- Manages file attachments (images) for diagram replication
- Coordinates between AI responses and diagram updates

**API Route** (`app/api/chat/route.ts`)
- Streams AI responses using Vercel AI SDK
- Supports multiple AI providers (configurable via model selection)
- Implements two tools:
  - `display_diagram`: Full diagram generation
  - `edit_diagram`: Targeted XML modifications using search/replace
- Formats current XML and user input into structured prompts

### XML Processing Utilities (`lib/utils.ts`)

**Critical Functions:**

- `formatXML(xml)` - Normalizes XML formatting with consistent indentation. Always called before sending XML to AI to ensure consistency.

- `replaceNodes(currentXML, nodes)` - Replaces the entire `<root>` section of a draw.io diagram. Used by `display_diagram` tool.

- `replaceXMLParts(xmlContent, searchReplacePairs)` - Performs targeted search/replace operations on XML. Used by `edit_diagram` tool. Implements three-tier matching:
  1. Exact line match
  2. Trimmed line match (fallback)
  3. Substring match (for single-line XML)

- `extractDiagramXML(xml_svg_string)` - Extracts and decompresses XML from draw.io's base64-encoded SVG format.

- `convertToLegalXml(xmlString)` - Converts incomplete/streaming XML into valid XML by filtering complete `<mxCell>` elements.

### AI Tool Strategy

The system uses two complementary tools:

**display_diagram** - Use when:
- Creating diagrams from scratch
- Major structural changes needed
- Current XML is empty or invalid

**edit_diagram** - Use when:
- Making small targeted changes (add/remove elements, change labels)
- Adjusting properties or positioning
- More efficient than full regeneration
- Falls back to `display_diagram` if search pattern not found

### Diagram Layout Constraints

The AI is instructed to keep all diagram elements within viewport bounds:
- X coordinates: 0-800
- Y coordinates: 0-600
- Max container width: 700px
- Max container height: 550px
- Start positioning from margins (e.g., x=40, y=40)

This prevents page breaks and ensures diagrams fit in a single view.

### State Management Pattern

The app uses React Context (`DiagramContext`) rather than external state management. Key refs:
- `drawioRef` - Controls the embedded draw.io iframe
- `resolverRef` - Promise resolver for async XML export operations

The `onFetchChart()` function uses a race condition pattern with 10-second timeout to handle diagram export.

### Message Format

Messages sent to AI include:
- Formatted current diagram XML
- User text input
- Optional image attachments (for diagram replication)
- Full conversation history (converted to model messages)

### Tool Input Streaming

The API route enables fine-grained tool streaming via:
```javascript
providerOptions: {
  anthropic: {
    additionalModelRequestFields: {
      anthropic_beta: ['fine-grained-tool-streaming-2025-05-14']
    }
  }
}
```

This allows progressive rendering of diagram updates as the AI generates XML.

## Path Aliases

The project uses `@/*` to reference the root directory (configured in `tsconfig.json`).

## Technology Stack

- **Next.js 15** - App Router architecture
- **React 19** - UI framework
- **Vercel AI SDK** (`ai`, `@ai-sdk/react`) - Chat interface and streaming
- **react-drawio** - Embedded draw.io editor component
- **@xmldom/xmldom** - XML parsing and manipulation
- **pako** - Compression/decompression for draw.io format
- **Tailwind CSS** - Styling with custom components in `components/ui/`

## Important Notes

- Always call `formatXML()` on diagram XML before sending to AI to ensure consistent formatting
- The `edit_diagram` tool requires exact line matches - formatting matters
- When `edit_diagram` fails, the AI should fall back to `display_diagram` rather than retry with different patterns
- Diagram history is stored in-memory and cleared on chat reset
- The app supports AWS 2025 icons for architecture diagrams
