import { NextResponse } from 'next/server';
import { sendWhatsApp, explainSendFailure } from '@/lib/whatsapp/send';
import { WHATSAPP_TEMPLATES, templateSpec, type TemplateName } from '@/lib/whatsapp/templates';
import { registrarSeguimientoEnviado } from '@/lib/embudo/registrar-seguimiento';
import { getActor } from '@/lib/actor';

// POST /api/whatsapp/send — enviar mensaje desde el CRM (buzón, botones de
// Ventas / Pedidos / Facturación / Cotizador).
//
// Body: { chatId, message, media?, template?: { name, bodyParams } , forceTemplate? }
//  - Sin `template`: texto libre. Con la API oficial, si la ventana de 24 h está
//    cerrada, responde 409 { needsTemplate:true } y NO manda nada.
//  - Con `template` (nombre del catálogo src/lib/whatsapp/templates.ts): intenta
//    texto libre y, si la ventana está cerrada, manda la plantilla con el mismo
//    adjunto como encabezado. Responde { success, via: 'text'|'template' }.
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Identidad confiable: si hay sesión, el senderName SIEMPRE sale del JWT
        // (middleware), nunca del body — es spoofeable (localStorage, DevTools).
        // Ningún flujo automático real llega con cookie de sesión, así que no
        // hace falta (ni conviene) una excepción para 'Sistema Atelier': antes
        // permitía a cualquier vendedor logueado lavar su firma mandándola en el body.
        const sessionUserName = request.headers.get('x-user-name');
        if (sessionUserName) {
            body.senderName = sessionUserName;
        }

        if (!body.chatId) return NextResponse.json({ error: 'chatId requerido' }, { status: 400 });

        // Solo plantillas del catálogo: el nombre y la cantidad de variables se
        // validan acá para que un typo no llegue a Meta como TEMPLATE_ERROR.
        let template = null;
        if (body.template?.name) {
            const name = String(body.template.name) as TemplateName;
            if (!(name in WHATSAPP_TEMPLATES)) {
                return NextResponse.json({ error: `Plantilla desconocida: ${name}` }, { status: 400 });
            }
            try {
                template = templateSpec(name, Array.isArray(body.template.bodyParams) ? body.template.bodyParams : []);
            } catch (e: any) {
                return NextResponse.json({ error: e.message }, { status: 400 });
            }
        }

        console.log('[WhatsApp Send] Sending to:', body.chatId, '| Has media:', !!body.media, '| Template:', template?.name || '-', '| From:', body.senderName || 'CRM');

        const r = await sendWhatsApp({
            chatId: body.chatId,
            message: body.message ?? '',
            media: body.media ?? null,
            senderName: body.senderName,
            isProactive: body.isProactive === true,
            template,
            forceTemplate: body.forceTemplate === true,
        });

        if (r.ok) {
            // ── Rastro del embudo ───────────────────────────────────────────
            // Si lo que salió fue una plantilla de SEGUIMIENTO, queda anotado:
            // etiqueta en el chat + nota firmada en la ficha. Es lo que mueve
            // la tarjeta en /admin/leads. Va después del envío confirmado y
            // nunca lo tumba: el mensaje ya llegó, el registro es lo accesorio.
            if (template?.name) {
                await registrarSeguimientoEnviado({
                    chatId: String(body.chatId),
                    plantilla: template.name,
                    actor: getActor(request),
                }).catch((e: any) => console.error('[WhatsApp Send] No se pudo registrar el seguimiento en el embudo:', e.message));
            }
            return NextResponse.json({ success: true, via: r.via });
        }

        const status = r.needsTemplate ? 409 : (r.status && r.status >= 400 ? r.status : 502);
        return NextResponse.json({
            error: explainSendFailure(r),
            detail: r.error,
            code: r.code,
            notSent: r.notSent,
            needsTemplate: r.needsTemplate === true,
        }, { status });
    } catch (error: any) {
        // Acá solo caen fallos ANTES de intentar el envío (body mal formado, etc.):
        // `sendWhatsApp` ya no lanza por errores de red, devuelve el resultado
        // ambiguo con notSent:false. Igual se responde explícito notSent:false —
        // decir "no salió" sin saberlo hace que la vendedora reescriba y el
        // cliente reciba (y Meta cobre) dos veces.
        console.error('[WhatsApp Send] Error connecting to wa-service:', error.message);
        return NextResponse.json({
            error: `Servidor de WhatsApp no disponible: ${error.message}. Verificá el chat antes de reenviar.`,
            notSent: false,
        }, { status: 503 });
    }
}
