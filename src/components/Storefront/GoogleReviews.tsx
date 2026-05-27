import { getGoogleReviews } from "@/lib/googleReviews";
import { Star, Quote, Sparkles, Check } from "lucide-react";

export async function GoogleReviews() {
  const data = await getGoogleReviews();
  const reviews = data.reviews || [];

  const getInitials = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (reviews.length === 0) {
    return null; // Fallback silencioso si no hay reseñas
  }

  return (
    <div className="w-full py-32 bg-gradient-to-b from-[#faf8f5] via-[#f7f4ef] to-[#faf8f5] border-t border-[#e8e2db]/60 relative overflow-hidden">
      {/* Elementos decorativos de fondo de alta gama */}
      <div className="absolute top-1/4 left-10 w-80 h-80 bg-primary/5 rounded-full blur-[100px] -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] -z-10 animate-pulse" style={{ animationDuration: '10s' }} />
      
      <div className="max-w-[1400px] mx-auto px-6 lg:px-16 relative">
        
        {/* ENCABEZADO PREMIUM Y BOMBA */}
        <div className="flex flex-col items-center text-center mb-24 gap-6">
          
          {/* Insignia dorada/boutique estilo sello de calidad */}
          <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500/10 via-[#9e7f65]/15 to-amber-500/10 text-stone-800 dark:text-stone-900 rounded-full text-[10px] font-black uppercase tracking-[0.25em] shadow-sm select-none border border-amber-500/20">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" style={{ animationDuration: '6s' }} />
            LA ÓPTICA MEJOR CALIFICADA DE CÓRDOBA
          </div>
          
          {/* Título de alto impacto tipográfico */}
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-light tracking-tight text-stone-900 max-w-5xl leading-[1.1] font-serif">
            Cuidado visual con <span className="italic font-normal text-primary relative inline-block">
              Calidad de 5 Estrellas
              <span className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></span>
            </span>
          </h2>

          {/* Bloque centralizado de Score de Google */}
          <div className="flex flex-col sm:flex-row items-center gap-6 mt-6 p-6 rounded-3xl bg-white/40 backdrop-blur-sm border border-stone-200/40 shadow-sm max-w-md w-full justify-center">
            <div className="flex items-baseline gap-1">
              <span className="text-6xl font-black text-stone-900 tracking-tighter">5.0</span>
            </div>
            
            <div className="h-px sm:h-12 w-16 sm:w-px bg-stone-300/60 my-1 sm:my-0"></div>

            <div className="flex flex-col items-center sm:items-start">
              <div className="flex text-amber-500 gap-1">
                {[...Array(5)].map((_, idx) => (
                  <Star key={idx} className="w-5 h-5 fill-current filter drop-shadow-[0_2px_4px_rgba(245,158,11,0.3)] animate-pulse" style={{ animationDelay: `${idx * 150}ms` }} />
                ))}
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22.81-.6z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z" fill="#EA4335"/>
                </svg>
                <p className="text-[10px] uppercase font-black tracking-widest text-stone-500">Google Business</p>
              </div>
            </div>
          </div>
        </div>

        {/* REVIEWS GRID CON MEJOR EFECTO 3D/HOVER */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
          {reviews.slice(0, 3).map((review: any, i: number) => (
            <div 
              key={i} 
              className={`bg-white p-8 md:p-10 rounded-[2.5rem] border transition-all duration-500 flex flex-col justify-between relative group hover:-translate-y-3
                ${i === 1 
                  ? 'border-amber-500/20 shadow-[0_20px_40px_rgba(158,127,101,0.06)] md:scale-105 z-10 bg-gradient-to-b from-white to-[#faf8f5]' 
                  : 'border-stone-200/50 shadow-[0_15px_35px_rgba(0,0,0,0.02)]'
                } 
                hover:shadow-[0_30px_60px_rgba(158,127,101,0.18)] hover:border-primary/40`}
            >
              {/* Badge para la reseña del medio (destacada) */}
              {i === 1 && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-500 to-[#b89578] text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-full shadow-md">
                  Reseña Destacada
                </span>
              )}

              {/* Marca de agua de comilla */}
              <Quote className="absolute top-8 right-8 w-12 h-12 text-primary/5 group-hover:text-primary/12 transition-all duration-500 transform group-hover:scale-110 pointer-events-none" />
              
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex text-amber-500 gap-0.5">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={idx} className={`w-4 h-4 ${idx < review.rating ? 'fill-current text-amber-500' : 'text-stone-200'}`} />
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    <Check className="w-2.5 h-2.5" /> Verificada
                  </span>
                </div>

                <p className="text-[14px] sm:text-[15px] text-stone-700 leading-relaxed font-serif italic mb-8 relative z-10">
                  &quot;{review.text}&quot;
                </p>
              </div>

              <div className="flex items-center gap-4 border-t border-stone-100 pt-6 mt-auto">
                {review.profile_photo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={review.profile_photo_url} 
                    alt={review.author_name} 
                    className="w-12 h-12 rounded-full bg-stone-50 object-cover shrink-0 shadow-sm border-2 border-stone-100 group-hover:border-primary/30 transition-colors" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-black tracking-wider shrink-0 shadow-inner group-hover:bg-primary/20 transition-colors">
                    {getInitials(review.author_name)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-stone-900 group-hover:text-primary transition-colors">{review.author_name}</p>
                  <p className="text-[9px] text-stone-400 uppercase tracking-widest font-semibold mt-0.5">{review.relative_time_description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* LLAMADO A LA ACCIÓN MULTIPLE */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-20">
          <a
            href="https://www.google.com/maps?cid=14830223812501661125"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3.5 border border-stone-300 text-stone-700 hover:text-stone-900 hover:border-stone-800 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-300 bg-white/50 hover:bg-white backdrop-blur-sm shadow-sm"
          >
            Ver opiniones en Google Maps
          </a>

          <a
            href="https://search.google.com/local/writereview?placeid=ChIJjZd3QbC6l00RxWWzy_uJz80"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3.5 bg-primary hover:bg-[#8a6e55] text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 flex items-center gap-2 hover:-translate-y-0.5"
          >
            <Star className="w-4 h-4 fill-white" />
            Dejar tu opinión
          </a>
        </div>
        
      </div>
    </div>
  );
}


