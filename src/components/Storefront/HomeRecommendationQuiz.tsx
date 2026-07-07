"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, RefreshCw, Send, ArrowRight } from "lucide-react";
import { WHATSAPP_PHONE } from "@/lib/constants";
import Link from "next/link";

interface Question {
  id: number;
  text: string;
  options: {
    label: string;
    value: string;
    icon: string;
  }[];
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "¿Para qué vas a usar tus anteojos?",
    options: [
      { label: "Uso diario (Multifocal)", value: "Multifocal / Todo el día", icon: "👓" },
      { label: "Trabajar / Pantallas (Filtro Azul)", value: "Filtro Azul / Pantallas", icon: "💻" },
      { label: "Protección Solar y Estilo", value: "Protección Solar", icon: "☀️" },
      { label: "Lectura (Ver de Cerca)", value: "Cerca / Lectura", icon: "📖" },
      { label: "Manejar (Ver de Lejos)", value: "Lejos / Manejo", icon: "🚗" }
    ]
  },
  {
    id: 2,
    text: "¿Usás lentes actualmente?",
    options: [
      { label: "Sí, de Receta", value: "Uso de receta", icon: "👓" },
      { label: "Sí, de Sol", value: "Uso de sol", icon: "🕶️" },
      { label: "No, sería mi primer par", value: "No uso lentes", icon: "✨" }
    ]
  },
  {
    id: 3,
    text: "¿Qué estilo de marcos te gusta más?",
    options: [
      { label: "Acetato (Gruesos y Clásicos)", value: "Acetato", icon: "🖤" },
      { label: "Metal (Finos y Minimalistas)", value: "Metal", icon: "💛" },
      { label: "Marcos Grandes (Estilo XL)", value: "XL", icon: "💫" }
    ]
  }
];

