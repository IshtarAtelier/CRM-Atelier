"use client";

import { useEffect, useState } from 'react';
import { useCart } from '@/store/useCart';

// Detección de sesión mayorista (rol OPTICA) para componentes de la tienda.
// Mismo patrón que TiendaClient/ProductClient: localStorage como señal rápida
// (la cookie real es httpOnly) y /api/auth/me como confirmación. Solo afecta
// la VISUALIZACIÓN de precios: el backend re-verifica el rol y re-calcula
// precios desde la DB al cobrar (payway/route.ts).
export function useIsWholesale() {
  const [isWholesale, setIsWholesale] = useState(false);
  const [wholesaleUser, setWholesaleUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u.role === 'OPTICA') {
          setIsWholesale(true);
          setWholesaleUser(u);
        }
      } catch {}
    }

    // Evita un 401 por visitante anónimo: solo consultar si hay indicios de sesión.
    if (!stored && !document.cookie.includes('session=')) return;

    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then(data => {
        if (data.role === 'OPTICA') {
          setIsWholesale(true);
          setWholesaleUser(data);
          localStorage.setItem('user', JSON.stringify(data));
        } else {
          // Sesión confirmada como NO mayorista: limpiar el user viejo para que
          // ningún otro componente siga mostrando tarifa mayorista por un
          // localStorage vencido (mismo criterio que StorefrontNavbar).
          setIsWholesale(false);
          setWholesaleUser(null);
          localStorage.removeItem('user');
        }
      })
      .catch(() => {
        // Error de red: no tocar localStorage (puede ser un blip de conexión).
        setIsWholesale(false);
        setWholesaleUser(null);
      });
  }, []);

  return { isWholesale, wholesaleUser };
}

// Sincroniza los precios mayoristas del carrito con el catálogo vigente cada
// vez que hay sesión de óptica: cubre ítems agregados antes del login Y
// re-tarifaciones posteriores (el precio guardado en el carrito persistido
// nunca es autoridad — el backend cobra el de la base). Usa el endpoint
// liviano de ids+precios, no el catálogo completo con imágenes.
export function useWholesaleCartBackfill(isWholesale: boolean) {
  const items = useCart(s => s.items);
  const setItemWholesalePrices = useCart(s => s.setItemWholesalePrices);

  useEffect(() => {
    if (!isWholesale || items.length === 0) return;

    fetch('/api/store/wholesale-prices')
      .then(res => res.json())
      .then(data => {
        if (data.prices && typeof data.prices === 'object') {
          setItemWholesalePrices(data.prices);
        }
      })
      .catch(() => {});
    // items.length (no items) evita re-fetch en cada mutación menor del carrito.
  }, [isWholesale, items.length, setItemWholesalePrices]);
}
