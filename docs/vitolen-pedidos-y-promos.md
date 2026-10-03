# Vitolen: cómo se carga un pedido y qué promos rigen

Escrito el 30/9/2026 a partir del material que mandó Vitolen: el video
"Carga de pedidos VITOLEN" (82 s), las bases de las promociones (imágenes) y
la pieza de mostrador "+amplitude" (`vitolen.pdf`, lista LB96).

## El portal

- Producción: `gestion.vitolen.com` (usuario y clave los tiene Ishtar; no se
  guardan en el repo ni en ningún archivo).
- En el video aparece `test.vitolen.com`, que es el entorno de prueba del
  laboratorio; el nuestro es el de gestión.
- **Los pedidos los carga la óptica en el portal, con las medidas del
  armazón.** Es requisito de todas las promociones: un pedido pasado por
  WhatsApp o mail no entra en promo.

## Carga de un pedido (ejemplo de un progresivo, según el video)

1. **Pedido de Laboratorio → Cliente**: queda nuestra cuenta. Opcional:
   "Nro de Caso Interno" — poner el **número de venta del CRM** para que
   después el pedido se pueda cruzar con la venta.
2. **Receta**: elegir *Ambos ojos / OD / OI* y el tipo: *Monofocal, Bifocal,
   Ocupacional o Progresivo*.
3. **Diseño**: aparecen los logos. Los nuestros: **Array 2, Array Wrap,
   Summit Premium, Argos BKS, iD LifeStyle 4** (Hoya) y los Pentax. También
   figuran las marcas propias de Vitolen (Amplitude Freestyle / Plus / View /
   Classic / First, EVO Lens, Sedna, Vitfull, Explorer, Mi Primer Sedna): no
   están cargadas en nuestro sistema, ver abajo.
4. **Índices y materiales**: un buscador por ojo (OD y OI); se escribe el
   material o el código de producto. Los códigos de Hoya están en la lista
   L96 (`scripts/maintenance/precios-vitolen/hoya-pentax-L96-sep-2026.json`,
   campo `codigos`).
5. **Campo preferente** (solo algunos diseños): *Balanceado / Lejos /
   Intermedio / Cerca*. Para iD LifeStyle 4 es la elección Urban / Indoor /
   Outdoor.
6. **Origen** del cristal: "Bloque / Lente de Vitolen".
7. **Graduación**: esférico, cilíndrico, eje (1 a 180), adición, base
   especial (0 a 16), lenticular sí/no.
8. **Pedido origen / Promos disponibles**: acá se engancha el segundo par de
   una promo con el pedido del primer par. El portal muestra las promos que
   aplican (en el video: "Promo SEGURO DE REPOSICIÓN 24…").
9. **Armazón**: elegir la **forma** más parecida (Forma 1 a 12), y cargar
   **DNP-L** (20 a 80), **altura pupilar de lejos** (14 a 50), distancia de
   vértice (10 a 20), ángulo pantoscópico (0 a 30), y del aro: largo, alto,
   diagonal mayor (30 a 90), eje, puente. Tipo de armazón (metálico, etc.),
   funcionalidad (receta) y características ("marca, modelo, color").
   Hay un botón "¿Cómo tomar las medidas?" con el esquema.
10. **Trabajos disponibles**: *Tratamientos* (Spectrum Sky+ y Spectrum Elite+
    figuran como "recomendado"; Titanlak; tratamiento de bordes) y
    *Montajes*: **dejar tildado "Calibrado"** (el video insiste). Otros
    montajes: formas especiales, reemplazo de bisagra / plaqueta / tanza /
    tornillo, soldadura.
11. **Observaciones**, botón **Crear**, revisar el resumen (receta, armazón,
    forma, trabajos) y **Confirmar**.

## Las promociones vigentes (30/9/2026)

### Hoya y Pentax: segundo par al 20 % de lista ("Ampliá tu visión")

Comprando un par de progresivos Hoya **iD LifeStyle 4, Array 2, Summit
Premium o Argos BKS** (o Pentax Allfocus) en cualquier material, con AR Ultra
Hi-Vision o Spectrum Sky, el **segundo par del mismo diseño y graduación se
paga al 20 % del precio de lista base** de lente + tratamiento. Puede ser el
mismo diseño de igual o menor valor, o un ocupacional Tact; el segundo par
puede ser de un material de menor valor.

