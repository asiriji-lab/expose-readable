'use client';

import { useState } from 'react';
import Stepper from './_components/Stepper';
import ProgressBar from './_components/ProgressBar';
import NavigationButtons from './_components/NavigationButtons';
import { Step1_Curriculum } from './_components/steps/Step1_Curriculum';
import { Step2_Teacher } from './_components/steps/Step2_Teacher';
import { Step3_Elective } from './_components/steps/Step3_Elective';
import { Step4_Scout } from './_components/steps/Step4_Scout';
import { Step5_Period } from './_components/steps/Step5_Period';
import { Step6_Student } from './_components/steps/Step6_Student';
import { Step7_Room } from './_components/steps/Step7_Room';
import { Step8_Constraint } from './_components/steps/Step8_Constraint';
import { Step9_RelatedFiles } from './_components/steps/Step9_RelatedFiles';
import { Step10_Generate } from './_components/steps/Step10_Generate';
import { ScheduleFormData } from './_types';

export default function InputPage({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [formData, setFormData] = useState<ScheduleFormData>({
    scheduleName: '',
    year: '',
    semester: '',
    curriculumFile: null,
    teacherFile: null,
    electiveFile: null,
    scoutFile: null,
    periodFile: null,
    studentFile: null,
    roomFile: null,
    constraintFile: null,
    relatedFile: null,
  });

  // State for form data, errors, and UI status
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Updates form data and clears errors for the modified field
  const handleDataChange = <K extends keyof ScheduleFormData>(field: K, value: ScheduleFormData[K]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Placeholder for step-specific validation logic
  // Currently returns true for all steps, but can be expanded
  const validateStep = (step: number): boolean => {
    console.log('Validating step', step);
    const newErrors: { [key: string]: string } = {};

    switch (step) {
      case 1:
        // Add Step 1 validation here if needed
        break;
      // ... other cases
    }

    return Object.keys(newErrors).length === 0;
  };

  // Handles navigation to the next step
  const handleNext = () => {
    console.log('Validating step', currentStep);
    if (validateStep(currentStep)) {
      console.log('Step', currentStep, 'is valid');
      if (currentStep < 10) {
        setCurrentStep(currentStep + 1);
        window.scrollTo(0, 0);
      }
    }
    console.log("step", currentStep, "errors:", errors);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  // Handles schedule generation (Step 10)
  // Includes "Guardrails" to prevent generation if steps 1-8 are incomplete
  const handleGenerate = async (): Promise<boolean> => {
    console.log("handleGenerate called. Completed steps:", completedSteps);

    // Guardrail: Check if all required steps (1-8) are completed
    const requiredSteps = [1, 2, 3, 4, 5, 6, 7, 8];
    const missingSteps = requiredSteps.filter(step => !completedSteps.includes(step));

    if (missingSteps.length > 0) {
      console.log("Missing steps:", missingSteps);
      // Show toast notification with missing steps
      setToastMessage(`Please mark all steps (1-8) as done before generating. Missing steps: ${missingSteps.join(', ')}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
      return false; // Prevent generation
    }

    console.log("Generating schedule with data");
    setIsGenerating(true);

    // Simulate generation process (replace with actual API call)
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Generating schedule:', formData);
        alert('Schedule generated!');
        setIsGenerating(false);
        resolve(true);
      }, 3000);
    });
  };

  const handleMarkAsDone = () => {
    if (validateStep(currentStep)) {
      if (completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => prev.filter(step => step !== currentStep));
      } else {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
    }
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
  };

  let canProceed = false;
  if (currentStep == 10) {
    canProceed = true; // Enable the button on step 10 so it can trigger the check
  } else if (currentStep >= 1 && currentStep <= 9) {
    canProceed = true;
  }


  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1_Curriculum data={formData} onChange={handleDataChange} errors={errors} />;
      case 2:
        return <Step2_Teacher data={formData} onChange={handleDataChange} errors={errors} />;
      case 3:
        return <Step3_Elective data={formData} onChange={handleDataChange} errors={errors} />;
      case 4:
        return <Step4_Scout data={formData} onChange={handleDataChange} errors={errors} />;
      case 5:
        return <Step5_Period data={formData} onChange={handleDataChange} errors={errors} />;
      case 6:
        return <Step6_Student data={formData} onChange={handleDataChange} errors={errors} />;
      case 7:
        return <Step7_Room data={formData} onChange={handleDataChange} errors={errors} />;
      case 8:
        return <Step8_Constraint data={formData} onChange={handleDataChange} errors={errors} />;
      case 9:
        return <Step9_RelatedFiles data={formData} onChange={handleDataChange} errors={errors} />;
      case 10:
        return <Step10_Generate data={formData} onGenerate={handleGenerate} completedSteps={completedSteps} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-lg flex items-start gap-3 max-w-md">
            <div className="text-red-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-red-800 font-medium">Cannot Generate Schedule</h3>
              <p className="text-red-700 text-sm mt-1">{toastMessage}</p>
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="text-red-400 hover:text-red-600 transition-colors ml-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">ScheDool</h1>
              <span className="text-gray-400">Bodindecha School</span>
            </div>

            <div className="flex items-center space-x-3">
              <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-md text-sm font-medium">
                Admin
              </span>
              <div className="w-9 h-9 bg-gray-300 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex">
        <Stepper
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />

        <main className="flex-1 p-10">
          <div className="max-w-5xl mx-auto">
            <ProgressBar completedStepsCount={completedSteps.length} totalSteps={10} />

            <div className="bg-white rounded-2xl shadow-sm p-12 mb-8">
              {renderStep()}
            </div>

            <NavigationButtons
              currentStep={currentStep}
              canProceed={canProceed}
              onNext={currentStep === 10 ? handleGenerate : handleNext}
              onBack={handleBack}
              isGenerating={isGenerating}
              onMarkAsDone={handleMarkAsDone}
              isStepDone={completedSteps.includes(currentStep)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}