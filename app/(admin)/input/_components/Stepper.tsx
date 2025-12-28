import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

interface StepperProps {
    currentStep: number;
    completedSteps: number[];
    onStepClick: (step: number) => void;
}

const steps = [
    { id: 1, label: 'Curriculum', emoji: '📘' },
    { id: 2, label: 'Teacher', emoji: '👥' },
    { id: 3, label: 'Elective', emoji: '📚' },
    { id: 4, label: 'Scout', emoji: '🎯' },
    { id: 5, label: 'Period', emoji: '⏰' },
    { id: 6, label: 'Student', emoji: '👨‍🎓' },
    { id: 7, label: 'Room', emoji: '🏫' },
    { id: 8, label: 'Constraint', emoji: '⚙️' },
    { id: 9, label: 'Related files', emoji: '📎' },
    { id: 10, label: 'Generate', emoji: '✨' },
];

export default function Stepper({ currentStep, completedSteps, onStepClick }: StepperProps) {
    return (
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)] p-6">
            <div className="mb-8">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Setup Step
                </h2>
                <div className="space-y-2">
                    {steps.map((step) => {
                        const isCompleted = completedSteps.includes(step.id);
                        const isActive = currentStep === step.id;
                        const isClickable = true;

                        return (
                            <button
                                key={step.id}
                                onClick={() => onStepClick(step.id)}
                                className={`
                  w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all
                  ${isActive
                                        ? 'bg-blue-50 text-primary font-medium shadow-sm ring-1 ring-blue-100'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }
                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                    w-6 h-6 rounded flex items-center justify-center text-[10px] transition-colors
                    ${isCompleted
                                            ? 'bg-green-500 text-white'
                                            : isActive
                                                ? 'bg-primary text-white'
                                                : 'bg-gray-100 text-gray-400'
                                        }
                  `}>
                                        {isCompleted ? (
                                            <FontAwesomeIcon icon={faCheck} />
                                        ) : (
                                            <span className="text-[10px]">{step.emoji}</span>
                                        )}
                                    </div>
                                    <span>{step.label}</span>
                                </div>
                                <span className="text-xs text-gray-400">{step.id}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}
