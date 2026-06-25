import 'dotenv/config';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { LabAuditService } from '../src/services/lab-audit.service';

const config = {
    imap: {
        user: process.env.IMAP_USER || 'pisano.ishtar@gmail.com',
        password: process.env.IMAP_PASSWORD || '', // App password goes here
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 3000
    }
};

async function main() {
    console.log("Iniciando auditoría de correos IMAP...");
    
    if (!config.imap.password) {
        console.error("No IMAP_PASSWORD provided. Por favor genera una Contraseña de Aplicación en Google.");
        return;
    }
    
    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');
        
        // Buscar correos de procesos@optovisionsa.com.ar que NO hayan sido leídos
        const searchCriteria = [
            'UNSEEN',
            ['FROM', 'procesos@optovisionsa.com.ar']
        ];
        
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT', ''],
            markSeen: true // Marcar como leídos una vez procesados
        };
        
        const messages = await connection.search(searchCriteria, fetchOptions);
        console.log(`Se encontraron ${messages.length} facturas nuevas de Optovision.`);
        
        for (const msg of messages) {
            // Find the full email body part to parse attachments
            const allPart = msg.parts.find((p: any) => p.which === '');
            if (!allPart) continue;
            
            const parsed = await simpleParser(allPart.body);
            
            if (parsed.attachments && parsed.attachments.length > 0) {
                for (const attachment of parsed.attachments) {
                    if (attachment.contentType === 'application/pdf') {
                        console.log(`Procesando adjunto: ${attachment.filename}`);
                        const pdfBuffer = attachment.content;
                        // Auditar el PDF
                        await LabAuditService.auditInvoice(pdfBuffer, attachment.filename || 'factura.pdf');
                    }
                }
            }
        }
        
        connection.end();
        console.log("Auditoría IMAP finalizada.");
        
    } catch (error) {
        console.error("Error al conectar a IMAP o procesar correos:", error);
    }
}

main().catch(console.error);
