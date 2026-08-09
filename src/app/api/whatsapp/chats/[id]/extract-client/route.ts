import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { GoogleGenAI, Type } from '@google/genai';
import { decrypt } from '@/lib/auth';
import { CONTACT_SOURCES, matchContactSource } from '@/lib/contact-source';

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
        // @lid ya NO significa "vino de un anuncio de Meta". WhatsApp extendió ese
        // formato a TODOS los contactos: al 29/7/2026 son 1.412 de 1.442 chats (98%).
        // Lo único que sigue siendo cierto es que el número del id no es el teléfono
        // real, así que hay que buscarlo en la conversación.
        const telefonoNoConfiable = waId.includes('@lid');
        // Priorizar realPhone (resuelto por el wa-service) sobre el waId crudo
        const rawPhone = chat.realPhone || (telefonoNoConfiable ? '' : waId.replace('@c.us', '').replace('@s.whatsapp.net', ''));

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
                    enum: [...CONTACT_SOURCES],
                    description: "Fuente de contacto del cliente. SOLO se asigna con evidencia clara en la conversación (Google Ads, Meta, Referido, Calle, Ya es Cliente). El formato del id del chat NO es evidencia: por WhatsApp entra gente de mil bocas. Si la conversación la inició la óptica, o si no hay evidencia, DEBE ser null."
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
- Teléfono extraído del WhatsApp ID: "${rawPhone}" ${telefonoNoConfiable ? '(ATENCIÓN: el id de este chat no contiene el teléfono real. Busca si el cliente mencionó su número en la conversación.)' : ''}
- Tipo de chat: ${isOutboundInitiated ? 'INICIADO POR NOSOTROS (lo escribió la óptica primero) — el contactSource DEBE ser null salvo evidencia explícita en la conversación.' : 'ENTRANTE (el cliente escribió primero). El formato del id NO dice de dónde viene: por WhatsApp entra gente de mil bocas distintas.'}

INSTRUCCIONES:
1. Extrae el nombre real del cliente. Si no se menciona un nombre en la conversación, usa el nombre del perfil de WhatsApp.
2. Extrae el teléfono. Si el waId es @lid y el cliente mencionó un número en la charla, usa ese. Si no, deja vacío (null).
3. Deduce el interés principal (ej: "Multifocal", "Monofocal", "Lentes de contacto", "Armazones", "Gafas de sol", etc.)
4. Detecta si mencionó obra social/seguro médico (ej: "OSDE", "Swiss Medical", "Galeno", "Apross", etc.)
5. Detecta la fuente de contacto (contactSource). REGLAS ESTRICTAS:
   ${`- Solo asigna un origen si hay EVIDENCIA CLARA en la conversación. El tipo de id del chat NO es evidencia:
   - "Google Ads": SOLO si el cliente menciona haber visto un ANUNCIO en Google, o si la primera línea es exactamente "Hola! Vi su anuncio en Google y quiero recibir más información." Encontrarnos por Google o por Maps NO es "Google Ads".
   - "Google Maps": Si el cliente menciona que los encontró por Maps / Google Maps.
   - "Google orgánico": Si el cliente menciona que los buscó o encontró en Google, SIN mencionar un anuncio.
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
            if (/\[meta[^\]]*\]/i.test(firstContent)) {
                deterministicSource = 'Meta';
            } else if (/vi su anuncio en google|los vi en google/i.test(firstContent)) {
                deterministicSource = 'Google Ads';
            }
        }

        // Normalizar contactSource con el vocabulario único (src/lib/contact-source.ts)
        let sourceNorm: string | null = null;
        if (deterministicSource) {
            sourceNorm = deterministicSource;
        } else if (typeof parsedData.contactSource === 'string') {
            // Canónico o null — si la IA devolvió algo fuera del vocabulario,
            // queda vacío para que el usuario elija (nunca adivinar).
            sourceNorm = matchContactSource(parsedData.contactSource);
        } else if (firstInbound && firstInbound.content) {
            // Heurística de último recurso sobre el primer mensaje entrante.
            // OJO atribución: "maps" y la búsqueda genérica en Google NO son
            // pauta — acusarlas como 'Google Ads' inflaba el retorno de la
            // inversión. 'Google Ads' solo sale de la señal determinística
            // del template del anuncio (deterministicSource, más arriba).
            const text = firstInbound.content.toLowerCase();
            if (text.includes('maps')) {
                sourceNorm = 'Google Maps';
            } else if (text.includes('google') || text.includes('búsqueda') || text.includes('busqueda')) {
                sourceNorm = 'Google orgánico';
            } else if (text.includes('instagram') || text.includes('facebook')) {
                sourceNorm = 'Meta';
            }
        }

        // Type safety & Sanitization
        const resultData = {
            name: (typeof parsedData.name === 'string' && parsedData.name.trim() !== '') ? parsedData.name.trim() : (profileName || 'Cliente WhatsApp'),
            phone: typeof parsedData.phone === 'string' ? parsedData.phone : null,
            interest: typeof parsedData.interest === 'string' ? parsedData.interest : null,
            insurance: typeof parsedData.insurance === 'string' ? parsedData.insurance : null,
            contactSource: sourceNorm === 'Otros' ? null : sourceNorm, // Nunca preseleccionar Otros
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
