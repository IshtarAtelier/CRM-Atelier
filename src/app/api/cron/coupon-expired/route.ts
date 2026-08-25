// Aviso diario: qué cupones vencieron, para decidir si sale uno nuevo.
//
// Antes un cupón vencido no avisaba a nadie: quedaba muerto y nadie se
// enteraba de que había que reemplazarlo. Pedido de Ishtar 25/8/26.
//
// Dedup por AuditLog (acción NOTIFY, entityType COUPON): un cupón vencido
// avisa UNA sola vez, no todos los días hasta que alguien lo borre.
import { NextResponse } from 'next/server';
// OJO: formatDate() con un Date usa la zona del SERVIDOR (date-fns format).
// El vencimiento se guarda como 23:59:59 -03:00 = 02:59Z del día siguiente:
// en Railway (UTC) formatDate diría el día CORRIDO — el mismo bug que este
// commit arregló en el formulario. Zona argentina explícita, siempre.
const fechaAR = (d: Date | null | undefined) => d
    ? d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
    : '—';
import { verifyCronAuth } from '@/lib/cron-auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // verifyCronAuth ya existe en el repo (la usan lab-invoices, smartlab-sync
        // y dos más) y compara en TIEMPO CONSTANTE: un !== corta en el primer
        // byte distinto y filtra por timing cuánto del secreto se acertó. Este
        // cron la había reimplementado a mano con !==.
        const auth = verifyCronAuth(request);
        if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const adminEmail = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';

        // Cupones activos cuya fecha ya pasó: "activo" es a propósito — uno
        // desactivado a mano ya no necesita el aviso, el vendedor lo apagó
        // sabiendo lo que hacía.
        const vencidos = await prisma.coupon.findMany({
            where: { isActive: true, expiresAt: { lt: new Date() } },
            orderBy: { expiresAt: 'desc' },
        });

        const avisados: string[] = [];
        for (const c of vencidos) {
            const yaAvisado = await prisma.auditLog.findFirst({
                where: {
                    entityType: 'COUPON', entityId: c.id, action: 'NOTIFY',
                    details: { path: ['evento'], equals: 'cupon_vencido' },
                    // La FECHA DE ESE VENCIMIENTO en el filtro: sin ella, un
                    // cupón avisado al que se le extiende la vigencia nunca
                    // vuelve a avisar cuando vence de nuevo — el dedupe era por
                    // cupón para siempre, no por vencimiento.
                    AND: { details: { path: ['expiresAt'], equals: c.expiresAt?.toISOString() ?? '' } },
                },
                select: { id: true },
            });
            if (yaAvisado) continue;

            const subject = `Cupón vencido: ${c.code}`;
            const text = `El cupón ${c.code} venció el ${fechaAR(c.expiresAt)}.\nSe usó ${c.usedCount} veces.\n¿Lanzamos uno nuevo?\n\nPanel: ${appUrl}/admin/web`;
            const html = `
                <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">
                    <h2 style="margin:0 0 8px">Cupón vencido</h2>
                    <p style="font-size:15px;color:#333">El cupón <strong>${c.code}</strong> venció el ${fechaAR(c.expiresAt)}.</p>
                    <p style="font-size:15px;color:#333">Se usó <strong>${c.usedCount}</strong> ${c.usedCount === 1 ? 'vez' : 'veces'}.</p>
                    <p style="font-size:15px;color:#333">¿Lanzamos uno nuevo?</p>
                    <p><a href="${appUrl}/admin/web" style="display:inline-block;background:#433831;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700">Ver cupones</a></p>
                </div>`;

            const res = await sendEmail({ to: adminEmail, subject, text, html });
            if (res.success) {
                await logAudit({
                    userId: null,
                    userName: 'Sistema',
                    action: 'NOTIFY',
                    entityType: 'COUPON',
                    entityId: c.id,
                    details: { evento: 'cupon_vencido', code: c.code, expiresAt: c.expiresAt, usedCount: c.usedCount },
                });
                avisados.push(c.code);
            }
        }

        return NextResponse.json({ success: true, avisados });
    } catch (error: any) {
        console.error('[Cron cupón vencido] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
