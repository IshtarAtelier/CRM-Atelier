import { NextRequest, NextResponse } from "next/server";
import { SeoAgent } from "@/services/agents/agents/SeoAgent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic } = body;

    if (!topic) {
      return NextResponse.json({ error: "topic (e.g. 'Multifocales en Cordoba') is required" }, { status: 400 });
    }

    const pageData = await SeoAgent.generatePage(topic);

    if (!pageData) {
      return NextResponse.json({ error: "Failed to generate page content" }, { status: 500 });
    }

    return NextResponse.json(pageData);
  } catch (error: any) {
    console.error('[API Agents SEO] Error:', error.message);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
