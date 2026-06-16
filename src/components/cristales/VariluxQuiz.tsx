"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, RotateCcw, CheckCircle2 } from "lucide-react";

type Question = {
  id: string;
  title: string;
  options: {
    label: string;
    value: string;
    points: Record<string, number>;
  }[];
};

const QUESTIONS: Question[] = [
  {
    id: "screens",
    title: "¿Cuántas horas al día pasás frente a pantallas (PC, celular, tablet)?",
    options: [
      { label: "Más de 7 horas (Perfil hiperconectado)", value: "high", points: { xr: 3, comfort: 2, physio: 1, liberty: 0 } },
      { label: "Entre 3 y 7 horas (Perfil intermedio)", value: "med", points: { comfort: 3, physio: 2, xr: 1, liberty: 1 } },
      { label: "Menos de 3 horas (Perfil análogo)", value: "low", points: { liberty: 3, physio: 2, comfort: 1, xr: 0 } },
    ]
  },
  {
    id: "driving",
    title: "¿Manejás de noche o te molesta el encandilamiento de los autos?",
    options: [
      { label: "Sí, manejo de noche y me cuesta enfocar rápido", value: "yes", points: { physio: 3, xr: 2, liberty: 1, comfort: 0 } },
      { label: "Ocasionalmente, pero no es mi mayor problema", value: "sometimes", points: { comfort: 2, physio: 2, xr: 1, liberty: 1 } },
      { label: "Casi nunca manejo de noche", value: "no", points: { comfort: 2, liberty: 2, xr: 1, physio: 0 } },
    ]
  },
  {
    id: "dynamic",
    title: "¿Cómo es la dinámica de tu día a día?",
    options: [
      { label: "Constante movimiento: múltiples tareas a la vez", value: "active", points: { xr: 4, physio: 2, comfort: 1, liberty: 0 } },
      { label: "Trabajo de escritorio: horas en la misma postura", value: "static", points: { comfort: 4, xr: 1, physio: 1, liberty: 1 } },
      { label: "Relajado: uso básico para leer o ver la TV", value: "relaxed", points: { liberty: 4, comfort: 1, physio: 1, xr: 0 } },
    ]
  }
];

const RESULTS_CONTENT = {
  xr: {
    name: "Varilux XR Series™",
    description: "Tu perfil es altamente dinámico y digital. Necesitás la máxima tecnología predictiva con IA para seguir tu ritmo visual sin mareos y con la máxima amplitud de campo.",
    color: "bg-purple-50 text-purple-900 border-purple-200"
  },
  physio: {
    name: "Varilux Physio 3.0",
    description: "Priorizás el alto contraste y la nitidez en situaciones exigentes como el manejo nocturno. El mapeo pupilar de Physio te dará esa seguridad extra.",
    color: "bg-emerald-50 text-emerald-900 border-emerald-200"
  },
  comfort: {
    name: "Varilux Comfort Max",
    description: "Pasás mucho tiempo en posturas fijas frente a pantallas. Comfort Max ampliará tu zona de tolerancia postural para que termines el día sin dolor de cuello.",
    color: "bg-blue-50 text-blue-900 border-blue-200"
  },
  liberty: {
    name: "Varilux Liberty 3.0",
    description: "Tenés un estilo de vida más relajado que no exige transiciones extremas constantes. Liberty te dará visión nítida a todas las distancias con excelente valor.",
    color: "bg-green-50 text-green-900 border-green-200"
  }
};

export function VariluxQuiz() {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState({ xr: 0, physio: 0, comfort: 0, liberty: 0 });
  const [result, setResult] = useState<keyof typeof RESULTS_CONTENT | null>(null);

  const handleSelect = (points: Record<string, number>) => {
    const newScores = {
      xr: scores.xr + (points.xr || 0),
      physio: scores.physio + (points.physio || 0),
      comfort: scores.comfort + (points.comfort || 0),
      liberty: scores.liberty + (points.liberty || 0),
    };
    
    setScores(newScores);

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      // Calculate winner
      const winner = Object.keys(newScores).reduce((a, b) => newScores[a as keyof typeof newScores] > newScores[b as keyof typeof newScores] ? a : b) as keyof typeof RESULTS_CONTENT;
      setResult(winner);
      setStep(step + 1);
    }
  };

  const resetQuiz = () => {
    setStep(0);
    setScores({ xr: 0, physio: 0, comfort: 0, liberty: 0 });
    setResult(null);
  };

  return (
    <section className="w-full max-w-3xl mx-auto py-16 px-6">
      <div className="bg-white rounded-3xl border border-[#e8e2db] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#111] text-white p-8 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2 block">
            Recomendador Interactivo
          </span>
          <h3 className="text-2xl font-serif">Descubrí tu Varilux Ideal</h3>
          <p className="text-white/70 text-sm mt-2 max-w-md mx-auto">
            Respondé 3 simples preguntas sobre tu estilo de vida y descubrí qué tecnología se adapta mejor a tu rutina visual.
          </p>
        </div>

        {/* Content */}
        <div className="p-8 md:p-12 min-h-[350px] flex flex-col justify-center relative bg-[#faf8f5]">
          <AnimatePresence mode="wait">
            {step < QUESTIONS.length ? (
              <motion.div
                key={`q-${step}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <div className="flex items-center justify-between mb-8">
                  <span className="text-sm font-bold text-[#111]">Pregunta {step + 1} de {QUESTIONS.length}</span>
                  <div className="flex gap-1">
                    {QUESTIONS.map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= step ? 'w-6 bg-[#111]' : 'w-2 bg-black/10'}`} />
                    ))}
                  </div>
                </div>

                <h4 className="text-xl md:text-2xl font-medium mb-8 text-[#111]">
                  {QUESTIONS[step].title}
                </h4>

                <div className="space-y-3">
                  {QUESTIONS[step].options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelect(option.points)}
                      className="w-full text-left p-4 rounded-xl border border-black/10 hover:border-[#111] hover:shadow-md bg-white transition-all flex items-center justify-between group"
                    >
                      <span className="text-[#111] font-medium">{option.label}</span>
                      <ArrowRight className="w-4 h-4 text-black/30 group-hover:text-[#111] transition-colors translate-x-0 group-hover:translate-x-1" />
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                {result && (
                  <>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-6">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-black/40 mb-2">
                      Tu Recomendación Ideal
                    </h4>
                    
                    <div className={`mt-4 mb-8 p-6 rounded-2xl border ${RESULTS_CONTENT[result].color}`}>
                      <h5 className="text-2xl font-bold mb-3">{RESULTS_CONTENT[result].name}</h5>
                      <p className="text-sm opacity-90 leading-relaxed max-w-md mx-auto">
                        {RESULTS_CONTENT[result].description}
                      </p>
                    </div>

                    <button
                      onClick={resetQuiz}
                      className="inline-flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest text-black/40 hover:text-[#111] transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" /> Rehacer el test
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
