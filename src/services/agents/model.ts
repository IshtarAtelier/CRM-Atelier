import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

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
      return this.geminiModel.invoke(messages, options);
    }

    try {
      return await this.vertexModel.invoke(messages, options);
    } catch (error: any) {
      console.warn(
        '[Agent Model] ChatVertexAI invocation failed, falling back to ChatGoogleGenerativeAI permanently. Error:',
        error.message
      );
      globalUseFallback = true;
      return await this.geminiModel.invoke(messages, options);
    }
  }
}

export function getModel(temperature = 0.2) {
  return new FallbackModel(temperature);
}
