# Pedido a Wave Publicidad — redirección del subdominio viejo

**Para:** Wave Publicidad (proveedor que administra `promo.atelieroptica.com.ar`)
**De:** Atelier Óptica
**Urgencia:** alta — el subdominio le manda clientes al WhatsApp equivocado y sale
arriba de la tienda real en Google cuando alguien busca la marca.

---

## Qué pedimos

Una **redirección 301 permanente** de **todo** `promo.atelieroptica.com.ar`
(cualquier ruta, sin excepción) hacia:

```
https://atelieroptica.com.ar/
```

No a una página de oferta puntual — al home. Una oferta se termina; la
redirección tiene que quedar para siempre.

## Por qué es urgente

1. Los 5 botones de "Escribinos por WhatsApp" de esa página abren un chat con
   **el número mayorista** (+54 9 3541 21-5971), no con el de la tienda
   (+54 9 351 868-5644). Del otro lado no hay nadie esperando consultas de
   público final: esa consulta se pierde entera.
2. El subdominio **rankea arriba de la tienda real** cuando alguien busca
   "Atelier Óptica" en Google — es el tráfico más caliente que existe, y cae
   en una página sin catálogo, sin precios y sin ningún link de vuelta a
   `atelieroptica.com.ar`.
3. No tiene la medición de la tienda (usa un Google Tag Manager propio):
   todo lo que pasa ahí es invisible para nosotros.

## Si el 301 tarda

Mientras se resuelve, pedimos como parche temporal:

- Agregar la etiqueta `noindex` a la página (para que dejen de competir con
  la tienda en Google).
- Cambiar los 5 botones de WhatsApp al número de la tienda:
  **+54 9 351 868-5644**.

**Importante: no bloquear la página con `robots.txt`.** Eso la deja igual de
indexada en Google y además le impide a Google leer la etiqueta `noindex`,
así que sería peor que no hacer nada.

## Verificado antes de este pedido (10-11/8/2026)

Ningún anuncio activo de Meta o Google tiene hoy a
`promo.atelieroptica.com.ar` como destino. Los 4 anuncios viejos que sí lo
usaban como destino ("Promo 2X1", "Temporada Primavera", "Lentes Karün") ya
están pausados. Antes de aplicar el 301, block de seguridad de 10 minutos
de nuestro lado: revisar que ningún sitelink o extensión de enlace en Google
Ads siga apuntando ahí.
