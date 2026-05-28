import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';

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
    }
};
