'use client';

interface NavigationButtonsProps {
  currentStep: number;
  canProceed: boolean;
  onNext: (e?: any) => void | Promise<boolean>;
  onBack: () => void;
  isGenerating: boolean;
  onMarkAsDone: () => void;
  isStepDone: boolean;
}

export default function NavigationButtons({
  currentStep,
  canProceed,
  onNext,
  onBack,
  isGenerating,
  onMarkAsDone,
  isStepDone,
}: NavigationButtonsProps) {
  const isLastStep = currentStep === 10;

  return (
    <div className="flex items-center justify-between mt-4">
      <button
        onClick={onBack}
        disabled={currentStep === 1}
        className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Back
      </button>

      <div className="flex items-center gap-3">
        {!isLastStep && (
          <button
            onClick={onMarkAsDone}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              isStepDone
                ? 'bg-green-50 border-green-400 text-green-700 hover:bg-green-100'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {isStepDone ? '✓ Done' : 'Mark as Done'}
          </button>
        )}

        <button
          onClick={onNext}
          disabled={!canProceed || isGenerating}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating
            ? 'Generating...'
            : isLastStep
            ? 'Generate'
            : 'Next'}
        </button>
      </div>
    </div>
  );
}
