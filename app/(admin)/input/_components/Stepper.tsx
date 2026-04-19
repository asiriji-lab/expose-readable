'use client';

const STEPS = [
  { id: 1, label: 'Curriculum' },
  { id: 2, label: 'Teacher' },
  { id: 3, label: 'Elective' },
  { id: 4, label: 'Scout' },
  { id: 5, label: 'Period' },
  { id: 6, label: 'Student' },
  { id: 7, label: 'Room' },
  { id: 8, label: 'Constraint' },
  { id: 9, label: 'Related Files' },
  { id: 10, label: 'Generate' },
];

interface StepperProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

export default function Stepper({ currentStep, completedSteps, onStepClick }: StepperProps) {
  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-200 py-8 px-4 flex-shrink-0">
      <nav className="space-y-1">
        {STEPS.map((step) => {
          const isActive = step.id === currentStep;
          const isDone = completedSteps.includes(step.id);

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                  isDone
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isDone ? '✓' : step.id}
              </span>
              <span className="truncate">{step.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
