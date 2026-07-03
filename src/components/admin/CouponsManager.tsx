"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Ticket, Plus, Trash2, Loader2, Power } from "lucide-react";

interface Coupon {
    id: string;
    code: string;
    type: string;
    value: number;
    active: boolean;
    expiresAt: string | null;
    maxUses: number | null;
    usedCount: number;
    minTotal: number | null;
    createdAt: string;
}

// Gestión de cupones de descuento del checkout web (Admin → Sitio Web → Configuración y Promos)
export function CouponsManager() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ code: "", type: "PERCENT", value: "", expiresAt: "", maxUses: "", minTotal: "" });

    const fetchCoupons = async () => {
        try {
            const res = await fetch("/api/coupons");
            if (res.ok) {
                const data = await res.json();
                setCoupons(data.coupons || []);
            }
        } catch (e) {
            console.error("Error fetching coupons:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCoupons(); }, []);

    const createCoupon = async () => {
        if (!form.code.trim() || !form.value) {
            toast.error("Completá el código y el valor del descuento.");
            return;
        }
        setCreating(true);
        try {
            const res = await fetch("/api/coupons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: form.code,
                    type: form.type,
                    value: Number(form.value),
                    expiresAt: form.expiresAt || null,
                    maxUses: form.maxUses || null,
                    minTotal: form.minTotal || null
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Cupón ${data.coupon.code} creado`);
                setForm({ code: "", type: "PERCENT", value: "", expiresAt: "", maxUses: "", minTotal: "" });
                setShowForm(false);
                fetchCoupons();
            } else {
                toast.error(data.error || "Error creando el cupón");
            }
        } catch (e) {
            toast.error("Error de red creando el cupón");
        } finally {
            setCreating(false);
        }
    };

    const toggleActive = async (coupon: Coupon) => {
        const res = await fetch(`/api/coupons/${coupon.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: !coupon.active })
        });
        if (res.ok) {
            setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, active: !c.active } : c));
            toast.success(`Cupón ${coupon.code} ${!coupon.active ? 'activado' : 'desactivado'}`);
        } else {
            toast.error("Error actualizando el cupón");
        }
    };

    const deleteCoupon = async (coupon: Coupon) => {
        if (!window.confirm(`¿Eliminar el cupón ${coupon.code}? Esta acción no se puede deshacer.`)) return;
        const res = await fetch(`/api/coupons/${coupon.id}`, { method: "DELETE" });
        if (res.ok) {
            setCoupons(prev => prev.filter(c => c.id !== coupon.id));
            toast.success(`Cupón ${coupon.code} eliminado`);
        } else {
            toast.error("Error eliminando el cupón");
        }
    };

    const describeDiscount = (c: Coupon) => c.type === "PERCENT" ? `${c.value}% OFF` : `$${c.value.toLocaleString("es-AR")} OFF`;
    const isExpired = (c: Coupon) => c.expiresAt && new Date(c.expiresAt) < new Date();
    const isExhausted = (c: Coupon) => c.maxUses != null && c.usedCount >= c.maxUses;

    return (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                        <Ticket className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-stone-700 dark:text-stone-200">Cupones de Descuento</h3>
                        <p className="text-xs text-stone-400">Códigos que los clientes pueden aplicar en el checkout. Se acumulan con el descuento por transferencia.</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-900 dark:bg-white dark:text-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-all"
                >
                    <Plus className="w-4 h-4" /> Nuevo Cupón
                </button>
            </div>

            {showForm && (
                <div className="mb-6 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 block mb-1">Código *</label>
                        <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Ej: BIENVENIDA10" className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 dark:bg-stone-900 rounded-lg text-sm font-bold uppercase" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 block mb-1">Tipo *</label>
                        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 dark:bg-stone-900 rounded-lg text-sm">
                            <option value="PERCENT">Porcentaje (%)</option>
                            <option value="FIXED">Monto fijo ($)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 block mb-1">{form.type === 'PERCENT' ? 'Porcentaje *' : 'Monto en pesos *'}</label>
                        <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.type === 'PERCENT' ? "10" : "20000"} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 dark:bg-stone-900 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 block mb-1">Vence (opcional)</label>
                        <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 dark:bg-stone-900 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 block mb-1">Usos máx. (opcional)</label>
                        <input type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} placeholder="Ej: 50" className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 dark:bg-stone-900 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 block mb-1">Compra mínima $ (opcional)</label>
                        <input type="number" value={form.minTotal} onChange={e => setForm(f => ({ ...f, minTotal: e.target.value }))} placeholder="Ej: 150000" className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 dark:bg-stone-900 rounded-lg text-sm" />
                    </div>
                    <div className="md:col-span-3 flex justify-end gap-2">
                        <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-600">Cancelar</button>
                        <button onClick={createCoupon} disabled={creating} className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear Cupón
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-300" /></div>
            ) : coupons.length === 0 ? (
                <p className="py-8 text-center text-xs text-stone-400 font-bold uppercase tracking-widest">Todavía no creaste ningún cupón</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-stone-200 dark:border-stone-700">
                                <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-stone-400">Código</th>
                                <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-stone-400">Descuento</th>
                                <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-stone-400">Usos</th>
                                <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-stone-400">Vence</th>
                                <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-stone-400">Mín. compra</th>
                                <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-stone-400">Estado</th>
                                <th className="py-2 text-[9px] font-black uppercase tracking-widest text-stone-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map(c => (
                                <tr key={c.id} className="border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/40">
                                    <td className="py-3 pr-4 font-black text-sm text-stone-800 dark:text-white uppercase">{c.code}</td>
                                    <td className="py-3 pr-4 text-sm font-bold text-emerald-600">{describeDiscount(c)}</td>
                                    <td className="py-3 pr-4 text-sm text-stone-500">{c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}</td>
                                    <td className="py-3 pr-4 text-xs text-stone-500">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('es-AR') : '—'}</td>
                                    <td className="py-3 pr-4 text-xs text-stone-500">{c.minTotal ? `$${c.minTotal.toLocaleString('es-AR')}` : '—'}</td>
                                    <td className="py-3 pr-4">
                                        {!c.active ? (
                                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-stone-100 dark:bg-stone-800 text-stone-400">Inactivo</span>
                                        ) : isExpired(c) ? (
                                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-100 dark:bg-red-950/40 text-red-500">Vencido</span>
                                        ) : isExhausted(c) ? (
                                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-950/40 text-amber-600">Agotado</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600">Activo</span>
                                        )}
                                    </td>
                                    <td className="py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => toggleActive(c)} title={c.active ? 'Desactivar' : 'Activar'} className={`p-2 rounded-lg transition-colors ${c.active ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' : 'text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'}`}>
                                                <Power className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteCoupon(c)} title="Eliminar" className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
