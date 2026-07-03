'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Loader2, Ticket, X, Power } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  discountType: string; // FIXED | PERCENT
  discountValue: number;
  isActive: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  minOrderAmount: number | null;
}

const EMPTY_FORM = {
  id: '',
  code: '',
  discountType: 'FIXED',
  discountValue: '',
  expiresAt: '',
  maxUses: '',
  minOrderAmount: '',
  isActive: true,
};

export default function CouponsManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/coupons');
      if (res.ok) setCoupons(await res.json());
    } catch (e) {
      console.error('Error loading coupons:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (c: Coupon) => {
    setForm({
      id: c.id,
      code: c.code,
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
      maxUses: c.maxUses != null ? String(c.maxUses) : '',
      minOrderAmount: c.minOrderAmount ? String(c.minOrderAmount) : '',
      isActive: c.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isEdit = !!form.id;
      const url = isEdit ? `/api/admin/coupons/${form.id}` : '/api/admin/coupons';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          discountType: form.discountType,
          discountValue: form.discountValue,
          expiresAt: form.expiresAt || null,
          maxUses: form.maxUses,
          minOrderAmount: form.minOrderAmount,
          isActive: form.isActive,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        loadCoupons();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Error al guardar el cupón');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Coupon) => {
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      if (res.ok) loadCoupons();
    } catch (e) {
      console.error('Error toggling coupon:', e);
    }
  };

  const handleDelete = async (c: Coupon) => {
    if (!confirm(`¿Eliminar el cupón "${c.code}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(c.id);
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, { method: 'DELETE' });
      if (res.ok) loadCoupons();
      else alert('Error al eliminar el cupón');
    } catch {
      alert('Error de conexión');
    } finally {
      setDeletingId(null);
    }
  };

  const formatValue = (c: Coupon) =>
    c.discountType === 'PERCENT' ? `${c.discountValue}%` : `$${c.discountValue.toLocaleString('es-AR')}`;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-black text-stone-800 dark:text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" /> Cupones de Descuento
          </h2>
          <p className="text-xs text-stone-400 mt-1">Se aplican en el checkout de la tienda web.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-700 transition-all"
        >
          <Plus className="w-4 h-4" /> Nuevo Cupón
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-2xl">
          <Ticket className="w-8 h-8 mx-auto text-stone-300 mb-3" />
          <p className="text-sm text-stone-400">Todavía no hay cupones. Creá el primero.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-stone-200 dark:border-stone-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 dark:bg-stone-900 text-[9px] font-black uppercase tracking-widest text-stone-400">
                <th className="text-left px-4 py-3">Código</th>
                <th className="text-left px-4 py-3">Descuento</th>
                <th className="text-left px-4 py-3">Usos</th>
                <th className="text-left px-4 py-3">Vence</th>
                <th className="text-left px-4 py-3">Mín. compra</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="px-4 py-3 font-black tracking-wide text-stone-800 dark:text-stone-100">{c.code}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{formatValue(c)}</td>
                  <td className="px-4 py-3 text-stone-500">
                    {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {c.minOrderAmount ? `$${c.minOrderAmount.toLocaleString('es-AR')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${c.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleActive(c)} title={c.isActive ? 'Desactivar' : 'Activar'} className="p-2 hover:bg-amber-50 text-stone-400 hover:text-amber-600 rounded-lg transition-all">
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(c)} title="Editar" className="p-2 hover:bg-primary/5 text-stone-400 hover:text-primary rounded-lg transition-all">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c)} disabled={deletingId === c.id} title="Eliminar" className="p-2 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-lg transition-all disabled:opacity-50">
                        <Trash2 className={`w-3.5 h-3.5 ${deletingId === c.id ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black uppercase tracking-widest text-stone-800 dark:text-white">
                {form.id ? 'Editar Cupón' : 'Nuevo Cupón'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-1">Código *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="EJ: BIENVENIDA"
                  required
                  className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-bold uppercase tracking-wide bg-white dark:bg-stone-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-1">Tipo *</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                    className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl text-sm bg-white dark:bg-stone-800 dark:text-white"
                  >
                    <option value="FIXED">Monto fijo ($)</option>
                    <option value="PERCENT">Porcentaje (%)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-1">
                    {form.discountType === 'PERCENT' ? 'Porcentaje *' : 'Monto ($) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    placeholder={form.discountType === 'PERCENT' ? '10' : '5000'}
                    required
                    className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl text-sm bg-white dark:bg-stone-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-1">Vence (opcional)</label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl text-sm bg-white dark:bg-stone-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-1">Límite de usos</label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                    placeholder="Ilimitado"
                    className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl text-sm bg-white dark:bg-stone-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-1">Compra mínima ($, opcional)</label>
                <input
                  type="number"
                  min="0"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl text-sm bg-white dark:bg-stone-800 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-xs font-bold text-stone-600 dark:text-stone-300">Cupón activo</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="mt-2 w-full py-3 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : form.id ? 'Guardar Cambios' : 'Crear Cupón'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
