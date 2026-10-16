# Legales de la tienda online: borrador para revisar con el abogado

**Estado:** BORRADOR. Nada de esto está publicado en el sitio. Lo arma la auditoría
de la tienda del 25/9/2026 (confirmada el 28/9 en producción) para que Ishtar y
el abogado decidan. **No es asesoramiento legal.** Cada punto dice qué dice hoy
el sitio, qué encontró la auditoría y qué hay que decidir.

La rama `feat/boton-arrepentimiento` ya agrega, sin tocar ninguna política:

- La página `/arrepentimiento` con el formulario y el código de trámite.
- El link "Botón de arrepentimiento" en el pie de todo el sitio, incluido el checkout.
- El link a la Ventanilla Federal Única de reclamos.
- El lugar para razón social, CUIT y Data Fiscal. Esos datos están vacíos hasta
  que Ishtar los pase.

---

## 1. Datos que tiene que pasar Ishtar (sin esto no se pueden mostrar)

Se cargan en `BUSINESS_INFO` (`src/lib/business-info.ts`), campos
`razonSocial`, `cuit` y `dataFiscalUrl`. Mientras estén vacíos, el pie no
muestra la línea.

| Dato | Dónde se consigue | Nota |
| --- | --- | --- |
| Razón social | Constancia de inscripción en ARCA | En monotributo es el nombre y apellido del titular. |
| CUIT | Constancia de inscripción en ARCA | En el sistema hay CUIT de Ishtar y de Yani: tiene que ser el de quien factura la tienda. |
| Link del QR de Data Fiscal | ARCA → formulario 960/D ("Data Fiscal") | Hoy el pie decía "Comprobante AFIP Data Fiscal" como texto, sin QR ni link. La rama lo saca hasta tener el link real. |

---

## 2. Texto de la página `/arrepentimiento` (confirmar antes del deploy)

La página dice hoy, en la rama:

> Tenés 10 días corridos contados desde que recibiste el producto o desde la
> compra, lo que haya pasado último (art. 34 de la Ley 24.240 de Defensa del
> Consumidor).

> Al enviar el formulario te mostramos un código de trámite. Guardalo: es tu
> constancia. Después te contactamos para coordinar la devolución.

Y el mail al cliente, que sale solo si su email coincide con el del pedido:

> Te vamos a contactar para coordinar la devolución.

**A confirmar:**

- Si el texto alcanza para lo que pide la Disp. 954/2025, que reemplazó a la Res. SCI 424/2020.
- Si el código hay que mandarlo también por otro medio, o si alcanza con mostrarlo
  en pantalla y mandarlo por mail cuando el email coincide.

---

## 3. Anteojos con cristales hechos a medida

**Hoy:** la política de cambios dice que los recetados no tienen cambio.

**Para decidir:** el art. 1116 del Código Civil y Comercial excluye del derecho de
revocación a los bienes "confeccionados conforme a las especificaciones
suministradas por el consumidor". Hay que decidir si los cristales con receta
entran ahí, qué pasa con el armazón de ese mismo pedido, y cómo decirlo en la
ficha y en el checkout **antes** de pagar.

---

## 4. Quién paga el envío de la devolución

**Hoy:** `/politicas-de-cambio` dice que el envío de vuelta "corre por cuenta del cliente".

**Lo que marcó la auditoría:** el art. 1115 del Código Civil y Comercial dice que
ejercer la revocación no puede generarle costos al consumidor. Si aplica, el
envío de vuelta de un arrepentimiento lo paga la óptica.

**Para decidir:** redacción nueva de ese párrafo.

---

## 5. Garantía legal

**Hoy:** el sitio solo menciona la garantía de adaptación, que es comercial y
solo para Varilux y Super Blue.

**Lo que marcó la auditoría:** el art. 11 de la Ley 24.240 fija una garantía
legal mínima de 6 meses para bienes nuevos. No aparece en ninguna página.

**Para decidir:** si se agrega a la política de cambios, y cómo se distingue de la
garantía de adaptación.

---

## 6. Otros puntos de la auditoría para la misma revisión

- **Plazos de entrega:** hay 4 versiones distintas para un trabajo con receta
  (T&C 5 a 7 días hábiles, ficha y checkout 5, /urgencias 10 a 15 para
  multifocales, FAQ sin número). Conviene una sola.
- **2x1:** `/promo` y el configurador lo prometen y no hay bases y condiciones publicadas.
- **12 cuotas:** la auditoría preguntó si hace falta mostrar TEA y CFT en el plan
  de 12 (Res. 51-E/2017, en parte derogada en 2024; Mercado Pago lo sigue pidiendo
  en su guía para Argentina).
- **Política de privacidad:**
  - No menciona cookies ni los píxeles de Meta y Google.
  - Nombra a Payway como procesador, y hoy se cobra por Mercado Pago.
  - No tiene la leyenda de la Disp. DNPDP 10/2008.
  - Promete borrar datos en 10 días hábiles, y la auditoría marcó que la ley pide 5.
- **T&C:** dicen que las 3 y 6 cuotas son "provistas por Payway". Hoy es Mercado Pago.

---

## Fuentes que citó la auditoría

- Disp. 954/2025 (botón de arrepentimiento):
  https://nicholsonycano.com.ar/alertas-legales/disposicion-ministerio-de-economia-954-2025-nueva-reglamentacion-sobre-boton-de-arrepentimiento-y-boton-de-baja-de-servicio/
- Ventanilla Federal Única (Disp. 890/2025), página oficial:
  https://www.argentina.gob.ar/justicia/derechofacil/leysimple/ventanilla-unica-federal-de-reclamos-de-defensa-del-consumidor
- Formulario de reclamos que enlaza el pie: https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario
- Data Fiscal (ARCA, F. 960/D): https://www.afip.gob.ar/960/
- Código Civil y Comercial, art. 1115: https://leyfacil.com.ar/codigo-civil-y-comercial/articulo-1115/
- Ley 24.240, art. 11: https://leyes-ar.com/ley_de_defensa_del_consumidor/11.htm
