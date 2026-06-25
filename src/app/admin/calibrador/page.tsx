import React from 'react';
import OpticalCalibrator from '@/components/admin/calibrador/OpticalCalibrator';
import { Camera, AlertCircle } from 'lucide-react';

export default function CalibradorPage() {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Camera className="w-8 h-8 text-blue-600" />
          Calibrador Óptico Digital
        </h1>
        <p className="text-gray-500 mt-2">
          Herramienta para calcular Distancia Pupilar (DP) y Altura de Montaje a partir de una fotografía, 
          utilizando el método de la tarjeta magnética.
        </p>
      </div>

      <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-4">
        <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-amber-900">Requisitos para una medición exacta:</h3>
          <ul className="list-disc list-inside text-sm text-amber-800 mt-1 space-y-1">
            <li>El paciente debe estar mirando <strong>fijamente al lente</strong> de la cámara (no a la pantalla).</li>
            <li>La foto debe tomarse con <strong>Flash activado</strong> para generar el reflejo corneal.</li>
            <li>El dispositivo debe sostenerse <strong>exactamente a la altura de los ojos</strong> (sin inclinar arriba o abajo).</li>
            <li>El paciente debe sostener una tarjeta de tamaño estándar (85.6 mm) apoyada plana en la frente.</li>
            <li>Debe tener puesto el armazón final ajustado en su posición natural.</li>
          </ul>
        </div>
      </div>

      <OpticalCalibrator />
    </div>
  );
}
