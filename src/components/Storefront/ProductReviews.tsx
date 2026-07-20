'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

type Review = { id: string; authorName: string; rating: number; comment: string; createdAt: string };

function Stars({ value, onSelect }: { value: number; onSelect?: (n: number) => void }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          onClick={onSelect ? () => onSelect(n) : undefined}
          className={`w-4 h-4 ${onSelect ? 'cursor-pointer' : ''} ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
        />
      ))}
    </span>
  );
}

export default function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [form, setForm] = useState({ authorName: '', rating: 5, comment: '' });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    fetch(`/api/web/reviews?productId=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((d) => { setReviews(d.reviews || []); setAverage(d.average || 0); setCount(d.count || 0); })
      .catch(() => {});
  };

  useEffect(() => { if (productId) load(); /* eslint-disable-next-line */ }, [productId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setMsg(null);
    try {
      const res = await fetch('/api/web/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, ...form }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg(d.message || '¡Gracias por tu reseña!');
        setForm({ authorName: '', rating: 5, comment: '' });
        setShowForm(false);
      } else {
        setMsg(d.error || 'No se pudo enviar.');
      }
    } catch {
      setMsg('No se pudo enviar.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-border pt-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Reseñas</h3>
        <button onClick={() => setShowForm((s) => !s)} className="text-sm underline">
          {showForm ? 'Cancelar' : 'Escribir una reseña'}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Stars value={Math.round(average)} />
        <span className="text-sm text-muted-foreground">
          {count > 0 ? `${average} · ${count} reseña${count === 1 ? '' : 's'}` : 'Sé el primero en opinar'}
        </span>
      </div>

      {msg && <p className="text-sm text-green-600 mb-3">{msg}</p>}

      {showForm && (
        <form onSubmit={submit} className="space-y-3 mb-6 p-4 rounded-lg border border-border bg-card">
          <input
            required
            placeholder="Tu nombre"
            value={form.authorName}
            onChange={(e) => setForm({ ...form, authorName: e.target.value })}
            className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm">Puntaje:</span>
            <Stars value={form.rating} onSelect={(n) => setForm({ ...form, rating: n })} />
          </div>
          <textarea
            required
            placeholder="¿Qué te pareció el producto?"
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
          />
          <button disabled={sending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
            {sending ? 'Enviando…' : 'Enviar reseña'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="text-sm">
            <div className="flex items-center gap-2">
              <Stars value={r.rating} />
              <span className="font-medium">{r.authorName}</span>
            </div>
            <p className="text-muted-foreground mt-1">{r.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
