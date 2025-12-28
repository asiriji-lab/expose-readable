import React from 'react';

interface NavigationButtonsProps {
    currentStep: number;
    canProceed: boolean;
    onNext: () => void;
    onBack: () => void;
    isGenerating?: boolean;
    onMarkAsDone?: () => void;
    isStepDone?: boolean;
}

export default function NavigationButtons({
    currentStep,
    canProceed,
    onNext,
    onBack,
    isGenerating = false,
    onMarkAsDone,
    isStepDone = false
}: NavigationButtonsProps) {
    return (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            <button
                onClick={onBack}
                disabled={currentStep === 1}
                className={`
          px-6 py-2.5 rounded-lg text-sm font-medium transition-colors
          ${currentStep === 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
                    }
        `}
            >
                ← Back
            </button>

            <div className="flex items-center gap-3">
                {onMarkAsDone && (
                    <button
                        onClick={onMarkAsDone}
                        className={`
              px-6 py-2.5 rounded-lg text-sm font-medium transition-colors border
              ${isStepDone
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            }
            `}
                    >
                        {isStepDone ? '✓ Done' : 'Mark as Done'}
                    </button>
                )}

                <button
                    onClick={onNext}
                    disabled={!canProceed || isGenerating}
                    className={`
            px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm
            ${!canProceed || isGenerating
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-primary text-white hover:bg-primary/90 hover:shadow'
                        }
          `}
                >
                    {isGenerating ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Generating...
                        </span>
                    ) : (
                        currentStep === 10 ? 'Generate Schedule' : 'Next →'
                    )}
                </button>
            </div>
        </div>
    );
}
