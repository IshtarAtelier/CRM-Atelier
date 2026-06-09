import { PrismaClient } from '@prisma/client';
import { generateReceiptPDF } from './lib/receipt-pdf-generator';
import { fetchWa } from './lib/wa-config';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('Buscando un pago reciente...');
        const payment = await prisma.payment.findFirst({
            orderBy: { date: 'desc' },
            include: {
                order: {
                    include: { client: true }
                }
            }
        });

        if (!payment || !payment.order || !payment.order.client) {
            console.error('No se encontró ningún pago con orden y cliente en la base de datos.');
            process.exit(1);
        }

        console.log(`Generando PDF para el pago ${payment.id} de $${payment.amount}...`);
        const { base64, filename } = await generateReceiptPDF(payment, payment.order, payment.order.client);

        console.log(`Enviando PDF (${filename}) al WhatsApp de Ishtar...`);
        const res = await fetchWa('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: '5493541215971@c.us',
                message: 'Hola Ishtar, aquí tienes el recibo PDF de prueba que solicitaste:',
                senderName: 'Sistema Atelier',
                media: {
                    base64,
                    mimetype: 'application/pdf',
                    filename
                }
            }),
        });

        if (res.ok) {
            console.log('¡PDF de prueba enviado exitosamente!');
        } else {
            console.error('Error al enviar el mensaje de prueba:', await res.text());
        }

    } catch (e) {
        console.error('Error general:', e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
