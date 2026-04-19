'use client';

interface ProgressBarProps {
  completedStepsCount: number;
  totalSteps: number;
}

export default function ProgressBar({ completedStepsCount, totalSteps }: ProgressBarProps) {
  const percentage = Math.round((completedStepsCount / totalSteps) * 100);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-1.5 text-sm text-gray-500">
        <span>{completedStepsCount} of {totalSteps} steps completed</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
