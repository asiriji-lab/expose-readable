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

export default function InputPage({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    scheduleName: '',
    year: '',
    semester: '',
    curriculumFile: null as File | null,
    teacherFile: null as File | null,
    electiveFile: null as File | null,
    scoutFile: null as File | null,
    periodFile: null as File | null,
    studentFile: null as File | null,
    roomFile: null as File | null,
    constraintFile: null as File | null,
    relatedFile: null as File | null,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDataChange = (field: string, value: any) => {
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

  const validateStep = (step: number): boolean => {
    console.log('Validating step', step);
    const newErrors: { [key: string]: string } = {};

    switch (step) {
      case 1:
        // if (!formData.scheduleName.trim()) {
        //   newErrors.scheduleName = 'Schedule name is required';
        // }
        // if (!formData.year.trim()) {
        //   newErrors.year = 'Year is required';
        // } else if (!/^\d{4}$/.test(formData.year)) {
        //   newErrors.year = 'Year must be 4 digits';
        // }
        // if (!formData.semester.trim()) {
        //   newErrors.semester = 'Semester is required';
        // } else if (!['1', '2'].includes(formData.semester)) {
        //   newErrors.semester = 'Semester must be 1 or 2';
        // }
        // if (!formData.curriculumFile) {
        //   newErrors.curriculumFile = 'Curriculum file is required';
        // }
        break;
      case 2:
        // if (!formData.teacherFile) newErrors.teacherFile = 'Teacher file is required';
        break;
      case 3:
        // if (!formData.electiveFile) newErrors.electiveFile = 'Elective file is required';
        break;
      case 4:
        // if (!formData.scoutFile) newErrors.scoutFile = 'Scout file is required';
        break;
      case 5:
        // if (!formData.periodFile) newErrors.periodFile = 'Period file is required';
        break;
      case 6:
        // if (!formData.studentFile) newErrors.studentFile = 'Student file is required';
        break;
      case 7:
        // if (!formData.roomFile) newErrors.roomFile = 'Room file is required';
        break;
      case 8:
        // if (!formData.constraintFile) newErrors.constraintFile = 'Constraint file is required';
        break;
      case 9:
        break;
      case 10:
        break;
    }

    // setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    console.log('Validating step', currentStep);
    if (validateStep(currentStep)) {
      console.log('Step', currentStep, 'is valid');
      // Auto-complete removed to respect "Mark as Done" explicit action
      // if (!completedSteps.includes(currentStep)) {
      //   setCompletedSteps(prev => [...prev, currentStep]);
      // }
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

  const handleGenerate = async () => {
    console.log("Generating schedule with data");
    setIsGenerating(true);

    setTimeout(() => {
      console.log('Generating schedule:', formData);
      alert('Schedule generated!');
      setIsGenerating(false);
    }, 3000);
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
    canProceed = false
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
    <div className="min-h-screen bg-gray-50">
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