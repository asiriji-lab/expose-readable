"use client";

import { useState } from "react";

export function Step10_Generate({ 
  data, 
  onGenerate 
}: { 
  data: any; 
  onGenerate: () => Promise<void>;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    setStatus("Preparing data...");

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 500);

      setStatus("Generating schedule...");
      await onGenerate();
      
      clearInterval(progressInterval);
      setProgress(100);
      setStatus("Schedule generated successfully!");
      
      setTimeout(() => {
        setIsGenerating(false);
      }, 1500);
    } catch (error) {
      setStatus("Error generating schedule. Please try again.");
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-black">
        Step 10: Generate Schedule
      </h2>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            All data has been collected. Click the button below to generate your schedule.
          </p>

          {isGenerating && (
            <div className="space-y-3">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">{status}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`
              px-8 py-3 rounded-lg font-medium text-white
              transition-all duration-200
              ${isGenerating 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              }
            `}
          >
            {isGenerating ? 'Generating...' : 'Generate Schedule'}
          </button>
        </div>

        {/* Summary of collected data */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-black mb-4">Data Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Curriculum:</span>
              <span className="font-medium text-black">
                {data?.curriculum ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Teachers:</span>
              <span className="font-medium text-black">
                {data?.teachers ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Electives:</span>
              <span className="font-medium text-black">
                {data?.electives ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Scout Activities:</span>
              <span className="font-medium text-black">
                {data?.scout ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Periods:</span>
              <span className="font-medium text-black">
                {data?.periods ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Students:</span>
              <span className="font-medium text-black">
                {data?.students ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Rooms:</span>
              <span className="font-medium text-black">
                {data?.rooms ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Constraints:</span>
              <span className="font-medium text-black">
                {data?.constraints ? '✓ Configured' : '⚠ Missing'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
