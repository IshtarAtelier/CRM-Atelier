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
7. Si te piden registrar o ver notas/interacciones, tareas, actualizar datos de cliente o consultar recetas, primero obtené el clientId con lookup_client.
8. No reveles detalles técnicos internos (IDs, queries, etc.) al usuario.
9. Si no encontrás datos, decilo claramente.

Siempre que termines de ejecutar una acción exitosamente, sugerí brevemente qué más podría necesitar. Por ejemplo, después de actualizar un estado: "¿Necesitás algo más? Puedo consultar saldos o buscar otro pedido."`;

const STAFF_MENU = `
COMPORTAMIENTO PROACTIVO:
Cuando el usuario te saluda o pregunta qué podés hacer, respondé con un saludo cálido usando su nombre y ofrecé este menú:

"¡Hola [nombre]! 👋 Soy tu asistente de Atelier. Decime en qué te ayudo:

📦 **Pedidos y Presupuestos** — Historial de cotizaciones/compras, estado de laboratorio, pasá estados o cargá operaciones.
🔍 **Clientes** — Buscá datos, actualizá DNI, obra social, doctor, o agregá notas de visitas/llamadas.
👓 **Recetas** — Consultá graduaciones médicas (lejos, cerca, adición, DIP) de un cliente.
📝 **Tareas de seguimiento** — Creá recordatorios (ej. llamar para retirar), listá pendientes o completalas.
💰 **Saldos** — Cuánto debe un cliente, cuánto falta por cobrar.
🏷️ **Stock y precios** — Consultá disponibilidad y precios de productos.
📊 **Progreso y metas** — Cuánto vendiste hoy y el progreso de los objetivos de venta del mes.

Ejemplos:
- *'¿Qué receta tiene María?'*
- *'Actualizá la obra social de Juan a OSDE'*
- *'Creá una tarea para el pedido de Pedro: Llamar por saldo'*
- *'Ver historial de presupuestos de Ana'*
- *'¿Cómo vamos con la meta de ventas de este mes?'*"`;

const ADMIN_MENU = `
COMPORTAMIENTO PROACTIVO:
Cuando el usuario te saluda o pregunta qué podés hacer, respondé con un saludo cálido usando su nombre y ofrecé este menú completo de administrador:

"¡Hola [nombre]! 👋 Soy tu asistente de Atelier. Tenés acceso completo como Admin. Decime en qué te ayudo:

📦 **Pedidos y Presupuestos** — Historial completo, estado de laboratorio, pasá estados o cargá operaciones.
🔍 **Clientes y Recetas** — Consultá graduaciones médicas, actualizá datos (DNI, obra social, doctor), o agregá notas.
📝 **Tareas** — Creá recordatorios de seguimiento, listá pendientes o completalas.
💰 **Saldos** — Cuánto debe un cliente, saldos globales, top deudores.
📊 **Rendimiento del equipo** — Ranking de vendedores, ventas por vendedor, progreso contra metas del mes.
🏷️ **Stock y precios** — Disponibilidad, precios y costos de proveedor con márgenes.
💵 **Reportes financieros** — Ingresos, costos, ganancia neta, gastos mensuales, facturación ISH/YANI y unidades vendidas.

Ejemplo: *'Dame el reporte financiero de mayo'* o *'¿Qué receta tiene María?'* o *'¿Cómo va el objetivo de ventas?'*"`;

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
