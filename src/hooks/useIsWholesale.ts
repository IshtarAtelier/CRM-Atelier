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
          setIsWholesale(false);
          setWholesaleUser(null);
        }
      })
      .catch(() => {
        setIsWholesale(false);
        setWholesaleUser(null);
      });
  }, []);

  return { isWholesale, wholesaleUser };
}

// Cuando la sesión mayorista se detecta DESPUÉS de que el visitante ya cargó el
// carrito (agregó como anónimo y recién ahí se logueó), los ítems quedaron sin
// wholesaleBasePrice. Este hook los completa desde el catálogo mayorista para
// que el carrito muestre el precio que efectivamente se va a cobrar.
export function useWholesaleCartBackfill(isWholesale: boolean) {
  const items = useCart(s => s.items);
  const setItemWholesalePrices = useCart(s => s.setItemWholesalePrices);

  useEffect(() => {
    if (!isWholesale) return;
    const missing = items.filter(i => !i.wholesaleBasePrice);
    if (missing.length === 0) return;

    fetch('/api/store/products?channel=wholesale&limit=500')
      .then(res => res.json())
      .then(data => {
        const map: Record<string, number> = {};
        for (const p of data.products || []) {
          if (p.wholesalePrice > 0) map[p.id] = p.wholesalePrice;
        }
        if (Object.keys(map).length > 0) setItemWholesalePrices(map);
      })
      .catch(() => {});
    // items.length (no items) evita re-fetch en cada mutación menor del carrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWholesale, items.length]);
}
