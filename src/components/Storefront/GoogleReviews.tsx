"use client";

import { useEffect, useState } from "react";
import { Star, MessageCircle } from "lucide-react";

interface Review {
  author_name: string;
  author_url: string;
  profile_photo_url: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
}

export function GoogleReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const res = await fetch("/api/reviews");
        if (!res.ok) throw new Error("Error cargando reseñas");
        const data = await res.json();
        setReviews(data.reviews || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchReviews();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 bg-stone-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-800"></div>
      </div>
    );
  }

  if (error || reviews.length === 0) {
    return null; // Fallback silencioso si no hay reseñas o falla la API
  }

  return (
    <div className="w-full py-20 bg-stone-50">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white flex items-center justify-center rounded-full shadow-sm border border-stone-100 shrink-0">
              <MessageCircle className="w-6 h-6 text-stone-800" />
            </div>
            <div>
              <h3 className="text-3xl font-light tracking-tight text-stone-900 mb-1" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                Nuestros Clientes
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-stone-600">Excelentes reseñas en Google</span>
                <span className="flex text-yellow-400">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                </span>
              </div>
            </div>
          </div>
          <a
            href="https://www.google.com/maps?cid=14830223812501661125"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 transition-colors"
          >
            Ver todas las reseñas →
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.slice(0, 3).map((review, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={review.profile_photo_url} alt={review.author_name} className="w-10 h-10 rounded-full bg-stone-100" referrerPolicy="no-referrer" />
                  <div>
                    <p className="text-sm font-bold text-stone-800">{review.author_name}</p>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider">{review.relative_time_description}</p>
                  </div>
                </div>
              </div>
              <div className="flex text-yellow-400 mb-4">
                {[...Array(5)].map((_, idx) => (
                  <Star key={idx} className={`w-3.5 h-3.5 ${idx < review.rating ? 'fill-current' : 'text-stone-200'}`} />
                ))}
              </div>
              <p className="text-sm text-stone-600 leading-relaxed font-light flex-grow">
                &quot;{review.text}&quot;
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
