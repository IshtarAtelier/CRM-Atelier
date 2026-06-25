"use client";

import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";

interface Props {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
}

export function Interactive3DImage({ src, alt, className = "", imageClassName = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  
  // Posiciones del mouse
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Springs para suavizar la animación
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  // Transformar coordenadas del mouse a grados de rotación (max 15 grados)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);
  
  // Transformar coordenadas a un ligero desplazamiento para el brillo/sombra
  const translateX = useTransform(mouseXSpring, [-0.5, 0.5], ["-5%", "5%"]);
  const translateY = useTransform(mouseYSpring, [-0.5, 0.5], ["-5%", "5%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Calcular posición del mouse relativa al centro (de -0.5 a 0.5)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (!src) return null;

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative cursor-crosshair [perspective:1000px] ${className}`}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="w-full h-full relative"
      >
        <motion.div 
          style={{ x: translateX, y: translateY, translateZ: 50 }}
          className="w-full h-full relative z-10 isolate"
        >
          <Image unoptimized 
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            style={{ objectFit: "contain", transform: "translateZ(0)" }}
            className={`mix-blend-multiply ${imageClassName}`}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
