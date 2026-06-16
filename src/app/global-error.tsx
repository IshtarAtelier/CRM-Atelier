'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Error Crítico
            </h2>
            <p className="text-gray-600 mb-6">
              Ha ocurrido un error a nivel de aplicación. Por favor recarga la página.
            </p>
            <button
              onClick={() => reset()}
              className="bg-black text-white px-4 py-2 rounded"
            >
              Recargar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
