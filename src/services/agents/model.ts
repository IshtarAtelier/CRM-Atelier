import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

import { retryWithBackoff } from "@/lib/retry-utils";

let globalUseFallback = false;

class FallbackModel {
  private vertexModel: ChatVertexAI;
  private geminiModel: ChatGoogleGenerativeAI;

  constructor(temperature: number) {
    this.vertexModel = new ChatVertexAI({
      model: "gemini-2.5-flash",
      location: "global",
      maxOutputTokens: 4096, // Aumentado a 4096 para evitar truncaciones
      temperature,
    });
    this.geminiModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      maxOutputTokens: 4096, // Aumentado a 4096 para evitar truncaciones
      temperature,
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
    });
  }

  async invoke(messages: any, options?: any): Promise<any> {
    if (globalUseFallback) {
      return retryWithBackoff(
        () => this.geminiModel.invoke(messages, options),
        { label: 'Gemini (Fallback) Invoke' }
      );
    }

    try {
      // Retry VertexAI up to 2 times for transient network issues before falling back permanently
      return await retryWithBackoff(
        () => this.vertexModel.invoke(messages, options),
        { maxRetries: 2, delayMs: 500, label: 'VertexAI Invoke' }
      );
    } catch (error: any) {
      console.warn(
        '[Agent Model] ChatVertexAI invocation failed after retries, falling back to ChatGoogleGenerativeAI permanently. Error:',
        error.message
      );
      globalUseFallback = true;
      return retryWithBackoff(
        () => this.geminiModel.invoke(messages, options),
        { label: 'Gemini (Fallback) Invoke' }
      );
    }
  }
}

export function getModel(temperature = 0.2) {
  return new FallbackModel(temperature);
}
