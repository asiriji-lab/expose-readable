// app/input/components/Stepper.tsx

interface StepperProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

const STEPS = [
  { id: 1, name: 'Curriculum', icon: '📘' },
  { id: 2, name: 'Teacher', icon: '👥' },
  { id: 3, name: 'Elective', icon: '📚' },
  { id: 4, name: 'Scout', icon: '🎯' },
  { id: 5, name: 'Period', icon: '⏰' },
  { id: 6, name: 'Student', icon: '👨‍🎓' },
  { id: 7, name: 'Room', icon: '🏫' },
  { id: 8, name: 'Constraint', icon: '⚙️' },
  { id: 9, name: 'Related files', icon: '📎' },
  { id: 10, name: 'Generate', icon: '✨' },
];

export default function Stepper({ currentStep, completedSteps, onStepClick }: StepperProps) {
  return (
    <aside className="w-[360px] bg-white border-r border-gray-200 min-h-screen p-8">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-6">
        SETUP STEP
      </h3>
      
      <div className="space-y-1">
        {STEPS.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isUpcoming = step.id > currentStep && !isCompleted;
          const isClickable = isCompleted || step.id === 1;
          
          return (
            <button
              key={step.id}
              onClick={() => isClickable && onStepClick(step.id)}
              // disabled={isUpcoming}
              className={`
                w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all
                ${isCurrent 
                  ? 'bg-blue-500 text-white' 
                  : isCompleted 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-white text-gray-400 cursor-not-allowed'
                }
                ${isClickable && !isCurrent ? 'cursor-pointer' : ''}
              `}
            >
              {/* Icon Circle */}
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-lg
                ${isCurrent 
                  ? 'bg-white bg-opacity-20' 
                  : isCompleted 
                  ? 'bg-blue-100'
                  : 'bg-gray-100'
                }
              `}>
                {step.icon}
              </div>
              
              {/* Step Name */}
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">
                  {step.name}
                </p>
              </div>

              {/* Step Number */}
              <span className={`
                text-xs font-medium
                ${isCurrent ? 'text-white opacity-80' : 'text-gray-300'}
              `}>
                {step.id}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}