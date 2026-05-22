import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { getToolsForRole, type CopilotTool } from '@/lib/copilot-tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BASE_PROMPT = `Eres el Copilot interno de Atelier Óptica, un asistente IA para el equipo de trabajo.

REGLAS ESTRICTAS:
1. Respondé SIEMPRE en español argentino, de forma concisa y profesional.
2. Usá las herramientas disponibles para consultar datos reales. NUNCA inventes datos.
3. Si la pregunta requiere una herramienta que no tenés disponible, respondé amablemente que no tenés permisos para esa consulta.
4. Formateá los montos con separador de miles (ej: $1.250.000).
5. Sé directo y breve. No repitas la pregunta del usuario.
6. Si necesitás buscar un cliente primero para obtener su ID, usá lookup_client y luego las otras herramientas con ese ID.
7. No reveles detalles técnicos internos (IDs, queries, etc.) al usuario.
8. Si no encontrás datos, decilo claramente.

Siempre que termines de ejecutar una acción exitosamente, sugerí brevemente qué más podría necesitar. Por ejemplo, después de actualizar un estado: "¿Necesitás algo más? Puedo consultar saldos o buscar otro pedido."`;

const STAFF_MENU = `
COMPORTAMIENTO PROACTIVO:
Cuando el usuario te saluda o pregunta qué podés hacer, respondé con un saludo cálido usando su nombre y ofrecé este menú:

"¡Hola [nombre]! 👋 Soy tu asistente de Atelier. Decime en qué te ayudo:

📦 **Pedidos** — Pasá estados, cargá N° de operación, consultá en qué anda un pedido
💰 **Saldos** — Cuánto debe un cliente, cuánto falta por cobrar
🔍 **Clientes** — Buscá datos, teléfono, obra social, doctor
📊 **Tu rendimiento** — Cuánto vendiste hoy o esta semana
🏷️ **Stock y precios** — Consultá disponibilidad y precios de productos

Ejemplo: *'Pasá el pedido de María a listo para retirar'* o *'¿Cuánto debe Juan?'*"`;

const ADMIN_MENU = `
COMPORTAMIENTO PROACTIVO:
Cuando el usuario te saluda o pregunta qué podés hacer, respondé con un saludo cálido usando su nombre y ofrecé este menú completo de administrador:

"¡Hola [nombre]! 👋 Soy tu asistente de Atelier. Tenés acceso completo como Admin. Decime en qué te ayudo:

📦 **Pedidos** — Pasá estados, cargá N° de operación, consultá en qué anda un pedido
💰 **Saldos** — Cuánto debe un cliente, saldos pendientes globales, top deudores
🔍 **Clientes** — Buscá datos, teléfono, obra social, doctor
📊 **Rendimiento del equipo** — Ranking de vendedores, ventas por vendedor
🏷️ **Stock y precios** — Disponibilidad, precios y costos de proveedor con márgenes
💵 **Reporte financiero** — Ingresos, costos, ganancia neta, margen por mes
🧾 **Facturación** — Totales facturados por cuenta (ISH/YANI), comprobantes
📉 **Gastos** — Resumen de gastos fijos, marketing y proveedores
📈 **Unidades vendidas** — Cuántas unidades de un producto se vendieron en un período

Ejemplo: *'Dame el reporte financiero de mayo'* o *'Ranking de vendedores de este mes'*"`;

function buildSystemPrompt(role: string): string {
  return BASE_PROMPT + (role === 'ADMIN' ? ADMIN_MENU : STAFF_MENU);
}

function buildGeminiTools(tools: CopilotTool[]) {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export async function POST(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role') || 'STAFF';
    const userId = request.headers.get('x-user-id') || '';
    const userName = request.headers.get('x-user-name') || 'Usuario';

    const { message, history } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key no configurada' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const availableTools = getToolsForRole(userRole);
    const geminiTools = buildGeminiTools(availableTools);
    const toolContext = { userId, userRole, userName };
    const systemPrompt = buildSystemPrompt(userRole);

    // Build conversation history
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    // First call to Gemini
    let response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: geminiTools }],
      },
    });

    // Tool-calling loop (max 5 iterations)
    let iterations = 0;
    while (iterations < 5) {
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Check if there are function calls
      const functionCalls = parts.filter((p: any) => p.functionCall);
      if (!functionCalls.length) break;

      // Execute each function call
      const functionResponses: Array<{ name: string; response: { result: string } }> = [];
      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        const tool = availableTools.find(t => t.name === fc.name);
        
        let result: string;
        if (tool) {
          try {
            result = await tool.execute(fc.args || {}, toolContext);
          } catch (err: any) {
            result = `Error ejecutando ${fc.name}: ${err.message}`;
          }
        } else {
          result = `Herramienta "${fc.name}" no disponible para tu rol.`;
        }

        functionResponses.push({ name: fc.name, response: { result } });
      }

      // Send function results back to Gemini
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          ...contents,
          { role: 'model', parts: parts },
          {
            role: 'user',
            parts: functionResponses.map(fr => ({
              functionResponse: fr,
            })),
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: geminiTools }],
        },
      });

      iterations++;
    }

    // Extract final text response
    const finalText = response.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .filter(Boolean)
      .join('') || 'No pude procesar tu consulta. Intentá de nuevo.';

    return NextResponse.json({ response: finalText });
  } catch (error: any) {
    const { handleAIError } = await import('@/lib/ai-error-handler');
    try {
        await handleAIError(error, 'Copiloto de Administración');
    } catch (handledError: any) {
        return NextResponse.json(
          { error: 'Error interno del Copilot', details: handledError.message },
          { status: 500 }
        );
    }
    return NextResponse.json(
      { error: 'Error interno del Copilot', details: error.message },
      { status: 500 }
    );
  }
}
