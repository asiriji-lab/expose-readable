import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';

interface StepperProps {
    currentStep: number;
    completedSteps: number[];
    onStepClick: (step: number) => void;
}

const steps = [
    {
        id: 1,
        label: 'Curriculum',
        activeIcon: '/step_icon/1.book-open.svg',
        inactiveIcon: '/step_icon/1.1.book-open_inactive.svg'
    },
    {
        id: 2,
        label: 'Teacher',
        activeIcon: '/step_icon/2.users.svg',
        inactiveIcon: '/step_icon/2.1.users_inactive.svg'
    },
    {
        id: 3,
        label: 'Elective',
        activeIcon: '/step_icon/3.puzzle.svg',
        inactiveIcon: '/step_icon/3.1.puzzle_inactive.svg'
    },
    {
        id: 4,
        label: 'Scout',
        activeIcon: '/step_icon/4.tent.svg',
        inactiveIcon: '/step_icon/4.1.tent_inactive.svg'
    },
    {
        id: 5,
        label: 'Period',
        activeIcon: '/step_icon/5.clock.svg',
        inactiveIcon: '/step_icon/5.1.clock_inactive.svg'
    },
    {
        id: 6,
        label: 'Student',
        activeIcon: '/step_icon/6.graduation-cap.svg',
        inactiveIcon: '/step_icon/6.1.graduation-cap_inactive.svg'
    },
    {
        id: 7,
        label: 'Room',
        activeIcon: '/step_icon/7.door-closed.svg',
        inactiveIcon: '/step_icon/7.1.door-closed_inactive.svg'
    },
    {
        id: 8,
        label: 'Constraint',
        activeIcon: '/step_icon/8.triangle-alert.svg',
        inactiveIcon: '/step_icon/8.1.triangle-alert_inactive.svg'
    },
    {
        id: 9,
        label: 'Related files',
        activeIcon: '/step_icon/9.file-text.svg',
        inactiveIcon: '/step_icon/9.1.file-text_inactive.svg'
    },
    {
        id: 10,
        label: 'Generate',
        activeIcon: '/step_icon/10.sparkles.svg',
        inactiveIcon: '/step_icon/10.1.sparkles_inactive.svg'
    },
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

                        return (
                            <button
                                key={step.id}
                                onClick={() => onStepClick(step.id)}
                                className={`
                  w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all
                  ${isActive
                                        ? 'bg-blue-50 text-blue-600 font-medium shadow-sm ring-1 ring-blue-100'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }
                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                    w-9 h-9 rounded flex items-center justify-center text-[10px] transition-colors
                    ${isCompleted
                                            ? 'bg-green-500 text-white'
                                            : isActive
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-400'
                                        }
                  `}>
                                        {isCompleted ? (
                                            <div className="relative w-5 h-5 flex items-center justify-center text-white">
                                                <Image
                                                    src="/step_icon/Mark_as_done.svg"
                                                    alt="Completed"
                                                    fill
                                                    className="object-contain brightness-0 invert"
                                                />
                                            </div>
                                        ) : (
                                            <div className="relative w-5 h-5">
                                                <Image
                                                    src={isActive ? step.activeIcon : step.inactiveIcon}
                                                    alt={step.label}
                                                    fill
                                                    className={`object-contain ${isActive ? 'brightness-0 invert' : ''}`}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <span>{step.label}</span>
                                </div>
                                <span className={`text-xs ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>{step.id}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}

