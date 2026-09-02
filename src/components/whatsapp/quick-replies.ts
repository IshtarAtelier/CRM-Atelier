import { WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates';
import type { QuickReply } from './types';

// Respuestas rápidas predefinidas.
// Las que llevan `templateName` son plantillas oficiales aprobadas en Meta:
// su texto sale SIEMPRE del catálogo (src/lib/whatsapp/templates.ts) para que
// no diverja — antes estaban copiadas a mano y la de 12 cuotas quedó vieja —
// y al click se envían directo como plantilla (forceTemplate), nunca como
// texto libre: pegarlas al textarea hacía que, con la ventana de 24 h cerrada,
// el 409 truncara el texto a 60 caracteres como "tema" de retomar_conversacion
// y saliera un mensaje roto (pasó en vivo el 30/8).
export const QUICK_REPLIES: QuickReply[] = [
    { label: 'Saludo', text: '¡Hola! 👋 Bienvenido a Atelier Óptica. ¿En qué te puedo ayudar?' },
    { label: 'Receta', text: '¿Me podés compartir tu receta óptica para ayudarte mejor?' },
    { label: 'Turno', text: '¿Querés coordinar un turno para una consulta en el local? 📍' },
    { label: 'Dirección', text: '📍 Nos encontrás en José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba.\n\nTe dejo la ubicación para que llegues fácil 👉 https://g.co/kgs/5Jp7D4e' },
    { label: 'Horario', text: 'Atendemos de Lunes a Viernes de 9 a 20hs. Sábados de 9 a 17hs.\n\n📍 José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba.\n👉 https://g.co/kgs/5Jp7D4e\n\nCuándo te queda cómodo que te esperemos?' },
    { label: 'Listo para retirar', text: '🎉 ¡Tu pedido está listo para retirar!' },
    { label: 'Pago pendiente', text: 'Te recuerdo que quedó pendiente el saldo restante. ¿Cuándo te viene bien coordinar el pago?' },
    { label: 'Instagram', text: '¡Te invito a seguirnos en Instagram para ver todas nuestras novedades, promos y modelitos nuevos! 📸✨\n\n👉 https://www.instagram.com/atelieroptica_/\n\n¡Nos encontrás como @atelieroptica_!' },
    // Plantillas oficiales: el texto del chip es el body del catálogo (con sus
    // {{n}}); las variables se resuelven al click y se confirma antes de mandar.
    // No se incluyen las transaccionales (pedido_listo, factura, comprobante)
    // porque llevan datos de un pedido puntual que no tiene sentido tipear a mano.
    { label: '12 cuotas', templateName: 'promo_12_cuotas_v2', text: WHATSAPP_TEMPLATES.promo_12_cuotas_v2.body },
    { label: 'Seguimiento presupuesto', templateName: 'seguimiento_presupuesto', text: WHATSAPP_TEMPLATES.seguimiento_presupuesto.body },
    { label: 'Seguimiento lentes', templateName: 'seguimiento_lentes', text: WHATSAPP_TEMPLATES.seguimiento_lentes.body },
    { label: 'Seguimiento carrito', templateName: 'seguimiento_carrito', text: WHATSAPP_TEMPLATES.seguimiento_carrito.body },
    { label: 'Invitación al local', templateName: 'invitacion_local', text: WHATSAPP_TEMPLATES.invitacion_local.body },
    { label: 'Pedir reseña', templateName: 'pedido_resena', text: WHATSAPP_TEMPLATES.pedido_resena.body },
];
