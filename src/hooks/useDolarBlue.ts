"use client";

import { useEffect, useState } from 'react';

// Cotización blue (venta) para las pantallas del admin, o null mientras carga
// o si no hay ninguna confiable. Sale de /api/dolar, que usa el helper único
// del servidor (Ámbito → dolarapi.com → última cotización real). Antes cada
// pantalla le preguntaba a Ámbito directo desde el navegador, con su propia
// copia del parseo y sin respaldo: si Ámbito caía, se quedaban sin dólar.
export function useDolarBlue(): number | null {
  const [venta, setVenta] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/dolar')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (typeof data?.venta === 'number' && data.venta > 0) setVenta(data.venta);
      })
      .catch(() => {});
  }, []);

  return venta;
}
