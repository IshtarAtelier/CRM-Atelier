import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { GoogleGenAI, Type } from '@google/genai';
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

        // Obtener el primer mensaje absoluto del chat para determinar si fue iniciado por nosotros
        const firstMessage = await prisma.whatsAppMessage.findFirst({
            where: { chatId },
            orderBy: { createdAt: 'asc' },
        });

        // Obtener los últimos 40 mensajes para construir el contexto de la conversación
        const messages = await prisma.whatsAppMessage.findMany({
            where: { chatId },
            orderBy: { createdAt: 'desc' },
            take: 40,
        });

        const sortedMessages = [...messages].reverse();
        const conversation = sortedMessages.map(m => {
            const role = m.direction === 'INBOUND' ? 'Cliente' : 'Óptica';
            return `${role}: ${m.content}`;
        }).join('\n');

        const isOutboundInitiated = firstMessage?.direction === 'OUTBOUND';
        const profileName = chat.profileName || '';
        const waId = chat.waId || '';
        const isLid = waId.includes('@lid') && !isOutboundInitiated;
        // Priorizar realPhone (resuelto por el wa-service) sobre el waId crudo
        const rawPhone = chat.realPhone || (isLid ? '' : waId.replace('@c.us', '').replace('@s.whatsapp.net', ''));

        // Llamar a Gemini para extraer datos con el SDK oficial modernizado
        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || '';
        const ai = new GoogleGenAI({ apiKey });

        const clientExtractionSchema = {
            type: Type.OBJECT,
            properties: {
                name: {
                    type: Type.STRING,
                    description: "Nombre real del cliente. Si no se menciona un nombre en la conversación, usa el nombre del perfil de WhatsApp. No puede estar vacío."
                },
                phone: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Número de teléfono celular/WhatsApp del cliente (solo dígitos). Si el waId es @lid y el cliente mencionó un número en la charla, usa ese. Si no hay evidencia clara, retorna null."
                },
                interest: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Interés principal deducido de la conversación (ej: 'Multifocal', 'Monofocal', 'Lentes de contacto', 'Armazones', 'Gafas de sol', etc.) o null si no se menciona."
                },
                insurance: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Obra social o seguro médico mencionado (ej: 'OSDE', 'Swiss Medical', 'Galeno', 'Apross', etc.) o null si no se menciona."
                },
                contactSource: {
                    type: Type.STRING,
                    nullable: true,
                    enum: ["Google Ads", "Meta", "Calle", "Jemima", "Ya es Cliente", "Tienda nube", "Referido", "Wave", "Salida", "Otros"],
                    description: "Fuente de contacto del cliente. Si es un chat de ANUNCIO META (@lid) iniciado por el cliente, DEBE ser 'Meta'. Si es DIRECTO o INICIADO POR NOSOTROS (Outbound), DEBE ser null a menos que haya EVIDENCIA CLARA en la conversación (Google Ads, Meta, Referido, Calle, Ya es Cliente)."
                },
                notes: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Cualquier nota relevante, preferencias, urgencia o comentarios importantes de la conversación o null si no hay."
                }
            },
            required: ["name", "phone", "interest", "insurance", "contactSource", "notes"]
        };

        const prompt = `Analiza esta conversación de WhatsApp de una óptica y extrae los datos del cliente potencial.

CONVERSACIÓN:
${conversation}

DATOS CONOCIDOS:
- Nombre de perfil de WhatsApp: "${profileName}"
- Teléfono extraído del WhatsApp ID: "${rawPhone}" ${isLid ? '(ATENCIÓN: este chat llegó por anuncio de Meta/Click-to-WhatsApp, el número puede ser falso. Busca si el cliente mencionó su teléfono en la conversación.)' : ''}
- Tipo de chat: ${isOutboundInitiated ? 'INICIADO POR NOSOTROS (Outbound chat iniciado por la óptica) — el contactSource DEBE ser null salvo evidencia explícita.' : (isLid ? 'ANUNCIO META (Click-to-WhatsApp Ad) — el contactSource DEBE ser "Meta"' : 'CHAT DIRECTO ENTRANTE (el cliente escribió directamente al número de WhatsApp)')}

INSTRUCCIONES:
1. Extrae el nombre real del cliente. Si no se menciona un nombre en la conversación, usa el nombre del perfil de WhatsApp.
2. Extrae el teléfono. Si el waId es @lid y el cliente mencionó un número en la charla, usa ese. Si no, deja vacío (null).
3. Deduce el interés principal (ej: "Multifocal", "Monofocal", "Lentes de contacto", "Armazones", "Gafas de sol", etc.)
4. Detecta si mencionó obra social/seguro médico (ej: "OSDE", "Swiss Medical", "Galeno", "Apross", etc.)
5. Detecta la fuente de contacto (contactSource). REGLAS ESTRICTAS:
   ${isLid ? '- Este chat es de tipo ANUNCIO META (@lid) iniciado por el cliente, por lo tanto contactSource DEBE ser "Meta".' : `- Este chat es DIRECTO o fue INICIADO POR NOSOTROS. Solo asigna un origen si hay EVIDENCIA CLARA en la conversación:
   - "Google Ads": Si el cliente menciona que los encontró por Google/Maps o si la primera línea es exactamente "Hola! Vi su anuncio en Google y quiero recibir más información." o contiene referencias a Google.
   - "Meta": Si el cliente menciona que vio un anuncio en Instagram o Facebook, o si hay un tag en corchetes que empiece con "meta" o "Meta" (ej: [metaFlor], [MetaAgos], [metaSofi], [metacursi], etc.).
   - "Referido": Si menciona que alguien lo recomendó, un amigo, conocido o familiar.
   - "Calle": Si dice que vio el local al pasar o pasó por la puerta.
   - "Ya es Cliente": Si se identifica como cliente existente.
   - null: EN CASO DE DUDA o si no hay evidencia clara del origen, DEBE ser null. Este es el valor por defecto.
   IMPORTANTE: Si la conversación la iniciamos nosotros, el default es obligatoriamente null.`}
6. Extrae cualquier nota relevante (ej: preferences, urgencia, comentarios importantes)
`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: clientExtractionSchema,
                temperature: 0.2,
            }
        });

        const responseText = response.text;
        if (!responseText) {
            return NextResponse.json({ 
                error: 'No se pudo extraer datos de la conversación (respuesta vacía de la IA)' 
            }, { status: 422 });
        }

        let parsedData: any;
        try {
            parsedData = JSON.parse(responseText);
        } catch (parseError: any) {
            console.error('Error parsing Gemini response:', responseText, parseError);
            return NextResponse.json({ 
                error: 'La IA no devolvió un JSON válido',
                raw: responseText 
            }, { status: 422 });
        }

        // Deterministic template pre-extraction
        const firstInbound = sortedMessages.find(m => m.direction === 'INBOUND');
        let deterministicSource: string | null = null;
        if (firstInbound && firstInbound.content) {
            const firstContent = firstInbound.content;
            if (/\[meta[a-zA-Z0-9_-]+\]/i.test(firstContent)) {
                deterministicSource = 'Meta';
            } else if (/vi su anuncio en google|los vi en google/i.test(firstContent)) {
                deterministicSource = 'Google Ads';
            }
        }

        // Normalize contactSource casing/spelling
        let sourceNorm = parsedData.contactSource;
        if (deterministicSource) {
            sourceNorm = deterministicSource;
        } else if (typeof sourceNorm === 'string') {
            sourceNorm = sourceNorm.trim();
            const lower = sourceNorm.toLowerCase();
            if (lower.includes('google') || lower === 'gads') {
                sourceNorm = 'Google Ads';
            } else if (
                lower.includes('meta') || 
                lower.includes('instagram') || 
                lower.includes('facebook') || 
                lower === 'face' ||
                lower === 'fb' ||
                lower === 'ig'
            ) {
                sourceNorm = 'Meta';
            } else if (lower === 'ya es cliente') {
                sourceNorm = 'Ya es Cliente';
            } else if (lower === 'tienda nube' || lower === 'tiendanube') {
                sourceNorm = 'Tienda nube';
            } else if (lower === 'referido' || lower === 'recomendado' || lower === 'recomendada') {
                sourceNorm = 'Referido';
            } else if (lower === 'calle') {
                sourceNorm = 'Calle';
            } else if (lower === 'wave') {
                sourceNorm = 'Wave';
            } else if (lower === 'salida') {
                sourceNorm = 'Salida';
            } else if (lower === 'jemima' || lower.includes('jemima')) {
                sourceNorm = 'Jemima';
            } else {
                sourceNorm = 'Otros';
            }
        } else {
            // Fallback heuristics directly on the first inbound message content
            if (firstInbound && firstInbound.content) {
                const text = firstInbound.content.toLowerCase();
                if (text.includes('google') || text.includes('búsqueda') || text.includes('busqueda') || text.includes('maps')) {
                    sourceNorm = 'Google Ads';
                } else if (text.includes('meta') || text.includes('instagram') || text.includes('facebook') || text.includes('face')) {
                    sourceNorm = 'Meta';
                } else {
                    sourceNorm = null;
                }
            } else {
                sourceNorm = null;
            }
        }

        // Type safety & Sanitization
        const resultData = {
            name: (typeof parsedData.name === 'string' && parsedData.name.trim() !== '') ? parsedData.name.trim() : (profileName || 'Cliente WhatsApp'),
            phone: typeof parsedData.phone === 'string' ? parsedData.phone : null,
            interest: typeof parsedData.interest === 'string' ? parsedData.interest : null,
            insurance: typeof parsedData.insurance === 'string' ? parsedData.insurance : null,
            contactSource: sourceNorm,
            notes: typeof parsedData.notes === 'string' ? parsedData.notes : null
        };

        // Sanitizar teléfono
        let phone = resultData.phone;
        if (phone) {
            const digits = phone.replace(/\D/g, '');
            if (digits.length > 15 || digits.length < 8) {
                phone = null;
            } else {
                phone = digits;
            }
        }

        // Fallback para el teléfono si no se extrajo y el waId crudo es válido
        if (!phone && rawPhone) {
            const digits = rawPhone.replace(/\D/g, '');
            if (digits.length >= 8 && digits.length <= 15) {
                phone = digits;
            }
        }
        resultData.phone = phone;

        return NextResponse.json({
            extracted: resultData,
            chatId,
            profileName,
            messageCount: messages.length,
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
