# AI Bug Detector

AI Bug Detector is a GitHub App that integrates directly into Pull Request workflows to perform automated, AI-powered code reviews. It detects deep logical flaws — including memory leaks, race conditions, null dereferences, and injection vulnerabilities — and posts inline review comments on the exact lines of code where issues are found.

---

## 🚀 Features

- **Automated Code Review**: Analyzes code changes in Pull Requests automatically via GitHub Webhooks.
- **Deep Structural Analysis**: Uses Abstract Syntax Trees (AST) via `tree-sitter` and `@typescript-eslint/typescript-estree` to thoroughly understand code structure (supports C, C++, Python, JavaScript, and TypeScript).
- **Fast, AI-Powered Insights**: Powered by **Groq** (using Llama 3.3 70B as primary) with high speed and low latency, and fallback support for any OpenAI-compatible API (e.g., GPT-4o-mini).
- **Inline Feedback**: Posts actionable review comments directly on the affected lines in the GitHub Pull Request.
- **Robust Queueing**: Uses **BullMQ** and **Redis** for reliable asynchronous job processing and retry mechanisms.

---

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router)
- **Runtime**: Node.js 20+
- **GitHub API**: Octokit (`@octokit/rest`, `@octokit/webhooks`, `@octokit/auth-app`)
- **Queue**: BullMQ & Redis
- **AI Providers**: Groq SDK (OpenAI-compatible client), OpenAI SDK
- **Validation**: Zod (for strict LLM JSON-schema output validation)

---

## ⚙️ Setup & Local Development

### 1. Prerequisites

- Node.js (v20+)
- Redis Server (running locally on port 6379, or via Docker)
- A registered GitHub App with the following permissions:
  - **Pull requests**: Read & Write
  - **Metadata**: Read-only
  - **Webhooks**: Active (subscribed to *Pull Request* events)

### 2. Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/VanshSharmaPES/AI-Bug-Detector.git
cd AI-Bug-Detector
npm install
```

### 3. Environment Configuration

Create a `.env` file at the root directory:
```bash
cp .env.example .env
```

Fill in your configurations inside `.env`:
* `GITHUB_APP_ID`: Your GitHub App's numeric ID.
* `GITHUB_WEBHOOK_SECRET`: The webhook secret you configured on your GitHub App page.
* `GROQ_API_KEY`: Your Groq API key (generate one at [Groq Console](https://console.groq.com)).
* `REDIS_URL`: URL to your Redis server (default is `redis://localhost:6379`).

### 4. Authenticate the App
1. Generate a **Private Key** in your GitHub App settings (located at the bottom of the General settings page).
2. Download the `.pem` file.
3. Rename the file to `private-key.pem` and save it directly in the root of your project directory.

---

## 🏃 Running the Application

### Option A: Using Docker Compose (Recommended)
This starts Redis, the Next.js server, and the BullMQ worker containerized:
```bash
docker-compose up --build
```

### Option B: Local Running (Without Docker)
1. Ensure your local Redis server is active:
   ```bash
   redis-server
   ```
2. Start the Next.js Webhook listener:
   ```bash
   npm run dev
   ```
3. Run the BullMQ Worker in a separate terminal:
   ```bash
   npm run worker
   ```

---

## 📂 Codebase Structure

* `src/app/api/webhook/route.ts` - Receives and verifies HMAC signatures of incoming webhooks.
* `src/queue/prQueue.ts` / `worker.ts` - Queue configuration and async worker job handler.
* `src/parser/astParser.ts` - Code language detection and AST generation.
* `src/rules/ruleEngine.ts` - Pre-processing static analysis rules.
* `src/prompt/contextBuilder.ts` - Assembles raw diffs, AST, and rule hints into LLM prompts.
* `src/ai/analyzer.ts` - Calls Groq/OpenAI to generate structured bug findings.
* `src/github/commenter.ts` - Maps finding lines back to diff hunks and posts inline reviews.

---

## 🗺️ Roadmap & Extensions
Interested in contributing or taking this further? See our ignored [REQUIREMENTS.md](file:///c:/VanshSharma/Projects/AI%20Bug%20Detector/REQUIREMENTS.md) file for specifications on:
* Interactive GitHub Suggested Changes (Auto-Fixes)
* Structural syntax query mapping (`S-expressions`)
* Next.js Web UI Dashboard & Telemetry
* Codebase RAG (semantic cross-file context indexing)

---

## 📄 License

MIT
