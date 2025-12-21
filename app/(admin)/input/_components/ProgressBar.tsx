// app/input/components/ProgressBar.tsx

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const percentage = (currentStep / totalSteps) * 100;
  
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] text-gray-500">
          Step {currentStep} out of {totalSteps}
        </span>
        <span className="text-[13px] font-medium text-gray-700">
          {Math.round(percentage)}% complete
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div 
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}