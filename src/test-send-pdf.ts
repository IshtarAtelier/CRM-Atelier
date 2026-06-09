import * as fs from 'fs';
import { fetchWa } from './lib/wa-config';

async function run() {
    try {
        const file = fs.readFileSync('Recibo_X_5NHW_2026-06-04_Vanessa-Scorrani.pdf');
        const base64 = file.toString('base64');
        
        console.log('Enviando...');
        const res = await fetchWa('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: '5493541215971@c.us',
                message: 'Hola Ishtar, aquí tienes el RECIBO DE PAGO que acabamos de generar:',
                senderName: 'Sistema Atelier',
                media: {
                    base64,
                    mimetype: 'application/pdf',
                    filename: 'Recibo_Prueba.pdf'
                }
            }),
        });

        if (res.ok) {
            console.log('¡Enviado!');
        } else {
            console.error('Error:', await res.text());
        }
    } catch (e) {
        console.error(e);
    }
}
run();
