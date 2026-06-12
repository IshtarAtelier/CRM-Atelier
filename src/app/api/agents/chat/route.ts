import { NextRequest, NextResponse } from "next/server";
import { AgentOrchestrator } from "@/services/agents/AgentOrchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, message, image } = body;

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const result = await AgentOrchestrator.processClientMessage(clientId, message, image);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Agents Chat] Error:', error.message);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