export function HomeRecommendationQuiz() {
  const [step, setStep] = useState(0); // 0 = start, 1, 2, 3 = questions, 4 = result
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const handleSelectOption = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    // Auto advance after short delay
    setTimeout(() => {
      setStep(prev => prev + 1);
    }, 300);
  };

  const resetQuiz = () => {
    setAnswers({});
    setStep(1);
  };

  const getRecommendation = () => {
    const purpose = answers[1];
    const material = answers[3];

    let title = "Recomendamos: Anteojos de Receta de Diseño";
    let desc = "Basado en tu uso y preferencia, un armazón de receta Atelier con protección antirreflejo es ideal para vos.";
    let link = "/receta";
    let linkLabel = "Ver Anteojos de Receta";

    if (purpose === "Protección Solar") {
      title = "Recomendamos: Colección de Sol Atelier";
      desc = "Elegí protección UV400 premium con la mejor estética italiana de nuestra colección de sol.";
      link = "/lentes-de-sol";
      linkLabel = "Ver Lentes de Sol";
    } else if (material === "Metal") {
      title = "Recomendamos: Marcos de Metal Minimalistas";
      desc = "Nuestra línea de metal ultraliviana y pulida es perfecta para darte comodidad todo el día.";
      link = "/tienda?material=Metal";
      linkLabel = "Ver Colección de Metal";
    } else if (material === "XL") {
      title = "Recomendamos: Marcos Estilo XL Moderno";
      desc = "Destacá tu mirada con anteojos de presencia fuerte y diseño geométrico XL.";
      link = "/tienda?forma=XL";
      linkLabel = "Ver Colección XL";
    } else if (material === "Acetato") {
      title = "Recomendamos: Colección de Acetato Premium";
      desc = "Armazones de acetato italiano de alta densidad, pulidos a mano y con colores orgánicos únicos.";
      link = "/tienda?material=Acetato";
      linkLabel = "Ver Colección de Acetato";
    }

    return { title, desc, link, linkLabel };
  };

  const getWhatsAppLink = () => {
    const summary = `¡Hola Atelier! Hice el recomendador de lentes en la web y mis respuestas fueron:
- Uso principal: ${answers[1]}
- ¿Usa lentes actualmente?: ${answers[2]}
- Estilo preferido: ${answers[3]}
¿Qué modelos me recomiendan?`;
    
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(summary)}`;
  };

  const currentQuestion = QUESTIONS[step - 1];

  return (
    <section className="w-full bg-stone-50 py-24 border-t border-[#e8e2db]/35">
      <div className="max-w-2xl mx-auto px-6 text-center">
        
        <AnimatePresence mode="wait">
          {/* STEP 0: START VIEW */}
          {step === 0 && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8a6d3b]">Recomendador Inteligente</p>
              <h2 className="text-3xl md:text-4xl font-serif text-stone-900 font-light">¿Buscás tus anteojos ideales?</h2>
              <p className="text-stone-500 text-sm font-light leading-relaxed max-w-md mx-auto">
                Respondé 3 preguntas rápidas y te ayudaremos a elegir los marcos y cristales perfectos para tu estilo de vida.
              </p>
              <button
                onClick={() => setStep(1)}
                className="mt-4 px-10 py-4 bg-black text-white text-[11px] font-bold uppercase tracking-[0.2em] rounded-full hover:bg-stone-800 transition-colors shadow-md inline-flex items-center gap-2 group"
              >
                Comenzar Test <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </motion.div>
          )}

          {/* STEP 1-3: QUESTIONS */}
          {step >= 1 && step <= 3 && currentQuestion && (
            <motion.div
              key={`q-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Progress */}
              <div className="flex justify-between items-center max-w-xs mx-auto text-stone-500 text-xs font-mono tracking-widest uppercase">
                <button 
                  onClick={() => setStep(prev => prev - 1)}
                  className="flex items-center gap-1 hover:text-black transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Atrás
                </button>
                <span>Paso {step} de 3</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-serif text-stone-900 font-light px-2">
                {currentQuestion.text}
              </h2>

              <div className="flex flex-col gap-3 max-w-md mx-auto pt-2">
                {currentQuestion.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelectOption(currentQuestion.id, opt.value)}
                    className="flex items-center justify-between px-6 py-4 bg-white border border-stone-200 rounded-2xl hover:border-black hover:shadow-sm text-left transition-all group cursor-pointer"
                  >
                    <span className="flex items-center gap-3.5 text-xs font-semibold text-stone-850">
                      <span className="text-lg bg-stone-50 p-2 rounded-xl group-hover:bg-amber-50 transition-colors">{opt.icon}</span>
                      {opt.label}
                    </span>
                    <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-black group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 4: RESULT VIEW */}
          {step === 4 && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8a6d3b]">Tu Recomendación Personalizada</p>
              
              <div className="bg-white border border-stone-200/60 p-8 rounded-3xl shadow-sm max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-2xl">
                  ✨
                </div>
                <h3 className="text-lg font-serif font-bold text-stone-900 leading-tight">
                  {getRecommendation().title}
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed font-light">
                  {getRecommendation().desc}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <Link
                  href={getRecommendation().link}
                  className="flex-1 px-8 py-4 bg-black text-white text-[11px] font-bold uppercase tracking-[0.2em] rounded-full hover:bg-stone-800 transition-colors shadow-md text-center inline-block"
                >
                  {getRecommendation().linkLabel}
                </Link>
                <a
                  href={getWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-8 py-4 border border-stone-200 bg-white text-stone-700 text-[11px] font-bold uppercase tracking-[0.2em] rounded-full hover:border-black hover:text-black transition-colors text-center inline-flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Consultar por WhatsApp
                </a>
              </div>

              <button
                onClick={resetQuiz}
                className="text-xs font-black uppercase tracking-wider text-stone-500 hover:text-black transition-colors flex items-center gap-1.5 mx-auto pt-4 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Repetir Test
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
}
