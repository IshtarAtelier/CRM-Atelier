"use client";

// ────────────────────────────────────────────────────────────────────────────
// Pie de /tienda (y título del tab) según quién esté mirando.
//
// /tienda es la única página pública que también sirve al canal MAYORISTA: si la
// mira una óptica logueada (rol OPTICA), no debe ver nada de Atelier — pie
// neutro de Cápsula Escarlata y "Catálogo Mayorista" en la pestaña.
//
// Eso se resolvía en el servidor leyendo la cookie `session` con `cookies()`, en
// la página y en su generateMetadata. Esa sola llamada volvía DINÁMICA toda la
// ruta: el `export const revalidate` de page.tsx era letra muerta y cada visita
// anónima —la enorme mayoría— volvía a armar el catálogo entero. Acá se resuelve
// en el cliente, exactamente igual que ya lo hacía TiendaClient para el hero, el
// nombre de marca de cada tarjeta y los precios mayoristas, así que la óptica ve
// lo mismo que antes y la cáscara de la página vuelve a ser estática.
//
// Lo único que se perdió es el `robots: noindex` que devolvía la metadata cuando
// la cookie era de una óptica: ningún buscador trae esa cookie, así que a un
// crawler siempre le llegó la metadata pública. Sin efecto en el SEO.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { StorefrontFooterStatic } from "@/components/Storefront/StorefrontFooterStatic";

const TITULO_MAYORISTA = "Catálogo Mayorista · Cápsula Escarlata";

export function PieSegunSesion() {
  const [esOptica, setEsOptica] = useState(false);

  useEffect(() => {
    let vivo = true;
    const guardado = localStorage.getItem("user");
    if (guardado) {
      try {
        if (JSON.parse(guardado).role === "OPTICA") setEsOptica(true);
      } catch {
        // user corrupto en localStorage: se ignora, decide /api/auth/me
      }
    }

    // Sin indicios de sesión no se pregunta: sería un 401 por cada visitante
    // anónimo. La cookie real es httpOnly, por eso el user de localStorage es la
    // señal principal.
    if (!guardado && !document.cookie.includes("session=")) return;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("sin sesión"))))
      .then((data) => {
        if (vivo) setEsOptica(data?.role === "OPTICA");
      })
      .catch(() => {
        if (vivo) setEsOptica(false);
      });

    return () => {
      vivo = false;
    };
  }, []);

  // El <title> sale del metadata estático (el minorista). Es la única parte del
  // rebrandeo mayorista que no se puede expresar en JSX, así que se pisa acá.
  useEffect(() => {
    if (esOptica) document.title = TITULO_MAYORISTA;
  }, [esOptica]);

  return <StorefrontFooterStatic isWholesale={esOptica} />;
}
