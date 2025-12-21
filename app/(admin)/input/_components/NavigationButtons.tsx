// app/input/components/NavigationButtons.tsx

interface NavigationButtonsProps {
  currentStep: number;
  canProceed: boolean;
  onNext: () => void;
  onBack: () => void;
  isGenerating?: boolean;
}

export default function NavigationButtons({ 
  currentStep, 
  canProceed, 
  onNext, 
  onBack,
  isGenerating = false 
}: NavigationButtonsProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === 10;
  
  return (
    <div className="flex items-center justify-between">
      {/* Back Button */}
      <button
        onClick={onBack}
        disabled={isFirstStep || isGenerating}
        className={`
          flex items-center space-x-2 px-5 py-2.5 rounded-lg font-medium transition-all text-sm
          ${isFirstStep || isGenerating
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-100'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>Back</span>
      </button>
      
      {/* Next/Generate Button */}
      <button
        onClick={onNext}
        disabled={!canProceed || isGenerating}
        className={`
          flex items-center space-x-2 px-8 py-2.5 rounded-lg font-medium transition-all text-sm
          ${!canProceed || isGenerating
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
          }
        `}
      >
        {isGenerating ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Generating...</span>
          </>
        ) : isLastStep ? (
          <>
            <span>Generate Schedule</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </>
        ) : (
          <>
            <span>Next</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}