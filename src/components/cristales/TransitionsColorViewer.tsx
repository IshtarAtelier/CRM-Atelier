'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const GEN_S_COLORS = [
  { id: 'gris', name: 'Gris', hex: '#404040', labelHex: '#404040' },
  { id: 'marron', name: 'Marrón', hex: '#5c3d2e', labelHex: '#5c3d2e' },
  { id: 'verde', name: 'Verde', hex: '#4a5d23', labelHex: '#4a5d23' },
  { id: 'zafiro', name: 'Zafiro', hex: '#1a5b8f', labelHex: '#1a5b8f' },
  { id: 'amatista', name: 'Amatista', hex: '#7a5a8f', labelHex: '#7a5a8f' },
  { id: 'ambar', name: 'Ámbar', hex: '#c48f29', labelHex: '#c48f29' },
  { id: 'esmeralda', name: 'Esmeralda', hex: '#3b7a5a', labelHex: '#3b7a5a' },
  { id: 'rubi', name: 'Rubí', hex: '#a62e3d', labelHex: '#a62e3d' }
];

export function TransitionsColorViewer() {
  const [activeColor, setActiveColor] = useState(GEN_S_COLORS[0]);
  const [isIndoor, setIsIndoor] = useState(false);

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4 flex flex-col items-center">
      <div className="text-center mb-10">
        <h3 className="text-2xl md:text-3xl font-bold mb-3">Simulador Transitions® GEN S™</h3>
        <p className="text-black/60">Seleccioná un color y descubrí cómo lucen en exteriores e interiores.</p>
      </div>

      {/* Visor interactivo */}
      <div className="relative w-full aspect-video md:aspect-[16/7] bg-[#f5f5f5] rounded-3xl overflow-hidden shadow-inner flex items-center justify-center">
        
        {/* Imagen del anteojo */}
        <div className="relative w-4/5 h-4/5 z-10 pointer-events-none">
          <Image 
            src="/images/cristales/gen-s-frame.jpg" 
            alt="Armazón transparente"
            fill
            className="object-contain"
            priority
          />
          {/* Capa de color usando mix-blend-mode sobre las lentes */}
          <AnimatePresence mode="wait">
            {!isIndoor && (
              <motion.div 
                key={activeColor.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 z-20 mix-blend-multiply"
                style={{ 
                  backgroundColor: activeColor.hex,
                  maskImage: 'radial-gradient(ellipse 26% 35% at 31% 51%, black 100%, transparent 100%), radial-gradient(ellipse 26% 35% at 69% 51%, black 100%, transparent 100%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 26% 35% at 31% 51%, black 100%, transparent 100%), radial-gradient(ellipse 26% 35% at 69% 51%, black 100%, transparent 100%)'
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Toggle Interior/Exterior flotante */}
        <div className="absolute top-6 right-6 z-30 flex items-center gap-3 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-md text-sm font-medium">
          <span className={isIndoor ? 'text-black' : 'text-black/40'}>Interior</span>
          <button 
            onClick={() => setIsIndoor(!isIndoor)}
            className="relative w-12 h-6 bg-gray-200 rounded-full transition-colors duration-300"
            style={{ backgroundColor: isIndoor ? '#e5e7eb' : '#111827' }}
          >
            <div 
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${isIndoor ? 'left-1' : 'translate-x-7'}`}
            />
          </button>
          <span className={!isIndoor ? 'text-black' : 'text-black/40'}>Exterior</span>
        </div>

        {/* Selector de colores inferior */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
          <div className="flex gap-2 p-3 bg-white/90 backdrop-blur-xl rounded-full shadow-lg">
            {GEN_S_COLORS.map((color) => (
              <button
                key={color.id}
                onClick={() => {
                  setActiveColor(color);
                  setIsIndoor(false); // Al cambiar de color, mostramos el exterior para que se vea el efecto
                }}
                className={`relative w-8 h-8 rounded-full transition-all duration-300 ${activeColor.id === color.id ? 'scale-125 shadow-md' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                style={{ backgroundColor: color.labelHex }}
                title={color.name}
              />
            ))}
          </div>
          <div className="mt-4 px-4 py-1.5 bg-black/80 text-white rounded-full text-sm font-medium tracking-wide">
            {activeColor.name.toUpperCase()}
          </div>
        </div>

      </div>
    </div>
  );
}
