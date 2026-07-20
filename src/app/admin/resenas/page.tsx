'use client';

import { useEffect, useState, useCallback } from 'react';
import { Star, Check, Trash2, RefreshCw } from 'lucide-react';

type Review = { id: string; productId: string; authorName: string; rating: number; comment: string; approved: boolean; createdAt: string };

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`w-3.5 h-3.5 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
    </span>
  );
}

export default function ModeracionResenas() {
  const [pending, setPending] = useState<Review[]>([]);
  const [approved, setApproved] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reviews');
      if (res.ok) {
        const d = await res.json();
        setPending(d.pending || []);
        setApproved(d.approved || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const moderate = async (id: string, approved: boolean) => {
    await fetch('/api/admin/reviews', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved }),
    });
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('¿Borrar esta reseña?')) return;
    await fetch(`/api/admin/reviews?id=${id}`, { method: 'DELETE' });
    load();
  };

  const Card = ({ r, isPending }: { r: Review; isPending: boolean }) => (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Stars value={r.rating} />
          <span className="font-medium text-sm">{r.authorName}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('es-AR')}</span>
      </div>
      <p className="text-sm text-muted-foreground mb-2">{r.comment}</p>
      <p className="text-[11px] text-muted-foreground mb-2">Producto: {r.productId}</p>
      <div className="flex gap-2">
        {isPending ? (
          <button onClick={() => moderate(r.id, true)} className="flex items-center gap-1 px-3 py-1 rounded bg-green-600 text-white text-xs">
            <Check className="w-3.5 h-3.5" /> Aprobar
          </button>
        ) : (
          <button onClick={() => moderate(r.id, false)} className="px-3 py-1 rounded border border-border text-xs">Ocultar</button>
        )}
        <button onClick={() => remove(r.id)} className="flex items-center gap-1 px-3 py-1 rounded border border-red-300 text-red-600 text-xs">
          <Trash2 className="w-3.5 h-3.5" /> Borrar
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reseñas de productos</h1>
        <button onClick={load} className="p-2 rounded-md border border-border hover:bg-muted"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Pendientes de aprobación ({pending.length})</h2>
        {pending.length === 0 ? <p className="text-sm text-muted-foreground">No hay reseñas pendientes.</p> : (
          <div className="grid sm:grid-cols-2 gap-3">{pending.map((r) => <Card key={r.id} r={r} isPending />)}</div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Aprobadas ({approved.length})</h2>
        {approved.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay reseñas aprobadas.</p> : (
          <div className="grid sm:grid-cols-2 gap-3">{approved.map((r) => <Card key={r.id} r={r} isPending={false} />)}</div>
        )}
      </section>
    </div>
  );
}
