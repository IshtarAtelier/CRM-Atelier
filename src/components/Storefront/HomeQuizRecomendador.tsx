"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, ChevronRight, RotateCcw, ArrowRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_PHONE } from "@/lib/constants";

interface QuizState {
  step: number; // 0 = Intro, 1 = Need, 2 = Current, 3 = Style, 4 = Result
  answers: {
    need: string;
    current: string;
    style: string;
  };
}

export function HomeQuizRecomendador() {
  const [quiz, setQuiz] = useState<QuizState>({
    step: 0,
    answers: {
      need: "",
      current: "",
      style: ""
    }
  });

  const stepsInfo = [
    {
      title: "¿Para qué los necesitás?",
      field: "need",
      options: [
        { label: "Ver de cerca y/o lejos (Receta)", val: "Recetados para ver bien" },
        { label: "Protección solar y aire libre (Sol)", val: "Lentes de sol con protección UV" },
        { label: "Descanso y pantallas (Filtro Azul)", val: "Protección de pantallas (Blue Light)" }
      ]
    },
    {
      title: "¿Usás lentes actualmente?",
      field: "current",
      options: [
        { label: "No uso lentes actualmente", val: "No uso lentes" },
        { label: "Sí, uso lentes monofocales", val: "Uso lentes monofocales" },
        { label: "Sí, uso lentes multifocales", val: "Uso lentes multifocales (de cerca y lejos)" }
      ]
    },
    {
      title: "¿Qué estilo de marco preferís?",
      field: "style",
      options: [
        { label: "Acetato Premium (Gruesos y llamativos)", val: "Marcos de Acetato Italiano" },
        { label: "Metal Elegante (Finos, livianos y clásicos)", val: "Marcos de Metal ultralivianos" },
        { label: "Marcos XL / Diseños Oversized", val: "Marcos XL / Diseños Grandes" }
      ]
    }
  ];

  const handleStart = () => {
    setQuiz(prev => ({ ...prev, step: 1 }));
  };

  const handleSelect = (field: "need" | "current" | "style", value: string) => {
    setQuiz(prev => {
      const nextStep = prev.step + 1;
      return {
        step: nextStep,
        answers: {
          ...prev.answers,
          [field]: value
        }
      };
    });
  };

  const handleRestart = () => {
    setQuiz({
      step: 0,
      answers: { need: "", current: "", style: "" }
    });
  };

  const currentStepInfo = stepsInfo[quiz.step - 1];

  // Calculate recommendation profile
  const getProfile = () => {
    const { need, style } = quiz.answers;
    let recCategory = "Receta";
    if (need.includes("sol")) recCategory = "Sol";
    
    let recStyleText = "marcos clásicos de diseño";
    if (style.includes("Acetato")) recStyleText = "armazones gruesos de acetato italiano de alta densidad";
    if (style.includes("Metal")) recStyleText = "monturas finas de metal con detalles de precisión";
    if (style.includes("XL")) recStyleText = "modelos XL que destacan la fisionomía y la mirada";

    return {
      category: recCategory,
      styleText: recStyleText,
      url: recCategory === "Sol" ? "/lentes-de-sol" : "/receta"
    };
  };

  const profile = quiz.step === 4 ? getProfile() : null;

  const whatsappMessage = profile
    ? encodeURIComponent(
        `¡Hola Atelier! Acabo de completar el Recomendador Visual en su web. Este es mi perfil:\n\n` +
        `• Uso principal: ${quiz.answers.need}\n` +
        `• Lentes actuales: ${quiz.answers.current}\n` +
        `• Estilo preferido: ${quiz.answers.style}\n\n` +
        `¿Qué modelos me recomiendan para mi perfil?`
      )
    : "";

  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${whatsappMessage}`;

  return (
    <section className="w-full bg-[#faf8f5] py-24 border-t border-b border-[#e8e2db]/35 overflow-hidden">
      <div className="max-w-3xl mx-auto px-6 text-center relative">
        
        {/* Step Indicator */}
        {quiz.step > 0 && quiz.step < 4 && (
          <div className="flex justify-center items-center gap-1.5 mb-8">
            {[1, 2, 3].map(s => (
              <div 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  quiz.step === s ? "w-8 bg-black" : "w-2 bg-stone-200"
                }`}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 0: INTRO */}
          {quiz.step === 0 && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div className="flex justify-center">
                <div className="w-12 h-12 bg-white border border-[#e8e2db]/50 flex items-center justify-center rounded-full shadow-sm">
                  <HelpCircle className="w-5 h-5 text-[#b08f4c]" />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#b08f4c]">Visual Assistant</p>
                <h2 
                  className="text-3xl md:text-5xl font-light tracking-tight text-stone-900 leading-tight"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  Encontrá tu anteojo ideal en 30 segundos
                </h2>
                <p className="text-xs sm:text-sm font-light text-stone-500 max-w-lg mx-auto leading-relaxed">
                  Respondé 3 simples preguntas sobre tu salud visual y tus preferencias estéticas, y te recomendaremos el modelo perfecto para tu rostro.
                </p>
              </div>

              <div>
                <button
                  onClick={handleStart}
                  className="inline-flex items-center gap-2 px-10 py-4 bg-black text-white text-[11px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors rounded-full shadow-md cursor-pointer"
                >
                  Comenzar Asistente <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 1, 2, 3: QUESTIONS */}
          {quiz.step > 0 && quiz.step < 4 && currentStepInfo && (
            <motion.div
              key={`step-${quiz.step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Pregunta {quiz.step} de 3</p>
                <h2 
                  className="text-2xl md:text-3.5xl font-light tracking-tight text-stone-900"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  {currentStepInfo.title}
                </h2>
              </div>

              <div className="max-w-md mx-auto flex flex-col gap-3">
                {currentStepInfo.options.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => handleSelect(currentStepInfo.field as any, opt.val)}
                    className="w-full text-left px-6 py-4.5 bg-white border border-stone-200 hover:border-black rounded-2xl text-xs font-semibold text-stone-800 transition-all shadow-sm hover:shadow-md cursor-pointer"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 4: RESULTS */}
          {quiz.step === 4 && profile && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#b08f4c]">Perfil Visual Calculado</p>
                <h2 
                  className="text-3xl md:text-4.5xl font-light tracking-tight text-stone-900"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  Tu recomendación: Colección {profile.category}
                </h2>
                <p className="text-xs sm:text-sm font-light text-stone-500 max-w-lg mx-auto leading-relaxed">
                  Basado en tus respuestas, te recomendamos buscar en nuestra línea de <strong>{profile.category === 'Sol' ? 'Anteojos de Sol' : 'Marcos de Receta'}</strong>, priorizando {profile.styleText}.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="max-w-md mx-auto flex flex-col gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-green-600 hover:bg-green-500 text-white py-4.5 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 rounded-full shadow-lg cursor-pointer"
                >
                  <WhatsAppIcon className="w-4 h-4 fill-white" /> Enviar Perfil a un Óptico
                </a>
                
                <div className="flex gap-2">
                  <a
                    href={profile.url}
                    className="flex-1 bg-black hover:bg-stone-800 text-white py-3.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-full flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Ver Catálogo <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={handleRestart}
                    className="px-5 border border-stone-200 text-stone-500 hover:text-black rounded-full hover:border-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Reiniciar quiz"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> <span className="text-[9px] font-black uppercase tracking-widest">Repetir</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
}
