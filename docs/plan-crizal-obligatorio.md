# Plan: el Crizal como dato — costeo al más caro y elección obligatoria

Decisión de Ishtar, 26/8/2026. Tres reglas nuevas del negocio:

1. **El costo de todo cristal con Crizal se calcula con el MÁS CARO de su
   renglón** (hoy: Prevencia). Se cobra siempre el más caro: si el par sale con
   uno más barato, el margen solo puede mejorar — nunca queda corto.
2. **Al vender, informar QUÉ Crizal lleva es obligatorio** — igual que hoy se
   elige el tono de teñido o el fotocromático. Nada va a fábrica sin ese dato.
3. **Cada Crizal lleva una descripción breve** para que el vendedor sepa qué
   está eligiendo (y pueda explicárselo al cliente).

Por qué esto es lo robusto y no un parche: hoy la plata depende de lo que diga
el NOMBRE del producto ("+ CRIZAL" sin aclarar cuál) — 44 de 82 productos
quedaron imposibles de costear por eso. Con estas reglas, el nombre deja de
decidir plata: el costo sale de una política fija y el Crizal real es un dato
de la venta, elegido por un humano, congelado en el snapshot.

---

## Fase 0 — Costeo al Crizal más caro (desbloquea producción) ✅ HECHA

- `emparejador.mjs`: para todo renglón con columnas Crizal, el costo usa la
  **más cara** (`de: 'crizal más caro (política 26/8/2026)'`). Excepciones que
  se respetan por nombre: "SIN AR" / "Sin Crizal" (van pelados) y "Trío".
- Los 44 "sin confirmar" desaparecen: ya no hay nada que confirmar.
- Lentes de stock de la página 22 (Rock / Sapphire HR / Prevencia de stock):
  renglón textual propio — el Crizal ya viene incluido, no se suma nada.
- Auditoría: sección H nueva que verifica la política en cada emparejado.

## Fase 1 — El Crizal como dato obligatorio de la venta

**1a. El catálogo** — `src/lib/constants/crizal.ts` (patrón `tenido.ts`):
```ts
export const CRIZALES = [
  { code: 'CRIZAL_PREVENCIA', nombre: 'Crizal Prevencia',
    detalle: 'Antirreflejo + filtro de luz azul-violeta. El más completo.' },
  { code: 'CRIZAL_SAPPHIRE', nombre: 'Crizal Sapphire',
    detalle: 'El antirreflejo más transparente (multiángulo).' },
  { code: 'CRIZAL_FORTE_UV', nombre: 'Crizal Forte UV',
    detalle: 'El estándar: antirreflejo resistente + protección UV.' },
  { code: 'SIN_AR', nombre: 'Sin antirreflejo', detalle: 'Lente sin tratamiento.' },
];
```
Un solo módulo alimenta selector, validación, costeo y descripciones.
El Trío Easy Clean NO se ofrece (no es Crizal, no se usa). Y en un 2x1 las
opciones sin Crizal no valen: la promo es siempre con Crizal. Lista
nueva del lab = editar el JSON; Crizal nuevo = una línea acá.

**1b. El dato** — campo `labCrizal String?` en `Order` (mismo patrón que
`labColor` / `labTreatment`). Migración commiteada, nada a mano.

**1c. La pantalla** — selector en el flujo de procesado (`OrderDetailPanel`,
donde hoy se elige el color), visible cuando la venta lleva cristales con
antirreflejo. Cada opción con su `detalle` a la vista. Obligatorio: sin
elección no se puede enviar a fábrica.

**1d. El candado del server** — la validación vive en el service (no solo en el
form): enviar a fábrica una venta con cristales Crizal sin `labCrizal` → error
claro. Igual que el guard de costos $0.

**1e. Test** — `check:crizal-obligatorio`: venta con cristal Crizal no viaja
sin el dato; venta de armazón solo no lo exige; el snapshot lo congela.

## Fase 2 — Cerrar el círculo con las facturas

- El cruce de facturas usa el `labCrizal` informado para el veredicto fino:
  si se cobró Prevencia y la factura vino Forte UV, esa diferencia es MARGEN
  GANADO y tiene que verse como tal en el reporte, no como "sobrecosto negativo".
- Reporte mensual: cuánto margen extra dejó la política del más caro.

## Orden de ejecución
1. ~~Fase 0~~ hecha → re-ensayo → **aplicar costos en producción** (la corre Ishtar).
2. Fase 1 completa en `desarrollo`, con test, se prueba en local → merge con OK.
3. Fase 2 después de un par de semanas de datos de `labCrizal` reales.
