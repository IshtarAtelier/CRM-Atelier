import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { CRM_ORIGIN } from '@/lib/constants';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';

/**
 * Reclamos post-venta: avisar a la administración por email y dejar el reclamo
 * firmado en la ficha del cliente.
 *
 * Vive acá (y no dentro de una ruta) porque lo llaman dos puertas distintas:
 * `/api/bot/complaints` (el bot, autenticado por BOT_API_KEY) y
 * `/api/complaints` (la puerta histórica). La lógica es una sola; lo único que
 * cambia entre ellas es el actor.
 */

export type ReportComplaintResult =
    | { ok: true; clientName: string }
    | { ok: false; status: number; error: string };

export async function reportComplaint(
    params: { clientId: string; details: string },
    actor?: Actor,
): Promise<ReportComplaintResult> {
    const { clientId, details } = params;
    if (!clientId || !details) {
        return { ok: false, status: 400, error: 'Faltan datos obligatorios (clientId o details)' };
    }

    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, phone: true },
    });
    if (!client) {
        return { ok: false, status: 404, error: 'Cliente no encontrado' };
    }

    const actorName = actor?.name || 'Sistema';

    // Trazabilidad: el reclamo queda en la ficha firmado por quien lo cargó
    // (hoy siempre el bot). Antes esta nota la creaba el wa-service por su
    // cuenta, sin firma, y solo si el email había salido bien.
    await prisma.interaction.create({
        data: {
            clientId: client.id,
            type: 'NOTE',
            content: `[RECLAMO POST-VENTA] Registrado por ${actorName}: ${details}`,
            userId: actor?.id || null,
            userName: actorName,
        },
    }).catch((e) => console.error('[complaints] No se pudo guardar la interacción:', e?.message));

    const adminEmail = process.env.ADMIN_EMAIL || 'crm.atelier.optica@gmail.com';
    const subject = `🚨 NUEVO RECLAMO POST-VENTA - Cliente: ${client.name}`;
    const html = `
            <h2>Reclamo Post-Venta Registrado</h2>
            <p><strong>Cliente:</strong> ${client.name}</p>
            <p><strong>Teléfono:</strong> ${client.phone || 'No registrado'}</p>
            <p><strong>Registrado por:</strong> ${actorName}</p>
            <hr />
            <h3>Detalles del inconveniente:</h3>
            <p style="white-space: pre-wrap;">${details}</p>
            <hr />
            <p style="margin-top: 24px; text-align: center;">
                <a href="${CRM_ORIGIN}/admin/contactos?clientId=${client.id}&section=postsale" style="display: inline-block; padding: 12px 24px; background-color: #d97706; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Abrir la ficha del cliente</a>
            </p>
            <p><em>Por favor, comunicate con el cliente a la brevedad.</em></p>
        `;

    const result = await sendEmail({ to: adminEmail, subject, html });

    logAudit({
        userId: actor?.id || null,
        userName: actorName,
        action: 'NOTIFY',
        entityType: 'POST_SALE_CASE',
        entityId: client.id,
        details: { details, emailEnviado: !!result?.success },
    }).catch(console.error);

    if (!result?.success) {
        return { ok: false, status: 502, error: 'No se pudo enviar el aviso por email' };
    }

    return { ok: true, clientName: client.name };
}
