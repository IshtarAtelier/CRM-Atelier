import { getGoogleReviews } from "@/lib/googleReviews";
import { Star, Quote, Sparkles } from "lucide-react";
import Image from "next/image";

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
    <div className="w-full py-20 bg-[#faf8f5] border-y border-[#e8e2db]/60">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-16">
        
        {/* COMPACT HEADER AND REVIEWS LAYOUT */}
        <div className="flex flex-col lg:flex-row gap-12 items-center lg:items-stretch">
          
          {/* Left Panel: Score & CTA */}
          <div className="flex-shrink-0 w-full lg:w-1/3 flex flex-col justify-center text-center lg:text-left">
            <div className="inline-flex items-center justify-center lg:justify-start gap-2 text-amber-600 text-[10px] font-black uppercase tracking-[0.25em] mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              La Óptica Mejor Calificada
            </div>
            
            <h2 className="text-4xl sm:text-5xl font-light tracking-tight text-stone-900 leading-[1.1] font-serif mb-6">
              Cuidado visual con <span className="italic text-primary block mt-1">5 Estrellas</span>
            </h2>

            <div className="flex items-center justify-center lg:justify-start gap-4 mb-8">
              <span className="text-5xl font-black text-stone-900 tracking-tighter">5.0</span>
              <div className="flex flex-col gap-1 items-start">
                <div className="flex text-amber-500">
                  {[...Array(5)].map((_, idx) => (
                    <Star key={idx} className="w-5 h-5 fill-current filter drop-shadow-sm" />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-stone-500">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22.81-.6z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z" fill="#EA4335"/>
                  </svg>
                  <span className="text-[10px] uppercase font-bold tracking-widest">Google Business</span>
                </div>
              </div>
            </div>

            <a
              href="https://www.google.com/maps?cid=14830223812501661125"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center lg:justify-start gap-2 text-[11px] font-bold uppercase tracking-widest text-primary hover:text-stone-900 transition-colors"
            >
              Ver todas las opiniones →
            </a>
          </div>

          {/* Right Panel: Scrollable Reviews Grid */}
          <div className="flex-1 w-full flex gap-6 overflow-x-auto snap-x pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {reviews.slice(0, 3).map((review: any, i: number) => (
              <div 
                key={i} 
                className="bg-white p-8 rounded-3xl border border-stone-200/50 shadow-sm min-w-[320px] md:min-w-[360px] flex-1 snap-start flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex text-amber-500 gap-0.5">
                      {[...Array(5)].map((_, idx) => (
                        <Star key={idx} className={`w-3.5 h-3.5 ${idx < review.rating ? 'fill-current text-amber-500' : 'text-stone-200'}`} />
                      ))}
                    </div>
                    <Quote className="w-5 h-5 text-stone-200" />
                  </div>

                  <p className="text-[14px] text-stone-600 leading-relaxed font-serif italic mb-6 line-clamp-4">
                    &quot;{review.text}&quot;
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-5 border-t border-stone-100 mt-auto">
                  {review.profile_photo_url ? (
                     
                    <Image 
                      src={review.profile_photo_url} 
                      alt={review.author_name} 
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-full bg-stone-50 object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                      {getInitials(review.author_name)}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-stone-900">{review.author_name}</p>
                    <p className="text-[9px] text-stone-400 uppercase tracking-widest font-medium mt-0.5">{review.relative_time_description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}


