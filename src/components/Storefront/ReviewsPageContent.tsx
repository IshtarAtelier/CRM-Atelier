"use client";

import { useState } from "react";
import { Star, MessageCircle, ArrowRight, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Review {
  author_name: string;
  author_url?: string;
  profile_photo_url: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time?: number;
}

const FALLBACK_REVIEWS: Review[] = [
  {
    author_name: "Julieta Foppoli",
    profile_photo_url: "https://lh3.googleusercontent.com/a-/ALV-UjWGd0XySGT0AZWji7lm9u8bCXz_qUw2cp1pctHqZULadZuVpco=s128-c0x00000000-cc-rp-mo-ba2",
    rating: 5,
    relative_time_description: "Hace 3 semanas",
    text: "Excelente atención... La compra se salió de \"hablar de precios\" a revisar que era mejor, probar opciones e incluso proponer llamado para poder recomendar mejor. El local impecable todo a la vista lo que hizo súper ágil la elección. Atención profesional, amable... Nada de andar corriendo o despachando gente como me venía pasando. Súper recomendado!",
    author_url: "https://www.google.com/maps/contrib/106672142904345242727/reviews"
  },
  {
    author_name: "CLAUDIA SONIA GUZMAN",
    profile_photo_url: "https://lh3.googleusercontent.com/a/ACg8ocJoSNHR7DOfx2W2t_X553rntdzqc6VOHf8zIImUV-Mu1_PX5A=s128-c0x00000000-cc-rp-mo",
    rating: 5,
    relative_time_description: "Hace 5 meses",
    text: "Excelente experiencia. Ya había comprado antes y volví a elegirlos porque la calidad es realmente impecable. Los anteojos multifocales son hermosos y de primera. Destaco especialmente la atención de Matías, siempre amable, claro y profesional. Da gusto encontrar un lugar donde la atención y el producto van de la mano. Sin dudas, un lugar al que siempre dan ganas de volver. ¡Gracias totales!",
    author_url: "https://www.google.com/maps/contrib/104774864567102780209/reviews"
  },
  {
    author_name: "Vale Contreras",
    profile_photo_url: "https://lh3.googleusercontent.com/a/ACg8ocKlvsiphuxNDrTgtk8DwEsr_sZo-MOFipoh9Dj8fWjis2VJttie=s128-c0x00000000-cc-rp-mo",
    rating: 5,
    relative_time_description: "Hace 2 semanas",
    text: "Muy buena atención. Me asesoraron con mucha paciencia para elegir mis anteojos y resolvieron todas mis dudas. El trato fue amable y profesional durante todo el proceso. Quedé muy conforme con el servicio y con el resultado final",
    author_url: "https://www.google.com/maps/contrib/103428301390791156724/reviews"
  },
  {
    author_name: "Angelica Gagliano",
    profile_photo_url: "https://lh3.googleusercontent.com/a/ACg8ocKtMGm-nV0w5T3l2VTHNUoRYxrqpWpeTQoUW4nqjuS5a12sv_0C=s128-c0x00000000-cc-rp-mo",
    rating: 5,
    relative_time_description: "Hace 6 meses",
    text: "Un día, viendo las redes me comuniqué por WhatsApp casi a la hora de cierre y Matías me atendió tomándose todo el tiempo del mundo, con tanta amabilidad y dedicación que esa fue, mi primera buena impresión. Luego fui al local y me sentí especial en cuanto a la atención personalizada. Muchas gracias, estoy muy feliz con mis multifocales fotocromáticos 2x1. Recomiendo 100%",
    author_url: "https://www.google.com/maps/contrib/101181909865280760845/reviews"
  },
  {
    author_name: "Norberto Garone",
    profile_photo_url: "https://lh3.googleusercontent.com/a/ACg8ocLYzzZBjh1AxexVjiNlMYp73CBPQfIkwSSOCQxHBe_7p47gcw=s128-c0x00000000-cc-rp-mo",
    rating: 5,
    relative_time_description: "Hace 5 meses",
    text: "Excelente trabajo y una impecable cordialidad y eficiencia. Atendido con un profesionalismo impecable y considero fue un antes y un después mejorando mi calidad de vida. Gracias Matías!!! Sin dejar de mencionar el excelente precio y calidad de los lentes adquiridos.",
    author_url: "https://www.google.com/maps/contrib/113865402328733115088/reviews"
  }
];

interface ReviewsPageContentProps {
  initialReviews: Review[];
  rating?: number;
  userRatingCount?: number;
}

export function ReviewsPageContent({ 
  initialReviews,
  rating = 5.0,
  userRatingCount = 642
}: ReviewsPageContentProps) {
  // Mostrar únicamente las reseñas reales de Google si están disponibles.
  // Solo usar la lista de fallback si no se cargó ninguna reseña desde la API de Google.
  const displayReviews = initialReviews.length > 0 ? initialReviews : FALLBACK_REVIEWS;

  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filteredReviews = displayReviews.filter(review => {
    if (activeFilter === "all") return true;
    return review.rating === parseInt(activeFilter);
  });

  // Calculate statistics
  const averageRating = rating; // Calificación dinámica desde Google
  const totalReviewsCount = userRatingCount; // Cantidad total dinámica de reseñas desde Google

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="w-full">
      {/* ═══════════════════════════════════════════════ */}
      {/* HEADER HERO DE RESEÑAS                          */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="bg-[#faf8f5] dark:bg-stone-900 border-b border-[#e8e2db] dark:border-stone-800 pt-32 pb-20">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d3b] dark:text-[#c8a55c] mb-3 block">
                Opiniones de la Comunidad
              </span>
              <h1 className=" font-serif">
                Experiencia Atelier
              </h1>
              <p className="text-stone-600 dark:text-stone-300 max-w-xl leading-relaxed text-sm md:text-base">
                La satisfacción y el cuidado visual de nuestros clientes son nuestra máxima prioridad. Conocé las opiniones de quienes ya eligieron Atelier Óptica para sus anteojos.
              </p>
            </div>

            {/* Scorecard Visual Premium */}
            <div className="bg-white dark:bg-stone-950 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm shrink-0 flex flex-col md:flex-row items-center gap-8 md:gap-12 lg:max-w-md">
              <div className="text-center md:text-left">
                <div className="text-6xl font-black text-stone-900 dark:text-white tracking-tight mb-1 flex items-baseline justify-center md:justify-start gap-1">
                  <span>{averageRating.toFixed(1)}</span>
                  <span className="text-xl text-stone-400 dark:text-stone-600 font-normal">/ 5.0</span>
                </div>
                <div className="flex justify-center md:justify-start text-yellow-400 mb-3">
                  {[...Array(5)].map((_, idx) => (
                    <Star key={idx} className="w-5 h-5 fill-current" />
                  ))}
                </div>
                <p className="text-[10px] text-stone-900 dark:text-stone-100 font-black uppercase tracking-[0.15em] mb-1">
                  ★ Calificación Máxima
                </p>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-widest font-medium">
                  {totalReviewsCount} Reseñas en Google
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full md:w-auto">
                <a
                  href="https://www.google.com/maps?cid=14830223812501661125"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-black text-white hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200 text-xs font-black tracking-widest uppercase rounded-full transition-all duration-300 shadow-md shadow-black/10 text-center"
                >
                  Escribir Reseña <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://www.google.com/maps?cid=14830223812501661125"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs font-black text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white uppercase tracking-widest transition-colors py-1"
                >
                  Ver en Google Maps <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* FILTROS E INTERACCIÓN                           */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="bg-white dark:bg-stone-950 py-12 border-b border-stone-100 dark:border-stone-900">
        <div className="max-w-[1200px] mx-auto px-5 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mr-2">Filtrar por:</span>
          {[
            { id: "all", label: "Todas las opiniones" },
            { id: "5", label: "5 Estrellas" },
            { id: "4", label: "4 Estrellas" }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-6 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-300 ${
                activeFilter === filter.id
                  ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
                  : "bg-stone-50 text-stone-600 border border-stone-200/60 hover:bg-stone-100 hover:text-stone-950 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-800 dark:hover:bg-stone-800"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* GRID DE RESEÑAS                                */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="bg-stone-50/50 dark:bg-stone-900/10 py-20 min-h-[400px]">
        <div className="max-w-[1200px] mx-auto px-5">
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            <AnimatePresence mode="popLayout">
              {filteredReviews.map((review, i) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  key={`${review.author_name}-${i}`}
                  className="bg-white dark:bg-stone-950 p-8 rounded-3xl border border-stone-200/60 dark:border-stone-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    {/* Encabezado Autor */}
                    <div className="flex items-center gap-4 mb-6">
                      {review.profile_photo_url ? (
                         
                        <img
                          src={review.profile_photo_url}
                          alt={review.author_name}
                          className="w-12 h-12 rounded-full object-cover bg-stone-100 border border-stone-100 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[#8a6d3b]/10 text-[#8a6d3b] dark:text-[#c8a55c] flex items-center justify-center text-sm font-bold tracking-wider shrink-0 border border-[#8a6d3b]/20">
                          {getInitials(review.author_name)}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-black text-stone-800 dark:text-white tracking-tight">
                          {review.author_name}
                        </h4>
                        <span className="text-xs text-stone-500 dark:text-stone-400 uppercase tracking-widest font-medium">
                          {review.relative_time_description}
                        </span>
                      </div>
                    </div>

                    {/* Estrellas */}
                    <div className="flex text-yellow-400 mb-4">
                      {[...Array(5)].map((_, idx) => (
                        <Star
                          key={idx}
                          className={`w-3.5 h-3.5 ${
                            idx < review.rating ? "fill-current" : "text-stone-200 dark:text-stone-800"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Opinión */}
                    <p className="text-stone-600 dark:text-stone-300 text-sm leading-relaxed font-light italic">
                      &quot;{review.text}&quot;
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-stone-100/60 dark:border-stone-900 flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-xs font-black text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                      <MessageCircle className="w-3 h-3 text-stone-500 dark:text-stone-400" /> Reseña Verificada
                    </span>
                    {review.author_url && (
                      <a
                        href={review.author_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-black text-[#8a6d3b] dark:text-[#c8a55c] hover:text-stone-900 dark:hover:text-white uppercase tracking-widest flex items-center gap-0.5"
                      >
                        Google <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Botón para seguir leyendo opiniones en Google Business */}
          <div className="mt-16 flex justify-center">
            <a
              href="https://www.google.com/maps?cid=14830223812501661125"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white hover:bg-stone-850 dark:bg-white dark:text-black dark:hover:bg-stone-150 text-xs font-black tracking-widest uppercase rounded-full transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105"
            >
              Seguir viendo opiniones en Google Business <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {filteredReviews.length === 0 && (
            <div className="text-center py-20 bg-white dark:bg-stone-950 rounded-3xl border border-stone-200/60 dark:border-stone-800">
              <p className="text-stone-500 dark:text-stone-400 text-sm">No se encontraron reseñas con esta calificación.</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* SECCIÓN CTA FINAL                               */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="bg-stone-900 dark:bg-stone-950 text-white py-24 relative overflow-hidden border-t border-stone-800">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center px-5 relative z-10">
          <h2 className=" font-serif">
            ¿Ya compraste en Atelier?
          </h2>
          <p className="text-stone-400 text-sm md:text-base leading-relaxed mb-10 max-w-xl mx-auto">
            Tu opinión es sumamente valiosa para nosotros y nos ayuda a seguir mejorando día a día. Compartí tu experiencia y ayuda a otros clientes a elegir sus próximos anteojos.
          </p>
          <a
            href="https://www.google.com/maps?cid=14830223812501661125"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-white font-bold py-4 px-10 rounded-full hover:bg-primary/90 transition-all duration-300 shadow-xl shadow-primary/20 text-xs tracking-widest uppercase"
          >
            Dejar Reseña en Google <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
