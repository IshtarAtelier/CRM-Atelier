import { prisma } from '@/lib/db';
import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'pisano.ishtar@gmail.com';
const CASH_ALERT_THRESHOLD = 300000;

export const CashService = {
    /**
     * Calcula el saldo total en efectivo.
     * Saldo = (Pagos en Efectivo) + (Entradas manuales) - (Salidas manuales)
     */
    async getCashBalance() {
        // 1. Sumar todos los pagos registrados como EFECTIVO o CASH
        const payments = await prisma.payment.aggregate({
            where: { 
                method: { in: ['EFECTIVO', 'CASH'] }
            },
            _sum: { amount: true },
        });

        // 2. Sumar entradas y restar salidas de movimientos manuales
        const movements = await (prisma as any).cashMovement.findMany();
        
        const manualBalance = (movements as any[]).reduce((acc: number, mov: any) => {
            return mov.type === 'IN' ? acc + mov.amount : acc - mov.amount;
        }, 0);

        const totalCash = (payments._sum.amount || 0) + manualBalance;

        return {
            total: totalCash,
            paymentsTotal: payments._sum.amount || 0,
            manualBalance: manualBalance,
            movements: (movements as any[]).sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 50),
        };
    },

    /**
     * Registra un nuevo movimiento de caja (entrada o salida).
     */
    async registerMovement(params: { type: 'IN' | 'OUT', amount: number, reason: string, userId: string, receiptUrl?: string }) {
        const { type, amount, reason, userId, receiptUrl } = params;

        const movement = await (prisma as any).cashMovement.create({
            data: { type, amount, reason, userId, receiptUrl },
            include: { user: true }
        });

        // Notificar por email si es una salida
        if (type === 'OUT') {
            await this.sendEmail(
                '🚨 Salida de Efectivo Registrada',
                `Se ha registrado una salida de efectivo:\n\n` +
                `Monto: $${amount.toLocaleString('es-AR')}\n` +
                `Motivo: ${reason}\n` +
                `Registrado por: ${movement.user.name}\n` +
                `Fecha: ${movement.createdAt.toLocaleString('es-AR')}`
            );

            // También registrar en notificaciones de la DB
            await prisma.notification.create({
                data: {
                    type: 'CASH_OUTFLOW',
                    message: `Salida de efectivo: $${amount.toLocaleString('es-AR')} por ${reason}`,
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
     * Verifica el saldo actual y envía una alerta si supera el umbral.
     */
    async checkBalanceAndAlert() {
        const balance = await this.getCashBalance();
        if (balance.total > CASH_ALERT_THRESHOLD) {
            await this.sendEmail(
                '⚠️ Alerta: Saldo de Caja Elevado',
                `El saldo de efectivo en caja ha superado los $${CASH_ALERT_THRESHOLD.toLocaleString('es-AR')}.\n\n` +
                `Saldo actual: $${balance.total.toLocaleString('es-AR')}\n\n` +
                `Se recomienda realizar un retiro parcial.`
            );

            // También registrar en notificaciones de la DB
            await prisma.notification.create({
                data: {
                    type: 'HIGH_CASH_BALANCE',
                    message: `Alerta: Saldo de caja elevado ($${balance.total.toLocaleString('es-AR')})`,
                    requestedBy: 'SYSTEM',
                    status: 'PENDING'
                }
            });
        }
    },

    /**
     * Envía un email usando nodemailer.
     */
    async sendEmail(subject: string, text: string) {
        try {
            // Configuración de transporte (usar variables de entorno)
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            await transporter.sendMail({
                from: `"Atelier Óptica" <${process.env.SMTP_USER || 'no-reply@atelieroptica.com'}>`,
                to: ADMIN_EMAIL,
                subject: subject,
                text: text,
            });

            console.log(`Email enviado con éxito: ${subject}`);
        } catch (error) {
            console.error('Error enviando email:', error);
            // No lanzamos error para no bloquear el flujo principal si falla el email
        }
    }
};
