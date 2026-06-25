'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RotateCcw, Check, MoveRight, Eye } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface Measurements {
  scaleLeft: Point | null;
  scaleRight: Point | null;
  pupilRight: Point | null; // Paciente's right eye (left side of image usually)
  pupilLeft: Point | null;  // Paciente's left eye (right side of image usually)
  frameRight: Point | null;
  frameLeft: Point | null;
}

type Step = 'upload' | 'scaleLeft' | 'scaleRight' | 'pupilRight' | 'pupilLeft' | 'frameRight' | 'frameLeft' | 'done';

const CARD_WIDTH_MM = 85.6;

export default function OpticalCalibrator() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [measurements, setMeasurements] = useState<Measurements>({
    scaleLeft: null,
    scaleRight: null,
    pupilRight: null,
    pupilLeft: null,
    frameRight: null,
    frameLeft: null,
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setImageObj(img);
        setCurrentStep('scaleLeft');
      };
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageObj || !containerRef.current) return;

    // Set canvas dimensions to fit container while maintaining aspect ratio
    const containerWidth = containerRef.current.clientWidth;
    const scale = containerWidth / imageObj.width;
    const canvasWidth = containerWidth;
    const canvasHeight = imageObj.height * scale;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    // Draw image
    ctx.drawImage(imageObj, 0, 0, canvasWidth, canvasHeight);

    // Draw markers
    const drawCrosshair = (p: Point, color: string, label: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.moveTo(p.x - 10, p.y);
      ctx.lineTo(p.x + 10, p.y);
      ctx.moveTo(p.x, p.y - 10);
      ctx.lineTo(p.x, p.y + 10);
      ctx.stroke();
      
      // Outer circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = '12px sans-serif';
      ctx.fillText(label, p.x + 15, p.y - 5);
    };

    if (measurements.scaleLeft) drawCrosshair(measurements.scaleLeft, '#22c55e', 'Tarjeta Izq');
    if (measurements.scaleRight) drawCrosshair(measurements.scaleRight, '#22c55e', 'Tarjeta Der');
    
    if (measurements.scaleLeft && measurements.scaleRight) {
      ctx.beginPath();
      ctx.strokeStyle = '#22c55e';
      ctx.moveTo(measurements.scaleLeft.x, measurements.scaleLeft.y);
      ctx.lineTo(measurements.scaleRight.x, measurements.scaleRight.y);
      ctx.stroke();
    }

    if (measurements.pupilRight) drawCrosshair(measurements.pupilRight, '#3b82f6', 'Pupila Der');
    if (measurements.pupilLeft) drawCrosshair(measurements.pupilLeft, '#3b82f6', 'Pupila Izq');
    
    if (measurements.pupilRight && measurements.pupilLeft) {
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.setLineDash([5, 5]);
      ctx.moveTo(measurements.pupilRight.x, measurements.pupilRight.y);
      ctx.lineTo(measurements.pupilLeft.x, measurements.pupilLeft.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (measurements.frameRight) drawCrosshair(measurements.frameRight, '#ef4444', 'Armazón Der');
    if (measurements.frameLeft) drawCrosshair(measurements.frameLeft, '#ef4444', 'Armazón Izq');

    // Draw vertical height lines
    if (measurements.pupilRight && measurements.frameRight) {
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.moveTo(measurements.pupilRight.x, measurements.pupilRight.y);
      ctx.lineTo(measurements.pupilRight.x, measurements.frameRight.y);
      ctx.stroke();
    }
    if (measurements.pupilLeft && measurements.frameLeft) {
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.moveTo(measurements.pupilLeft.x, measurements.pupilLeft.y);
      ctx.lineTo(measurements.pupilLeft.x, measurements.frameLeft.y);
      ctx.stroke();
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [imageObj, measurements, currentStep]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentStep === 'upload' || currentStep === 'done') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const point = { x, y };

    setMeasurements(prev => {
      const next = { ...prev, [currentStep]: point };
      return next;
    });

    // Advance step
    const stepOrder: Step[] = ['scaleLeft', 'scaleRight', 'pupilRight', 'pupilLeft', 'frameRight', 'frameLeft', 'done'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const reset = () => {
    setMeasurements({
      scaleLeft: null,
      scaleRight: null,
      pupilRight: null,
      pupilLeft: null,
      frameRight: null,
      frameLeft: null,
    });
    setCurrentStep('scaleLeft');
  };

  const getDistance = (p1: Point | null, p2: Point | null) => {
    if (!p1 || !p2) return 0;
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const calculateResults = () => {
    if (currentStep !== 'done') return null;

    const scalePx = getDistance(measurements.scaleLeft, measurements.scaleRight);
    if (scalePx === 0) return null;

    const mmPerPx = CARD_WIDTH_MM / scalePx;

    const dpTotal = getDistance(measurements.pupilRight, measurements.pupilLeft) * mmPerPx;
    
    // Altura es distancia vertical (Y)
    const heightRight = measurements.pupilRight && measurements.frameRight 
      ? Math.abs(measurements.frameRight.y - measurements.pupilRight.y) * mmPerPx 
      : 0;
      
    const heightLeft = measurements.pupilLeft && measurements.frameLeft 
      ? Math.abs(measurements.frameLeft.y - measurements.pupilLeft.y) * mmPerPx 
      : 0;

    return {
      dpTotal: dpTotal.toFixed(1),
      heightRight: heightRight.toFixed(1),
      heightLeft: heightLeft.toFixed(1),
    };
  };

  const results = calculateResults();

  const stepInstructions: Record<Step, string> = {
    upload: 'Sube o toma una foto',
    scaleLeft: 'Haz clic en el borde IZQUIERDO de la tarjeta',
    scaleRight: 'Haz clic en el borde DERECHO de la tarjeta',
    pupilRight: 'Haz clic en la pupila DERECHA del paciente (reflejo flash)',
    pupilLeft: 'Haz clic en la pupila IZQUIERDA del paciente (reflejo flash)',
    frameRight: 'Haz clic en el borde inferior del armazón DERECHO',
    frameLeft: 'Haz clic en el borde inferior del armazón IZQUIERDO',
    done: 'Cálculo completado',
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4">
      {/* Left Column - Image & Canvas */}
      <div className="flex-1 border rounded-lg bg-gray-50 p-4" ref={containerRef}>
        {!imageSrc ? (
          <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-white">
            <label className="cursor-pointer flex flex-col items-center gap-4 hover:text-blue-600 transition-colors">
              <div className="flex gap-4">
                <div className="p-4 bg-gray-100 rounded-full flex flex-col items-center gap-2">
                  <Camera size={32} />
                  <span className="text-sm font-medium">Cámara</span>
                </div>
                <div className="p-4 bg-gray-100 rounded-full flex flex-col items-center gap-2">
                  <Upload size={32} />
                  <span className="text-sm font-medium">Subir</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 font-medium">Toma una foto o súbela desde tu galería</p>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                className="hidden" 
                onChange={handleImageUpload} 
              />
            </label>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden flex justify-center">
            <canvas 
              ref={canvasRef} 
              onClick={handleCanvasClick}
              className={`cursor-crosshair border rounded shadow-sm ${currentStep !== 'done' ? 'hover:opacity-90' : ''}`}
            />
          </div>
        )}
      </div>

      {/* Right Column - Instructions & Results */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Guía de Medición
          </h2>
          
          <div className="p-4 rounded-md bg-blue-50 border border-blue-100 text-blue-800 font-medium text-sm mb-6 shadow-inner">
            Paso actual: {stepInstructions[currentStep]}
          </div>

          <div className="space-y-3">
            {[
              { id: 'scaleRight', label: 'Escala de Tarjeta', color: 'bg-green-500' },
              { id: 'pupilLeft', label: 'Distancia Pupilar', color: 'bg-blue-500' },
              { id: 'frameLeft', label: 'Altura Armazón', color: 'bg-red-500' },
            ].map(step => {
              const order = ['scaleRight', 'pupilLeft', 'frameLeft'];
              const currentIdx = order.indexOf(currentStep as string);
              const stepIdx = order.indexOf(step.id);
              const isDone = currentStep === 'done' || stepIdx < currentIdx;
              const isActive = step.id.includes(currentStep.replace(/(Left|Right)/, ''));

              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${isDone ? step.color : 'bg-gray-200'}`}>
                    {isDone && <Check size={14} />}
                  </div>
                  <span className={`text-sm ${isDone ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {currentStep !== 'upload' && currentStep !== 'done' && (
            <button 
              onClick={reset}
              className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              <RotateCcw size={16} /> Reiniciar marcadores
            </button>
          )}

          {currentStep === 'done' && (
            <button 
              onClick={() => { setImageSrc(null); setCurrentStep('upload'); reset(); }}
              className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              <Upload size={16} /> Subir nueva foto
            </button>
          )}
        </div>

        {results && (
          <div className="bg-gray-900 text-white p-5 rounded-lg border shadow-lg animate-in fade-in slide-in-from-bottom-4">
            <h3 className="font-semibold text-gray-200 mb-4 border-b border-gray-700 pb-2">Resultados Finales</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Distancia Pupilar Total</p>
                <p className="text-3xl font-bold text-blue-400">{results.dpTotal} <span className="text-sm font-normal text-gray-500">mm</span></p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs text-gray-400">Altura Ojo Derecho</p>
                  <p className="text-xl font-bold text-red-400">{results.heightRight} <span className="text-xs font-normal text-gray-500">mm</span></p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Altura Ojo Izq</p>
                  <p className="text-xl font-bold text-red-400">{results.heightLeft} <span className="text-xs font-normal text-gray-500">mm</span></p>
                </div>
              </div>
            </div>
            <button className="mt-6 w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2">
              Guardar en Pedido <MoveRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
