'use client';

import { Plus, Trash2, Split, Info } from 'lucide-react';

export interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    price: number;
}

interface Props {
    items: InvoiceItem[];
    onItemsChange: (items: InvoiceItem[]) => void;
    monotributoLimit: number;
}

export function InvoiceItemEditor({ items, onItemsChange, monotributoLimit }: Props) {
    const addItem = () => {
        onItemsChange([...items, { id: Date.now().toString(), description: 'Nuevo Concepto', quantity: 1, price: 0 }]);
    };

    const removeItem = (id: string) => {
        onItemsChange(items.filter(it => it.id !== id));
    };

    const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
        onItemsChange(items.map(it => it.id === id ? { ...it, [field]: value } : it));
    };

    const splitItem = (id: string) => {
        const item = items.find(it => it.id === id);
        if (!item) return;

        const p1 = Math.min(item.price, monotributoLimit);
        const p2 = item.price - p1;

        const newItems = items.flatMap(it => {
            if (it.id === id) {
                return [
                    { ...it, id: `${it.id}-p1`, description: `${it.description} (Cristal)`, price: p1 },
                    { ...it, id: `${it.id}-p2`, description: `${it.description} (Tratamientos)`, price: p2 }
                ];
            }
            return it;
        });
        onItemsChange(newItems);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" /> Detalle de los ítems
                </h4>
                <button 
                    onClick={addItem} 
                    className="flex items-center gap-2 text-[10px] font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-widest"
                >
                    <Plus className="w-3.5 h-3.5" /> Agregar ítem
                </button>
            </div>
            
            <div className="space-y-3">
                {items.map((it) => (
                    <div 
                        key={it.id} 
                        className={`group bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border-2 transition-all ${it.price > monotributoLimit ? 'border-orange-500/30' : 'border-transparent hover:border-stone-200 dark:hover:border-stone-701'}`}
                    >
                        <div className="flex gap-4 items-start">
                            <div className="flex-1 space-y-3">
                                <input 
                                    type="text" 
                                    value={it.description}
                                    onChange={(e) => updateItem(it.id, 'description', e.target.value)}
                                    className="w-full bg-transparent font-bold text-sm text-stone-800 dark:text-white outline-none placeholder:text-stone-300"
                                    placeholder="Descripción del concepto..."
                                />
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-xl text-xs shadow-sm">
                                        <span className="text-stone-400 font-bold">Cant:</span>
                                        <input 
                                            type="number" 
                                            value={it.quantity}
                                            onChange={(e) => updateItem(it.id, 'quantity', Number(e.target.value))}
                                            className="w-8 bg-transparent font-black outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-xl text-xs shadow-sm">
                                        <span className="text-stone-400 font-bold">Precio: $</span>
                                        <input 
                                            type="number" 
                                            value={it.price}
                                            onChange={(e) => updateItem(it.id, 'price', Number(e.target.value))}
                                            className="w-24 bg-transparent font-black outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {it.price > monotributoLimit && (
                                    <button 
                                        onClick={() => splitItem(it.id)} 
                                        className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors shadow-sm" 
                                        title="Dividir por límite de Monotributo"
                                    >
                                        <Split className="w-4 h-4" />
                                    </button>
                                )}
                                <button 
                                    onClick={() => removeItem(it.id)} 
                                    className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
