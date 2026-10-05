import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { trackAddToCart } from '@/lib/tracking';

export interface CartItem {
  id: string; // unique ID for cart line item
  productId: string;
  brand: string;
  model: string;
  price: number;
  basePrice?: number; // precio original sin adicionales de cristales
  wholesaleBasePrice?: number; // precio mayorista del armazón (0 = sin precio mayorista)
  image: string;
  lensColor?: string | null;
  lensConfig?: any; // Para guardar configuraciones de cristales recetados en el futuro
  quantity: number;
  /** Stock conocido al agregar. Tope del "+" del carrito; el backend revalida al pagar. */
  stock?: number;
}

// Precio unitario según el canal ACTUAL (no el del momento de agregar): para un
// mayorista logueado el armazón vale wholesaleBasePrice y los cristales se suman
// a precio de lista (mismo criterio que effectiveFramePrice + recalculateItemPrice
// en el backend, que es quien cobra de verdad).
export function getItemUnitPrice(item: CartItem, isWholesale: boolean): number {
  if (isWholesale && item.wholesaleBasePrice && item.wholesaleBasePrice > 0) {
    const lensExtras = item.price - (item.basePrice ?? item.price);
    return item.wholesaleBasePrice + Math.max(0, lensExtras);
  }
  return item.price;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  /** Carga un carrito entero (el que repone el mail de recupero). No mide AddToCart: no es una acción nueva. */
  reponerItems: (items: Omit<CartItem, 'id'>[]) => void;
  setIsOpen: (isOpen: boolean) => void;
  getCartTotal: (isWholesale?: boolean) => number;
  updateItemLensConfig: (id: string, lensConfig: any, additionalPrice: number) => void;
  setItemWholesalePrices: (pricesByProductId: Record<string, number>) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      
      addItem: (item) => {
        try {
          trackAddToCart({
            id: item.productId,
            name: `${item.brand || ''} ${item.model || ''}`.trim() || 'Anteojos',
            price: item.price,
            quantity: item.quantity
          });
        } catch (e) {
          console.error("AddToCart tracking error:", e);
        }

        set((state) => {
          // If exact same product and config exists, just increase quantity
          const existingItem = state.items.find(
            i => i.productId === item.productId && 
                 i.lensColor === item.lensColor &&
                 JSON.stringify(i.lensConfig) === JSON.stringify(item.lensConfig)
          );
          
          if (existingItem) {
            return {
              items: state.items.map(i => 
                i.id === existingItem.id 
                  ? { ...i, quantity: i.quantity + item.quantity } 
                  : i
              ),
              isOpen: true,
            };
          }

          return {
            items: [...state.items, { ...item, id: crypto.randomUUID(), basePrice: item.basePrice ?? item.price }],
            isOpen: true,
          };
        });
      },
      
      removeItem: (id) => set((state) => ({
        items: state.items.filter((i) => i.id !== id),
      })),
      
      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((i) => {
          if (i.id !== id) return i;
          // Tope por stock conocido: sin esto se podían pedir 10 unidades de un
          // producto con stock 1 y el freno llegaba recién al pagar ("Stock
          // insuficiente" al final de un checkout ya completado). Ítems viejos
          // persistidos sin stock quedan sin tope (el backend sigue frenando).
          const cap = typeof i.stock === 'number' && i.stock > 0 ? i.stock : Infinity;
          return { ...i, quantity: Math.min(cap, Math.max(1, quantity)) };
        }),
      })),
      
      clearCart: () => set({ items: [] }),

      reponerItems: (items) => set({
        items: items.map((item, i) => ({ ...item, id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}` })),
      }),
      
      setIsOpen: (isOpen) => set({ isOpen }),

      updateItemLensConfig: (id, lensConfig, additionalPrice) => set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, lensConfig, price: (i.basePrice ?? i.price) + additionalPrice } : i
        ),
      })),

      // Sincroniza los precios mayoristas del carrito con el catálogo actual.
      // SIEMPRE pisa el valor guardado: si el negocio re-tarifa (ej. sol 29→32k),
      // el carrito persistido debe reflejar lo que el backend va a cobrar.
      // Un producto ausente del mapa ya no tiene precio mayorista → se limpia.
      setItemWholesalePrices: (pricesByProductId) => set((state) => ({
        items: state.items.map((i) => {
          const wp = pricesByProductId[i.productId] || 0;
          return wp !== (i.wholesaleBasePrice || 0) ? { ...i, wholesaleBasePrice: wp } : i;
        }),
      })),

      getCartTotal: (isWholesale = false) => {
        return get().items.reduce((total, item) => total + (getItemUnitPrice(item, isWholesale) * item.quantity), 0);
      },
    }),
    {
      name: 'atelier-cart-storage',
      // Se guardan SOLO los productos. `isOpen` es estado de pantalla: si se
      // persistía, el panel del carrito se volvía a abrir solo en la página
      // siguiente — por ejemplo encima del formulario del checkout, apenas la
      // persona tocaba "Finalizar compra" (auditoría del 25/9/2026).
      partialize: (state) => ({ items: state.items }),
      // Los navegadores que ya tenían guardado `isOpen: true` (de antes de
      // este cambio) lo levantarían una vez más: del guardado se toman solo
      // los productos.
      merge: (guardado, actual) => ({
        ...actual,
        items: Array.isArray((guardado as { items?: unknown })?.items)
          ? (guardado as { items: CartItem[] }).items
          : actual.items,
      }),
    }
  )
);
