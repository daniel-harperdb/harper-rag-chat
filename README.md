# Harper RAG Chat

[![Run on Replit](https://replit.com/badge/github/daniel-harperdb/harper-rag-chat)](https://replit.com/new/github/daniel-harperdb/harper-rag-chat)

AI Chat with Knowledge Base — powered entirely by Harper.

Upload documents, ask questions, get answers grounded in your knowledge base. Everything runs on a single Harper instance: database, vector search (HNSW), REST API, WebSocket streaming, and the web UI.

## What This Demonstrates

- **GraphQL schemas** defining tables with `@table`, `@indexed`, and vector indexing (`@indexed(type: "HNSW")`)
- **Automatic REST APIs** for Conversation and Message tables via `@export`
- **Custom Resources** for RAG chat, knowledge ingestion, and semantic search
- **Vector search** using Harper's built-in HNSW index — no external vector DB needed
- **Static web serving** — Harper serves the frontend directly
- **Real-time subscriptions** via WebSocket (ChatStream resource)

## Architecture

```
schemas/
  Conversation.graphql   — @table @export (auto CRUD endpoints)
  Message.graphql        — @table @export (auto CRUD endpoints)
  KnowledgeChunk.graphql — @table with HNSW vector index (extended by resources)

resources/
  Chat.ts                — POST /Chat/ — RAG pipeline: embed query → vector search → LLM
  KnowledgeIngest.ts     — POST /KnowledgeIngest/ — chunk text, embed, store
  KnowledgeSearch.ts     — POST /KnowledgeSearch/ — semantic search endpoint
  KnowledgeChunk.ts      — extends table: auto-embeds on insert
  ChatStream.ts          — WebSocket/SSE subscription for live message updates

web/
  index.html             — chat UI served by Harper's static component
  app.js                 — frontend logic
  styles.css             — dark theme
```

---

## Run on Replit

The fastest way to get started — no local setup required.

1. Click the **Run on Replit** button above (or [open directly](https://replit.com/new/github/daniel-harperdb/harper-rag-chat))
2. In the Replit sidebar, go to **Secrets** and add:
   - `OPENAI_API_KEY` — your OpenAI API key ([get one here](https://platform.openai.com/api-keys))
3. Click **Run** — Harper installs and starts automatically
4. Open the webview at the URL Replit provides (port 9926 → port 80)

That's it. No database to configure, no separate vector DB, no Redis. Harper handles everything.

---

## Run Locally

### 1. Install Harper

```bash
npm install -g harperdb
```

> Requires Node.js 20+. Check with `node --version`.

### 2. Clone and install dependencies

```bash
git clone https://github.com/daniel-harperdb/harper-rag-chat.git
cd harper-rag-chat
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:9926](http://localhost:9926) to use the app.

---

## Deploy to Harper Fabric

Harper Fabric is the managed cloud — deploy with one command (free tier, no credit card required).

1. Sign up at [https://fabric.harper.fast/](https://fabric.harper.fast/) and create a cluster
2. Set your cluster credentials in `.env`:
   ```
   CLI_TARGET_USERNAME=your-username
   CLI_TARGET_PASSWORD=your-password
   CLI_TARGET=https://your-cluster.harperfabric.com
   ```
3. Deploy:
   ```bash
   npm run deploy
   ```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Conversation/` | List all conversations |
| POST | `/Conversation/` | Create a conversation |
| GET | `/Message/?conversationId=xxx` | Get messages for a conversation |
| POST | `/Chat/` | Send a message (triggers RAG pipeline) |
| POST | `/KnowledgeIngest/` | Ingest a document (chunks + embeds) |
| POST | `/KnowledgeSearch/` | Semantic search across knowledge base |
| WS | `/ChatStream/{conversationId}` | Real-time message subscription |

## How RAG Works

1. **Ingest**: User uploads text → chunked into ~500 char segments → OpenAI generates embeddings → stored in Harper with HNSW vector index
2. **Query**: User asks a question → embedded → Harper vector search finds top 3 matching chunks → chunks + conversation history sent to GPT-4o-mini → response stored in Harper
3. **Persist**: Every message (user and assistant) is stored in the Message table with full conversation threading

## Tech Stack

- **Harper** — database, vector search, REST API, WebSocket, static serving ([harper.fast](https://harper.fast))
- **OpenAI** — text-embedding-3-small (embeddings) + gpt-4o-mini (chat)
- **Vanilla JS** — zero-framework frontend, served by Harper's static component

## License

MIT
