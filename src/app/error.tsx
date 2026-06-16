'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          ¡Ups! Algo salió mal
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Ha ocurrido un error inesperado. Por favor, intenta de nuevo o contacta a soporte si el problema persiste.
        </p>
        <button
          onClick={() => reset()}
          className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Intentar nuevamente
        </button>
      </div>
    </div>
  );
}
