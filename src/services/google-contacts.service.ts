import { fetchWa } from '@/lib/wa-config';

export class GoogleContactsService {
    /**
     * Envía una vCard por WhatsApp al propio celular del local
     * para que puedan agendar al cliente con 1 toque.
     */
    public static async syncClient(clientData: { name: string; phone?: string | null; email?: string | null }) {
        try {
            // 1. Obtener el número del bot conectado
            const statusRes = await fetchWa('/api/status');
            if (!statusRes.ok) return;
            const status = await statusRes.json();
            
            if (!status.isReady && !status.connectedPhone) {
                console.log('[ContactSync] WhatsApp no está conectado. Omitiendo envío de vCard.');
                return;
            }

            const botPhone = status.connectedPhone || status.phone;
            if (!botPhone) return;

            const waId = `${botPhone}@c.us`;

            // 2. Generar el string VCard
            const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Cliente ${clientData.name}
${clientData.phone ? `TEL;type=CELL;waid=${clientData.phone.replace(/[^0-9]/g, '')}:+${clientData.phone.replace(/[^0-9]/g, '')}` : ''}
${clientData.email ? `EMAIL:${clientData.email}` : ''}
END:VCARD`;

            const base64Vcard = Buffer.from(vcard).toString('base64');

            // 3. Enviar a sí mismo
            await fetchWa('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: waId,
                    message: `📌 Nuevo Cliente en CRM: *${clientData.name}*\nAbre el archivo adjunto (.vcf) para guardarlo en tus contactos.`,
                })
            });

            // Enviar el archivo VCF separado
            await fetchWa('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: waId,
                    message: '',
                    media: {
                        base64: base64Vcard,
                        mimetype: 'text/x-vcard',
                        filename: `Contacto_${clientData.name.replace(/[^a-zA-Z0-9]/g, '_')}.vcf`
                    },
                    senderName: 'CRM Automático'
                })
            });

            console.log(`[ContactSync] vCard enviada exitosamente a ${waId}`);
        } catch (error) {
            console.error('[ContactSync] Error enviando vCard:', error);
        }
    }
}
