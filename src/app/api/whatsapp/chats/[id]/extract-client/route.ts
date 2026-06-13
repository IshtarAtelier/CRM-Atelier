import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { decrypt } from '@/lib/auth';

// POST /api/whatsapp/chats/[id]/extract-client
// Lee los mensajes del chat y usa IA para extraer datos del cliente
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: chatId } = await params;

    // Auth: este endpoint usa IA y debe estar protegido
    const session = req.cookies.get('session')?.value;
    if (!session) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const payload = await decrypt(session);
    if (!payload) {
        return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
    }

    try {
        const chat = await prisma.whatsAppChat.findUnique({
            where: { id: chatId },
            include: {
                messages: { orderBy: { createdAt: 'asc' }, take: 30 },
                client: true,
            }
        });

        if (!chat) {
            return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 });
        }

        if (chat.client) {
            return NextResponse.json({ 
                error: 'Este chat ya tiene un cliente vinculado',
                client: chat.client 
            }, { status: 409 });
        }

        // Construir contexto de la conversación
        const conversation = chat.messages.map(m => {
            const role = m.direction === 'INBOUND' ? 'Cliente' : 'Óptica';
            return `${role}: ${m.content}`;
        }).join('\n');        const absoluteFirstMessage = chat.messages[0];
        const isOutboundInitiated = absoluteFirstMessage?.direction === 'OUTBOUND';
        const profileName = chat.profileName || '';
        const waId = chat.waId || '';
        const isLid = waId.includes('@lid') && !isOutboundInitiated;
        // Priorizar realPhone (resuelto por el wa-service) sobre el waId crudo
        const rawPhone = chat.realPhone || (isLid ? '' : waId.replace('@c.us', '').replace('@s.whatsapp.net', ''));

        // Llamar a Gemini para extraer datos
        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || '';
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Analiza esta conversación de WhatsApp de una óptica y extrae los datos del cliente potencial.

CONVERSACIÓN:
${conversation}

DATOS CONOCIDOS:
- Nombre de perfil de WhatsApp: "${profileName}"
- Teléfono extraído del WhatsApp ID: "${rawPhone}" ${isLid ? '(ATENCIÓN: este chat llegó por anuncio de Meta/Click-to-WhatsApp, el número puede ser falso. Busca si el cliente mencionó su teléfono en la conversación.)' : ''}
- Tipo de chat: ${isOutboundInitiated ? 'INICIADO POR NOSOTROS (Outbound chat iniciado por la óptica) — el contactSource DEBE ser null salvo evidencia explícita.' : (isLid ? 'ANUNCIO META (Click-to-WhatsApp Ad) — el contactSource DEBE ser "Meta"' : 'CHAT DIRECTO ENTRANTE (el cliente escribió directamente al número de WhatsApp)')}

INSTRUCCIONES:
1. Extrae el nombre real del cliente. Si no se menciona un nombre en la conversación, usa el nombre del perfil de WhatsApp.
2. Extrae el teléfono. Si el waId es @lid y el cliente mencionó un número en la charla, usa ese. Si no, deja vacío.
3. Deduce el interés principal (ej: "Multifocal", "Monofocal", "Lentes de contacto", "Armazones", "Gafas de sol", etc.)
4. Detecta si mencionó obra social/seguro médico (ej: "OSDE", "Swiss Medical", "PAMI", "Apross", etc.)
5. Detecta la fuente de contacto (contactSource). REGLAS ESTRICTAS:
   ${isLid ? '- Este chat es de tipo ANUNCIO META (@lid) iniciado por el cliente, por lo tanto contactSource DEBE ser "Meta".' : `- Este chat es DIRECTO o fue INICIADO POR NOSOTROS. Solo asigna un origen si hay EVIDENCIA CLARA en la conversación:
   - "Google Ads": SOLO si el cliente dice explícitamente que los encontró por Google, Maps o búsqueda de Google.
   - "Meta": SOLO si el cliente dice explícitamente que vio un anuncio en Instagram o Facebook.
   - "Referido": Si menciona que alguien lo recomendó, un amigo, conocido o familiar.
   - "Calle": Si dice que vio el local al pasar o pasó por la puerta.
   - "Ya es Cliente": Si se identifica como cliente existente.
   - null: EN CASO DE DUDA o si no hay evidencia clara del origen, DEBE ser null. Este es el valor por defecto.
   IMPORTANTE: No asumas "Meta" solo porque la conversación menciona palabras como "publicidad", "anuncio" o "vi esto". Solo usa "Meta" si el cliente dice EXPLÍCIPAMENTE que vio algo en Instagram o Facebook. Si la conversación la iniciamos nosotros, el default es obligatoriamente null.`}
6. Extrae cualquier nota relevante (ej: preferences, urgencia, comentarios importantes)

Responde ÚNICAMENTE con un JSON válido con estos campos:
{
  "name": "string",
  "phone": "string o null",
  "interest": "string o null",
  "insurance": "string o null",
  "contactSource": "Google Ads" | "Meta" | "Calle" | "Jemima" | "Ya es Cliente" | "Tienda nube" | "Referido" | "Wave" | "Salida" | "Otros" | null,
  "notes": "string o null"
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Parsear JSON robusto
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return NextResponse.json({ 
                error: 'No se pudo extraer datos de la conversación',
                raw: text 
            }, { status: 422 });
        }

        const extracted = JSON.parse(jsonMatch[0]);

        // Sanitizar teléfono
        if (extracted.phone) {
            const digits = extracted.phone.replace(/\D/g, '');
            if (digits.length > 15 || digits.length < 8) {
                extracted.phone = null;
            }
        }

        // Fallbacks
        if (!extracted.name || extracted.name.trim() === '') {
            extracted.name = profileName || 'Cliente WhatsApp';
        }
        if (!extracted.phone && rawPhone && rawPhone.length >= 8 && rawPhone.length <= 15) {
            extracted.phone = rawPhone;
        }

        return NextResponse.json({
            extracted,
            chatId,
            profileName,
            messageCount: chat.messages.length,
        });

    } catch (error: any) {
        const { handleAIError } = await import('@/lib/ai-error-handler');
        try {
            await handleAIError(error, 'Extracción de Datos de Cliente (WhatsApp)');
        } catch (handledError: any) {
            return NextResponse.json({ error: handledError.message }, { status: 500 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
