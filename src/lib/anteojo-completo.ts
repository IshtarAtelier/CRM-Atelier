/**
 * "Anteojo completo desde $X" — UN solo lugar para la tarjeta de /tienda y la
 * ficha del armazón de receta.
 *
 * Por qué existe (auditoría del 25/9/2026): el 95,5% de la plata del negocio
 * viene de ventas con cristales, pero en la web el precio de los cristales
 * aparecía recién adentro del configurador. 519 chats en 90 días preguntaban
 * cuánto sale. La tarjeta y la ficha muestran el armazón solo, y el cliente de
 * receta no tenía cómo saber cuánto le sale el anteojo que de verdad compra.
 *
 * Reglas:
 * - Solo donde se ofrecen cristales: categoría web "Receta" y fuera del canal
 *   mayorista (la misma condición que muestra "Elegir mis cristales" en la ficha).
 * - El cristal base es `CRISTAL_BASE_ANTEOJO_COMPLETO` y su precio sale del
 *   producto vinculado a esa opción (GET /api/web/pricing). El cálculo es el de
 *   `PricingService.anteojoCompletoDesde`, así el "desde" coincide con el total
 *   del configurador al elegir ese cristal.
 * - Sin opciones de cristal (la base no respondió) o con el cristal no
 *   disponible, devuelve null y la pantalla no muestra nada: nunca un precio
 *   inventado.
 */
import { CRISTAL_BASE_ANTEOJO_COMPLETO } from '@/lib/constants/anteojo-completo';
import { describirConfiguracion, type LensConfig, type MapaOpciones } from '@/lib/cristales-web/claves';
import { precioFinal, type ProductoConPrecio } from '@/lib/precio-oferta';
import { PricingService } from '@/services/PricingService';

export interface AnteojoCompletoDesde {
    /** Armazón (con oferta si la hay) + cristal base, precio de lista. */
    lista: number;
    /** Lo mismo, pagando por transferencia. */
    transferencia: number;
    /** El cristal incluido, en la frase de carrito y mails: "Monofocal · Antirreflex (Evita Brillos)". */
    cristal: string;
}

/** La configuración del configurador que corresponde al cristal base. */
export function configCristalBase(): LensConfig {
    const [lensType, treatment] = CRISTAL_BASE_ANTEOJO_COMPLETO.split('.') as ['MONOFOCAL' | 'MULTIFOCAL', string];
    return { lensType, treatment, color: null, prescriptionFile: null };
}

/** ¿Esta ficha o tarjeta ofrece cristales? Misma condición que el botón "Elegir mis cristales". */
export function ofreceAnteojoCompleto(categoriaWeb: string | null | undefined, esMayorista: boolean): boolean {
    return categoriaWeb === 'Receta' && !esMayorista;
}

export function anteojoCompletoDesde(args: {
    producto: ProductoConPrecio;
    /** Categoría web del producto ("Receta", "Sol", "Clip-On"). */
    categoriaWeb: string | null | undefined;
    esMayorista: boolean;
    /** Opciones de GET /api/web/pricing; null mientras cargan o si la base no respondió. */
    opciones: MapaOpciones | null;
    /** % de la promo por transferencia (setting web_promo_cash_discount). */
    descuentoTransferenciaPct: number;
}): AnteojoCompletoDesde | null {
    if (!ofreceAnteojoCompleto(args.categoriaWeb, args.esMayorista) || !args.opciones) return null;
    const lensConfig = configCristalBase();
    const precios = PricingService.anteojoCompletoDesde({
        precioArmazon: precioFinal(args.producto),
        lensConfig,
        opciones: args.opciones,
        descuentoTransferenciaPct: args.descuentoTransferenciaPct,
    });
    if (!precios) return null;
    return { ...precios, cristal: describirConfiguracion(lensConfig, args.opciones) };
}
