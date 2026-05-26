"use client";

import { useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";

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

  const getInitials = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 bg-stone-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || reviews.length === 0) {
    return null; // Fallback silencioso si no hay reseñas o falla la API
  }

  return (
    <div className="w-full py-28 bg-[#faf8f5] border-t border-[#e8e2db]/50 relative overflow-hidden">
      {/* Background soft glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-[1400px] mx-auto px-5 lg:px-12">
        
        {/* BIG BOMBA HEADER */}
        <div className="flex flex-col items-center text-center mb-20 gap-4">
          <div className="inline-flex items-center gap-2 px-4.5 py-2 bg-primary/10 text-primary rounded-full text-[9px] font-black uppercase tracking-[0.3em] shadow-sm select-none border border-primary/20 animate-pulse">
            ⭐ LA ÓPTICA MEJOR CALIFICADA DE CÓRDOBA ⭐
          </div>
          
          <h2 className="text-4xl md:text-6xl font-light tracking-tight text-stone-900 max-w-4xl leading-tight" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            Cuidado visual con <span className="font-serif italic font-normal text-primary">Calidad de 5 Estrellas</span>
          </h2>
          
          <div className="flex items-center gap-3.5 mt-2">
            <span className="text-5xl font-black text-stone-900 tracking-tighter">5.0</span>
            <div className="flex flex-col items-start">
              <div className="flex text-amber-500 gap-0.5 animate-bounce" style={{ animationDuration: '3s' }}>
                <Star className="w-5 h-5 fill-current" />
                <Star className="w-5 h-5 fill-current" />
                <Star className="w-5 h-5 fill-current" />
                <Star className="w-5 h-5 fill-current" />
                <Star className="w-5 h-5 fill-current" />
              </div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-stone-400 mt-1">Puntaje Perfecto en Google Business</p>
            </div>
          </div>
        </div>

        {/* REVIEWS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.slice(0, 3).map((review, i) => (
            <div 
              key={i} 
              className="bg-white p-8 rounded-[2rem] shadow-md border border-stone-200/50 hover:shadow-xl hover:border-primary/20 transition-all duration-300 flex flex-col justify-between relative group"
            >
              {/* Quote Mark background decoration */}
              <span className="absolute top-6 right-8 text-7xl font-serif text-primary/5 select-none pointer-events-none group-hover:text-primary/10 transition-colors font-black">“</span>
              
              <div>
                <div className="flex text-amber-500 gap-0.5 mb-5">
                  {[...Array(5)].map((_, idx) => (
                    <Star key={idx} className={`w-3.5 h-3.5 ${idx < review.rating ? 'fill-current' : 'text-stone-200'}`} />
                  ))}
                </div>
                <p className="text-[13px] sm:text-[14px] text-stone-700 leading-relaxed font-serif italic mb-6">
                  &quot;{review.text}&quot;
                </p>
              </div>

              <div className="flex items-center gap-3 border-t border-stone-100 pt-5">
                {review.profile_photo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={review.profile_photo_url} 
                    alt={review.author_name} 
                    className="w-10 h-10 rounded-full bg-stone-50 object-cover shrink-0 shadow-inner" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-black tracking-wider shrink-0 shadow-inner">
                    {getInitials(review.author_name)}
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-stone-900">{review.author_name}</p>
                  <p className="text-[9px] text-stone-400 uppercase tracking-widest">{review.relative_time_description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-14">
          <a
            href="https://www.google.com/maps?cid=14830223812501661125"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:text-black transition-colors underline underline-offset-4 decoration-1 decoration-primary/50 hover:decoration-black"
          >
            Ver todas las opiniones en Google Maps →
          </a>
        </div>
      </div>
    </div>
  );
}
