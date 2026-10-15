"use client";

import { useEffect, useState } from "react";
import { descuentoTransferenciaDe } from "@/lib/catalog/rango-precio";
import { leerPromoCuotas } from "@/lib/promo-cuotas";

/**
 * ¿Está prendido el 2x1 de armazones de la tienda?
 *
 * Para componentes de CLIENTE que no pueden leer los settings (el carrito, que
 * vive en el layout). Las páginas de servidor leen `getWebSettings()` directo y
 * no necesitan esto.
 *
 * Arranca en `false` y no en "cargando": si la respuesta tarda o falla, lo que
 * se ve es la tienda sin promo, que siempre es cierto. Al revés —asumir que
 * está prendida— mostraría un 2x1 que el checkout no va a aplicar.
 */
export interface Promo2x1Web {
    /** La promo está prendida Y hay armazones marcados. */
    activa: boolean;
    /** Ids de los armazones que entran. Vacío = ninguno. */
    ids: Set<string>;
    /**
     * Las condiciones de pago de /admin/web, para mostrar (las cobra el
     * checkout contra la base). Llegan en la misma respuesta; hasta que llega,
     * los defaults de la tienda (15 % y 6 cuotas).
     */
    descuentoTransferenciaPct: number;
    cuotasSinInteres: number;
}

export function usePromo2x1(): Promo2x1Web {
    const [activa, setActiva] = useState(false);
    const [ids, setIds] = useState<Set<string>>(() => new Set());
    const [descuentoTransferenciaPct, setDescuento] = useState(() => descuentoTransferenciaDe(null));
    const [cuotasSinInteres, setCuotas] = useState(() => leerPromoCuotas(null).cantidad);

    useEffect(() => {
        let vivo = true;
        fetch("/api/store/promos")
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                if (!vivo || !d) return;
                setActiva(d.dosPorUnoArmazones === true);
                setIds(new Set(Array.isArray(d.armazones2x1) ? d.armazones2x1 : []));
                if (Number(d.descuentoTransferencia) > 0) setDescuento(Number(d.descuentoTransferencia));
                if (Number(d.cuotasSinInteres) > 0) setCuotas(Number(d.cuotasSinInteres));
            })
            .catch(() => { /* sin promo: el default ya es false */ });
        return () => { vivo = false; };
    }, []);

    return { activa, ids, descuentoTransferenciaPct, cuotasSinInteres };
}
