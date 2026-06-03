import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string; // unique ID for cart line item
  productId: string;
  brand: string;
  model: string;
  price: number;
  basePrice?: number; // precio original sin adicionales de cristales
  image: string;
  lensColor?: string | null;
  lensConfig?: any; // Para guardar configuraciones de cristales recetados en el futuro
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setIsOpen: (isOpen: boolean) => void;
  getCartTotal: () => number;
  updateItemLensConfig: (id: string, lensConfig: any, additionalPrice: number) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      
      addItem: (item) => set((state) => {
        // If exact same product and config exists, just increase quantity
        const existingItem = state.items.find(
          i => i.productId === item.productId && i.lensColor === item.lensColor
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
      }),
      
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
      
      getCartTotal: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
      },
    }),
    {
      name: 'atelier-cart-storage',
    }
  )
);
