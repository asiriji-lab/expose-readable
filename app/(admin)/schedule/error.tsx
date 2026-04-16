'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-8 border-2 border-dashed border-red-200 rounded-xl bg-red-50 text-red-700 min-h-[400px]">
      <AlertCircle className="w-12 h-12 mb-4" />
      <h2 className="text-xl font-bold mb-2">Schedule UI Crashed</h2>
      <p className="text-sm text-center max-w-md mb-6">
        {error.message || 'An unexpected error occurred while rendering the schedule grid.'}
      </p>
      <button
        onClick={() => reset()}
        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
      >
        Recover Session
      </button>
    </div>
  );
}
