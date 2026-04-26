'use client';

import { useState, useEffect } from 'react';
import {
    X, Calculator, ShoppingCart, User, Phone,
    Mail, ArrowRight, Glasses, Layers, Plus,
    Trash2, CheckCircle2, History
} from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';

interface QuickQuoteProps {
    onClose: () => void;
}

export default function QuickQuote({ onClose }: QuickQuoteProps) {
    const { createContact, addInteraction } = useContacts('ALL', '', false, 'ALL');
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [quoteItems, setQuoteItems] = useState<any[]>([]);
    const [step, setStep] = useState<'quote' | 'contact'>('quote');

    // Contact Form State
    const [contactData, setContactData] = useState({
        name: '',
        phone: '',
        email: '',
        interest: 'General'
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                const data = await res.json();
                setProducts(data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const addToQuote = (product: any) => {
        setQuoteItems([...quoteItems, { ...product, idOnQuote: Date.now() }]);
    };

    const removeFromQuote = (idOnQuote: number) => {
        setQuoteItems(quoteItems.filter(item => item.idOnQuote !== idOnQuote));
    };

    const total = quoteItems.reduce((acc, item) => acc + item.price, 0);

    const handleConfirmQuote = () => {
        if (quoteItems.length === 0) return;
        setStep('contact');
    };

    const handleRegisterSale = async () => {
        if (!contactData.name || !contactData.phone) {
            alert('Nombre y teléfono son obligatorios para el registro.');
            return;
        }

        try {
            // 1. Crear el contacto (o buscar existente si tuviéramos esa lógica)
            const newContact = await createContact({
                ...contactData,
                status: 'CONFIRMED', // Dijo que sí, se lleva presupuesto
                expectedValue: total
            } as any);

            if (newContact) {
                // 2. Registrar la interacción del presupuesto
                const itemsList = quoteItems.map(i => `${i.brand} ${i.name || ''} ($${i.price})`).join(', ');
                await addInteraction(newContact.id, 'BUDGET_SENT', `Presupuesto enviado: ${itemsList}. Total: $${total}`);

                alert('Venta y contacto registrados correctamente.');
                onClose();
            }
        } catch (error) {
            console.error('Error registering sale:', error);
            alert('Error al registrar la venta.');
        }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/40 dark:bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-500">
            <div className="bg-white dark:bg-stone-900 w-full max-w-5xl h-full max-h-[850px] rounded-[3rem] shadow-huge border border-stone-100 dark:border-stone-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">

                {/* Header */}
                <header className="p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <Calculator className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-stone-800 dark:text-white uppercase tracking-tighter italic">Cotizador Rápido</h2>
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest italic">{step === 'quote' ? 'Armando presupuesto' : 'Registro de cliente'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-4 bg-white dark:bg-stone-800 hover:rotate-90 transition-all rounded-2xl border border-stone-100 dark:border-stone-700 shadow-sm"
                    >
                        <X className="w-6 h-6 text-stone-400" />
                    </button>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {step === 'quote' ? (
                        <>
                            {/* Product List */}
                            <div className="flex-1 overflow-y-auto p-8 border-r border-stone-50 dark:border-stone-800 custom-scrollbar">
                                <div className="space-y-8">
                                    {['FRAME', 'CRISTAL', 'SUNGLASS', 'ACCESSORY'].map(category => {
                                        const catProducts = products.filter(p => p.category === category);
                                        if (catProducts.length === 0) return null;

                                        return (
                                            <section key={category}>
                                                <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                    {category === 'FRAME' && <Glasses className="w-4 h-4" />}
                                                    {category === 'CRISTAL' && <Layers className="w-4 h-4" />}
                                                    {category}
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {catProducts.map(product => (
                                                        <button
                                                            key={product.id}
                                                            onClick={() => addToQuote(product)}
                                                            className="flex items-center justify-between p-5 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-[2rem] hover:border-primary/50 transition-all group hover:shadow-xl hover:-translate-y-1"
                                                        >
                                                            <div className="text-left">
                                                                <p className="font-black text-stone-800 dark:text-white uppercase tracking-tight text-sm">{product.brand}</p>
                                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest italic">{product.name || (product.type || 'Standard')}</p>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-black text-primary text-sm">${product.price.toLocaleString()}</span>
                                                                <div className="w-8 h-8 bg-stone-50 dark:bg-stone-900 rounded-full flex items-center justify-center text-stone-300 group-hover:bg-primary group-hover:text-white transition-all">
                                                                    <Plus className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Quote Summary (Right Panel) */}
                            <div className="w-96 bg-stone-50/50 dark:bg-stone-800/10 p-8 flex flex-col">
                                <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4" /> Detalle del Presupuesto
                                </h3>

                                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar mb-8">
                                    {quoteItems.length > 0 ? (
                                        quoteItems.map(item => (
                                            <div key={item.idOnQuote} className="p-4 bg-white dark:bg-stone-800 rounded-3xl border border-stone-100 dark:border-stone-700 shadow-sm flex items-center justify-between group animate-in slide-in-from-right-4 duration-300">
                                                <div className="min-w-0">
                                                    <p className="font-black text-[10px] uppercase truncate">{item.brand} · {item.name || ''}</p>
                                                    <p className="text-[9px] font-bold text-stone-400 tracking-widest uppercase">${item.price.toLocaleString()}</p>
                                                </div>
                                                <button
                                                    onClick={() => removeFromQuote(item.idOnQuote)}
                                                    className="p-2 text-stone-200 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="h-40 flex flex-col items-center justify-center text-center opacity-30 border-2 border-dashed border-stone-200 rounded-[2.5rem]">
                                            <ShoppingCart className="w-8 h-8 mb-2" />
                                            <p className="text-[9px] font-black uppercase tracking-widest px-8">Agrega productos para cotizar</p>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-stone-200 dark:border-stone-700">
                                    <div className="flex justify-between items-end mb-6">
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Inversión Final</span>
                                        <span className="text-3xl font-black text-stone-900 dark:text-white tracking-tighter">${total.toLocaleString()}</span>
                                    </div>
                                    <button
                                        onClick={handleConfirmQuote}
                                        disabled={quoteItems.length === 0}
                                        className={`w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl ${quoteItems.length > 0 ? 'bg-primary text-primary-foreground hover:scale-105 active:scale-95' : 'bg-stone-100 text-stone-300 cursor-not-allowed'}`}
                                    >
                                        CONFIRMAR <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Step: Contact Info (MANDATORY) */
                        <div className="flex-1 p-12 bg-stone-50/30 dark:bg-stone-900/40 flex flex-col items-center justify-center animate-in slide-in-from-bottom-8 duration-500">
                            <div className="w-full max-w-md bg-white dark:bg-stone-800 rounded-[3.5rem] p-12 shadow-huge border border-stone-100 dark:border-stone-700">
                                <div className="text-center mb-10">
                                    <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <User className="w-10 h-10 text-emerald-500" />
                                    </div>
                                    <h3 className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter mb-2 italic">Registro de Contacto</h3>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-relaxed">Paso obligatorio para guardar el presupuesto en el historial</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="group">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4 mb-2 block group-focus-within:text-primary transition-colors">Nombre Completo</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={contactData.name}
                                                onChange={e => setContactData({ ...contactData, name: e.target.value })}
                                                placeholder="Ej: Juan Pérez"
                                                className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-5 rounded-3xl text-sm font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all pl-12"
                                            />
                                            <User className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                        </div>
                                    </div>

                                    <div className="group">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4 mb-2 block group-focus-within:text-primary transition-colors">WhatsApp / Teléfono</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={contactData.phone}
                                                onChange={e => setContactData({ ...contactData, phone: e.target.value })}
                                                placeholder="Solo dígitos (ej: 351...)"
                                                className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-5 rounded-3xl text-sm font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all pl-12"
                                            />
                                            <Phone className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                        </div>
                                    </div>

                                    <div className="group">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4 mb-2 block group-focus-within:text-primary transition-colors">Email (Opcional)</label>
                                        <div className="relative">
                                            <input
                                                type="email"
                                                value={contactData.email}
                                                onChange={e => setContactData({ ...contactData, email: e.target.value })}
                                                placeholder="email@ejemplo.com"
                                                className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-5 rounded-3xl text-sm font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all pl-12"
                                            />
                                            <Mail className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                        </div>
                                    </div>

                                    <div className="pt-6 grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setStep('quote')}
                                            className="py-5 bg-stone-100 text-stone-400 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
                                        >
                                            <ArrowRight className="w-4 h-4 rotate-180" /> VOLVER
                                        </button>
                                        <button
                                            onClick={handleRegisterSale}
                                            className="py-5 bg-emerald-500 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                                        >
                                            FINALIZAR <CheckCircle2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <footer className="p-6 bg-stone-50/30 dark:bg-stone-800/20 border-t border-stone-100 dark:border-stone-800 flex justify-center">
                    <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.4em]">Optica CRM - Quoting System v2.0</p>
                </footer>
            </div>
        </div>
    );
}