- Plazo para pedir el segundo par: **60 días**.
- El primer par siempre con AR; en el segundo el AR es opcional.
- Solo pares (no un ojo). Pedidos cargados en el portal con medidas.
- Garantías: **garantía total 60 días** en los dos pares, AR Premium 18
  meses, y **seguro de reposición 24 meses solo en el primer par**.
- No acumulable con otras promos. Mi Primer Hoya no participa.

**No es "segundo par gratis"**, aunque la lista de precios diga "llevate otro
de regalo": el laboratorio factura el 20 %. Vitolen sugiere sumar ese costo al
primer par y ofrecerlo al cliente como "Llevate 2, pagá 1".

**Cómo lo aplica el CRM (desde el 3/10/2026, decisión de Ishtar):** la regla
vive en `src/lib/promo-segundo-par-hoya.ts` y la usa `PricingService`
(cotizador, ficha y API de ventas, un solo cálculo). Cuando la venta tiene un
primer par de progresivo Hoya (LifeStyle 4, Array 2, Summit, Argos) o Pentax
Allfocus y un segundo par del mismo diseño de igual o menor valor (o un Tact),
el cliente recibe `DESCUENTO_SEGUNDO_PAR_HOYA` (80 %) sobre el 2º par. Los
renglones quedan a precio de lista; el descuento va al total y se guarda en
`appliedPromoDiscount` (como el armazón del 2x1). Qué par es cada uno lo
dice el armazón asignado; sin asignar, los pares se arman en orden. Mi
Primer Hoya no participa; un solo 2º par por venta. Lo fija
`npm run check:promo-hoya`. En el cruce de costos el 2º par se cuenta entero
(lo facturado al 20 % + calibrado queda "a favor", nunca un reclamo falso).

### Amplitude (marca propia de Vitolen): mismo esquema

Progresivos Amplitude Freestyle IA / Plus / View / Classic con AR Spectrum:
segundo par al 20 % de lista, 60 días, mismas garantías. La pieza de mostrador
`vitolen.pdf` (lista LB96) trae combinaciones de primer + segundo par con
precio final al público sugerido por Vitolen.

### Sunmatic x2 (fotocromático de Amplitude): 50 % en el segundo par

Con la compra de un par Sunmatic con AR, el sistema manda un **código de 50 %
de descuento** (por mail y por la campanita del portal, dentro de las 24 h)
para otro par Sunmatic, con igual o distinta graduación, mismo tipo (stock con
stock, laboratorio con laboratorio). Vigencia del código: 30 días.
**Promo válida hasta el 31/10/2026.** No acumulable con las otras.

## Qué significa para nuestro sistema

1. **El 2x1 del CRM no sirve tal cual para Hoya.** El sistema asume que el
   segundo par cuesta $0 (así lo hacen Optovisión y Grupo Óptico) y el cruce
   acusa sobrecosto si el lab factura más de `TOPE_PAR_BONIFICADO_2X1`
   ($30.000). Con Hoya, el segundo par se factura al 20 % de lista, más el
   calibrado: para un Array 2 1.50 Blue Filter son unos $85.600 + calibrado.
   Antes de vender Hoya como "Llevate 2, pagá 1" hay que decidir cómo se
   modela: un costo de par bonificado por laboratorio (o por producto) y un
   precio del primer par que absorba ese 20 %. Es un cambio de reglas de
   negocio, no un tilde.
2. **Amplitude, Sedna, EVO, Vitfull, Explorer no están en el sistema.** Solo
   se cargó la lista L96 de Hoya y Pentax. Para venderlos hace falta la lista
   de precios LB96 completa (la pieza de mostrador solo trae combos).
3. **El número de venta del CRM va en "Nro de Caso Interno"** del portal. Es
   lo único que después permite cruzar la factura de Vitolen con la venta,
   porque el cruce automático (`lab-recon`) todavía no conoce a Vitolen.
4. **Garantía total de 60 días**: Vitolen la da sobre los dos pares. Sirve
   para decidir si los multifocales Hoya llevan la garantía de adaptación de
   Atelier (hoy el sistema se la da a todo `Cristal Multifocal`, y el texto
   público habla de Varilux).
