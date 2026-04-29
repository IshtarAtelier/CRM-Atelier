# Agent Architecture & Google GenAI Rules

## 1. Official Google SDK
- **ALWAYS** use `@google/genai` (the most modern Google GenAI SDK).
- **NEVER** use `@google/generative-ai` (it is deprecated/older).
- Syntax: `const { GoogleGenAI } = require('@google/genai'); const ai = new GoogleGenAI({ apiKey });`

## 2. Standard AI Model
- **ALWAYS** use the model `gemini-3-flash-preview` for all LLM calls, both in LangChain agents and native sub-agents. It provides the best performance and cost balance for this CRM.

## 3. Multimodal Media Processing & Tokens
- **NEVER** pass base64 image strings directly into the conversation context window (it floods the context and consumes massive tokens).
- **ALWAYS** use the **Gemini File API** for images, audio, and videos.
- Workflow:
  1. Upload the file to Gemini using `ai.files.upload()`.
  2. The upload returns a `fileUri` and `mimeType`.
  3. Send this URI to a dedicated ephemeral sub-agent (using `fileData: { fileUri, mimeType }`).
  4. The sub-agent processes the media and returns ONLY the extracted text/summary back to the main agent's context.

## 4. Dual-Agent Architecture with Sub-Agents
- **Sales Agent**: For new prospects. Focuses on onboarding, converting to leads, and basic quoting.
- **Account Executive Agent**: For existing clients. Focuses on post-sales, order status, and advanced interactions.
- Both main agents delegate heavy tasks (like processing prescriptions) to **Ephemeral Sub-Agents** (registered as tools) to maintain strict context isolation and low token usage.
