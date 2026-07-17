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
        items: state.items.map((i) => 
          i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
        ),
      })),
      
      clearCart: () => set({ items: [] }),
      
      setIsOpen: (isOpen) => set({ isOpen }),

      updateItemLensConfig: (id, lensConfig, additionalPrice) => set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, lensConfig, price: (i.basePrice ?? i.price) + additionalPrice } : i
        ),
      })),

      // Backfill de precios mayoristas para ítems agregados antes de loguearse
      // como óptica (no tenían wholesaleBasePrice al momento de agregar).
      setItemWholesalePrices: (pricesByProductId) => set((state) => ({
        items: state.items.map((i) => {
          const wp = pricesByProductId[i.productId];
          return wp && wp > 0 && !i.wholesaleBasePrice ? { ...i, wholesaleBasePrice: wp } : i;
        }),
      })),

      getCartTotal: (isWholesale = false) => {
        return get().items.reduce((total, item) => total + (getItemUnitPrice(item, isWholesale) * item.quantity), 0);
      },
    }),
    {
      name: 'atelier-cart-storage',
    }
  )
);
