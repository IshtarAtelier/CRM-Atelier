import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import { RENDICION_CUTOFF_ISO } from '@/lib/constants';
import type { Actor } from '@/lib/actor';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';

// Métodos de pago que son efectivo físico en caja (mismo criterio que getCashBalance)
const CASH_METHODS = ['EFECTIVO', 'CASH'];

export const CashService = {
    /**
     * Calcula el saldo total en efectivo.
     * Saldo = (Pagos en Efectivo) + (Entradas manuales) - (Salidas manuales)
     */
    async getCashBalance() {
        // 1. Calcular el total de pagos en efectivo directamente en la DB (O(1) Memory)
        const paymentsAgg = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { 
                method: { in: ['EFECTIVO', 'CASH'] },
                order: { isDeleted: false }
            }
        });
        const paymentsTotal = paymentsAgg._sum.amount || 0;

        // 2. Calcular los totales de movimientos manuales de caja (IN / OUT)
        const manualInAgg = await prisma.cashMovement.aggregate({
            _sum: { amount: true },
            where: { type: 'IN' }
        });
        const manualIn = manualInAgg._sum.amount || 0;

        const manualOutAgg = await prisma.cashMovement.aggregate({
            _sum: { amount: true },
            where: { type: 'OUT' }
        });
        const manualOut = manualOutAgg._sum.amount || 0;

        const manualBalance = manualIn - manualOut;
        const totalCash = paymentsTotal + manualBalance;

        // 3. Cargar SÓLO los 50 movimientos más recientes para la Línea de Tiempo del Frontend
        const recentPayments = await prisma.payment.findMany({
            where: { 
                method: { in: ['EFECTIVO', 'CASH'] },
                order: { isDeleted: false }
            },
            include: { order: { include: { client: true, user: true } } },
            orderBy: { date: 'desc' },
            take: 50
        });

        const recentMovements = await prisma.cashMovement.findMany({
            include: { user: true },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // Convertir pagos a formato de movimiento
        const formattedPayments = recentPayments.map((p: any) => ({
            id: p.id,
            type: 'IN',
            amount: p.amount || 0,
            reason: `Cobro Venta - ${p.order?.client?.name || 'Cliente'}`,
            category: 'VENTA',
            createdAt: p.date, 
            user: { name: p.order?.user?.name || 'Vendedor' },
            receiptUrl: p.receiptUrl
        }));

        // Combinar top 50 de ambas fuentes, ordenar final y devolver
        const allMovements = [...recentMovements, ...formattedPayments].sort((a: any, b: any) => {
            return new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime();
        }).slice(0, 50);

        return {
            total: totalCash,
            paymentsTotal: paymentsTotal,
            manualBalance: manualBalance,
            manualIn: manualIn,
            manualOut: manualOut,
            movements: allMovements,
        };
    },

    /**
     * Registra un nuevo movimiento de caja (entrada o salida).
     */
    async registerMovement(params: { type: 'IN' | 'OUT', amount: number, reason: string, userId: string, receiptUrl?: string, category?: string, laboratory?: string }) {
        const { type, amount, reason, userId, receiptUrl, category, laboratory } = params;

        const movement = await prisma.cashMovement.create({
            data: { type, amount, reason, userId, receiptUrl, category: category || 'OTRO', laboratory },
            include: { user: true }
        });

        // Notificar por email si es una salida
        if (type === 'OUT') {
            const labLine = laboratory ? `\nLaboratorio: ${laboratory}` : '';
            const catLabel = category === 'PAGO_LABORATORIO' ? 'Pago Laboratorio' : category === 'GASTO_GENERAL' ? 'Gasto General' : 'Otro';
            try {
                await sendEmail({
                    to: ADMIN_EMAIL,
                    subject: '🚨 Salida de Efectivo Registrada',
                    text: `Se ha registrado una salida de efectivo:\n\n` +
                    `Monto: $${amount.toLocaleString('es-AR')}\n` +
                    `Categoría: ${catLabel}\n` +
                    `Motivo: ${reason}${labLine}\n` +
                    `Registrado por: ${movement.user.name}\n` +
                    `Fecha: ${movement.createdAt.toLocaleString('es-AR')}`
                });
            } catch (e) {
                console.error('Error enviando email de egreso:', e);
            }

            // También registrar en notificaciones de la DB
            await prisma.notification.create({
                data: {
                    type: 'CASH_OUTFLOW',
                    message: `Salida de efectivo: $${amount.toLocaleString('es-AR')} - ${reason}${laboratory ? ` (${laboratory})` : ''}`,
                    requestedBy: movement.user.name,
                    status: 'COMPLETED'
                }
            });
        }

        // Verificar umbral de 300.000 para alerta
        await this.checkBalanceAndAlert();

        return movement;
    },

    /**
     * Verifica el saldo actual y envía una alerta si supera los umbrales de 1M o 2M.
     */
    async checkBalanceAndAlert() {
        const balance = await this.getCashBalance();
        let thresholdName = null;
        let urgency = '';
        
        if (balance.total >= 2000000) {
            thresholdName = '2MILLION';
            urgency = '🚨 ALERTA DE RETIRO URGENTE (Más de 2 Millones)';
        } else if (balance.total >= 1000000) {
            thresholdName = '1MILLION';
            urgency = '⚠️ Alerta: Saldo de Caja Elevado (Más de 1 Millón)';
        }

        if (thresholdName) {
            // Check if we already alerted today for this threshold to avoid spam
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const existingAlert = await prisma.notification.findFirst({
                where: {
                    type: 'HIGH_CASH_BALANCE',
                    message: { contains: thresholdName },
                    createdAt: { gte: today }
                }
            });

            if (!existingAlert) {
                try {
                    await sendEmail({
                        to: ADMIN_EMAIL,
                        subject: urgency,
                        text: `El saldo de efectivo en caja ha superado los límites establecidos.\n\n` +
                        `Saldo actual: $${balance.total.toLocaleString('es-AR')}\n\n` +
                        `Por motivos de seguridad, se requiere realizar un retiro a la brevedad.`
                    });
                } catch (e) {
                    console.error('Error enviando email de alerta de caja:', e);
                }

                // También registrar en notificaciones de la DB
                await prisma.notification.create({
                    data: {
                        type: 'HIGH_CASH_BALANCE',
                        message: `${urgency} - ${thresholdName} - Saldo actual: $${balance.total.toLocaleString('es-AR')}`,
                        requestedBy: 'SYSTEM',
                        status: 'PENDING'
                    }
                });
            }
        }
    },

    // ── Rendiciones y arqueo ─────────────────────────────────────────────
    // Circuito: los cobros en efectivo quedan a nombre de quien los registró
    // (Payment.createdById). El vendedor "rinde" entregando el efectivo a la
    // encargada de caja (doble confirmación) y la encargada cierra lotes con
    // arqueos (conteo físico vs. saldo teórico).

    /** ADMIN o encargado de caja (User.cashManager). */
    async canManageCash(actor: Actor): Promise<boolean> {
        if (actor.role === 'ADMIN') return true;
        if (!actor.id) return false;
        const user = await prisma.user.findUnique({
            where: { id: actor.id },
            select: { cashManager: true },
        });
        return !!user?.cashManager;
    },

    /**
     * Efectivo pendiente de rendición de un vendedor: cobros en efectivo que
     * registró desde su última rendición (o desde el inicio del circuito).
     */
    async getVendorPendingCash(vendorId: string) {
        const lastHandover = await prisma.cashHandover.findFirst({
            where: { vendorId },
            orderBy: { periodTo: 'desc' },
            select: { periodTo: true },
        });
        const pendingHandover = await prisma.cashHandover.findFirst({
            where: { vendorId, status: 'PENDING' },
            select: { id: true, declaredAmount: true, createdAt: true },
        });

        const periodFrom = lastHandover?.periodTo || new Date(RENDICION_CUTOFF_ISO);
        const periodTo = new Date();

        const payments = await prisma.payment.findMany({
            where: {
                createdById: vendorId,
                method: { in: CASH_METHODS },
                date: { gt: periodFrom, lte: periodTo },
                order: { isDeleted: false },
            },
            select: {
                id: true,
                amount: true,
                date: true,
                order: { select: { client: { select: { name: true } } } },
            },
            orderBy: { date: 'asc' },
        });

        const items = payments.map(p => ({
            id: p.id,
            amount: p.amount || 0,
            date: p.date,
            client: p.order?.client?.name || 'Cliente',
        }));

        return {
            periodFrom,
            periodTo,
            total: items.reduce((sum, p) => sum + p.amount, 0),
            payments: items,
            // Si ya hay una rendición esperando confirmación, no se abre otra
            pendingHandover,
        };
    },

    /** El vendedor registra la entrega de efectivo (queda PENDING hasta que la encargada confirme). */
    async createHandover(actor: Actor, declaredAmount: number, notes?: string) {
        if (!actor.id) throw new Error('No se pudo identificar al vendedor.');

        const pending = await this.getVendorPendingCash(actor.id);
        if (pending.pendingHandover) {
            throw new Error('Ya tenés una rendición esperando confirmación de la encargada. Esperá a que la confirme antes de registrar otra.');
        }
        if (pending.payments.length === 0) {
            throw new Error('No tenés cobros en efectivo pendientes de rendición en este período.');
        }
        if (!declaredAmount || declaredAmount <= 0) {
            throw new Error('El monto a entregar debe ser mayor a cero.');
        }

        const handover = await prisma.cashHandover.create({
            data: {
                vendorId: actor.id,
                vendorName: actor.name,
                expectedAmount: pending.total,
                declaredAmount,
                periodFrom: pending.periodFrom,
                periodTo: pending.periodTo,
                payments: pending.payments as any,
                notes: notes?.trim() || null,
            },
        });

        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'CASH_HANDOVER',
            entityId: handover.id,
            details: { expectedAmount: pending.total, declaredAmount, payments: pending.payments.length },
        }).catch(console.error);

        return handover;
    },

    /** La encargada/ADMIN cuenta el efectivo recibido y confirma la rendición. */
    async confirmHandover(id: string, countedAmount: number, actor: Actor, notes?: string) {
        const handover = await prisma.cashHandover.findUnique({ where: { id } });
        if (!handover) throw new Error('Rendición no encontrada.');
        if (handover.status !== 'PENDING') throw new Error('Esta rendición ya fue confirmada.');
        if (handover.vendorId === actor.id) throw new Error('La rendición la tiene que confirmar otra persona (encargada de caja o admin), no quien entrega.');
        if (countedAmount == null || countedAmount < 0) throw new Error('Ingresá el monto contado.');

        const difference = countedAmount - handover.expectedAmount;

        const updated = await prisma.cashHandover.update({
            where: { id },
            data: {
                status: 'CONFIRMED',
                countedAmount,
                difference,
                confirmedById: actor.id,
                confirmedByName: actor.name,
                confirmedAt: new Date(),
                ...(notes?.trim() ? { notes: [handover.notes, `Recepción: ${notes.trim()}`].filter(Boolean).join('\n') } : {}),
            },
        });

        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'STATUS_CHANGE',
            entityType: 'CASH_HANDOVER',
            entityId: id,
            details: { vendor: handover.vendorName, expectedAmount: handover.expectedAmount, countedAmount, difference },
        });

        // Diferencia ≠ 0 → aviso inmediato a administración
        if (Math.round(difference) !== 0) {
            sendEmail({
                to: ADMIN_EMAIL,
                subject: `⚠️ Rendición de ${handover.vendorName} con diferencia de $${Math.abs(Math.round(difference)).toLocaleString('es-AR')}`,
                text: `Se confirmó una rendición de efectivo CON DIFERENCIA:\n\n` +
                    `Vendedor: ${handover.vendorName}\n` +
                    `Según sistema: $${Math.round(handover.expectedAmount).toLocaleString('es-AR')}\n` +
                    `Declarado por el vendedor: $${Math.round(handover.declaredAmount).toLocaleString('es-AR')}\n` +
                    `Contado al recibir: $${Math.round(countedAmount).toLocaleString('es-AR')}\n` +
                    `Diferencia (contado − sistema): $${Math.round(difference).toLocaleString('es-AR')}\n\n` +
                    `Confirmó: ${actor.name}\n` +
                    `Período: ${handover.periodFrom.toLocaleString('es-AR')} → ${handover.periodTo.toLocaleString('es-AR')}\n` +
                    `Cobros incluidos: ${(handover.payments as any[])?.length ?? 0}`,
            }).catch(e => console.error('Error enviando email de diferencia en rendición:', e));
        }

        return updated;
    },

    async listHandovers(vendorId?: string) {
        return prisma.cashHandover.findMany({
            where: vendorId ? { vendorId } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    },

    /** Arqueo: conteo físico del efectivo en caja vs. saldo teórico del sistema. */
    async createCashCount(actor: Actor, countedAmount: number, notes?: string) {
        if (countedAmount == null || countedAmount < 0) throw new Error('Ingresá el monto contado.');

        const lastCount = await prisma.cashCount.findFirst({
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });
        const periodFrom = lastCount?.createdAt || new Date(RENDICION_CUTOFF_ISO);
        const periodTo = new Date();

        const balance = await this.getCashBalance();

        // Resumen del período para auditar diferencias sin revolver toda la caja
        const [periodPayments, periodIn, periodOut, movementsCount] = await Promise.all([
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { method: { in: CASH_METHODS }, date: { gt: periodFrom, lte: periodTo }, order: { isDeleted: false } },
            }),
            prisma.cashMovement.aggregate({
                _sum: { amount: true },
                where: { type: 'IN', createdAt: { gt: periodFrom, lte: periodTo } },
            }),
            prisma.cashMovement.aggregate({
                _sum: { amount: true },
                where: { type: 'OUT', createdAt: { gt: periodFrom, lte: periodTo } },
            }),
            prisma.cashMovement.count({ where: { createdAt: { gt: periodFrom, lte: periodTo } } }),
        ]);

        const difference = countedAmount - balance.total;

        const count = await prisma.cashCount.create({
            data: {
                theoreticalTotal: balance.total,
                countedAmount,
                difference,
                periodFrom,
                periodTo,
                summary: {
                    paymentsTotal: periodPayments._sum.amount || 0,
                    manualIn: periodIn._sum.amount || 0,
                    manualOut: periodOut._sum.amount || 0,
                    movementsCount,
                } as any,
                notes: notes?.trim() || null,
                closedById: actor.id,
                closedByName: actor.name,
            },
        });

        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'CASH_COUNT',
            entityId: count.id,
            details: { theoreticalTotal: balance.total, countedAmount, difference },
        });

        if (Math.round(difference) !== 0) {
            sendEmail({
                to: ADMIN_EMAIL,
                subject: `⚠️ Arqueo de caja con diferencia de $${Math.abs(Math.round(difference)).toLocaleString('es-AR')}`,
                text: `Se cerró un arqueo de caja CON DIFERENCIA:\n\n` +
                    `Saldo teórico: $${Math.round(balance.total).toLocaleString('es-AR')}\n` +
                    `Efectivo contado: $${Math.round(countedAmount).toLocaleString('es-AR')}\n` +
                    `Diferencia (contado − teórico): $${Math.round(difference).toLocaleString('es-AR')}\n\n` +
                    `Cerró: ${actor.name}\n` +
                    `Período: ${periodFrom.toLocaleString('es-AR')} → ${periodTo.toLocaleString('es-AR')}`,
            }).catch(e => console.error('Error enviando email de diferencia en arqueo:', e));
        }

        return count;
    },

    async listCashCounts() {
        return prisma.cashCount.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
};
