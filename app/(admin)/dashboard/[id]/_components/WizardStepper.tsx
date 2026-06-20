'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  key: string;
  label: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  /** 1-based index of the active step */
  currentStep: number;
  /** Called when a completed (already-visited) step node is clicked. Forward jumps are gated, so only back-navigation is allowed. */
  onStepClick?: (step: number) => void;
}

export default function WizardStepper({ steps, currentStep, onStepClick }: WizardStepperProps) {
  return (
    <ol className="flex items-center w-full" data-testid="wizard-stepper">
      {steps.map((step, idx) => {
        const stepNumber = idx + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        const isClickable = isCompleted && !!onStepClick;
        const isLast = idx === steps.length - 1;

        return (
          <li key={step.key} className={cn('flex items-center', !isLast && 'flex-1')}>
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick?.(stepNumber)}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 shrink-0 rounded-lg px-1 py-1 transition-colors',
                isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border transition-colors',
                  isCompleted && 'bg-success border-success text-white',
                  isCurrent && 'bg-primary border-primary text-primary-foreground',
                  !isCompleted && !isCurrent && 'bg-surface border-border text-foreground-muted',
                )}
              >
                {isCompleted ? <Check size={14} /> : stepNumber}
              </span>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:inline',
                  isCurrent ? 'text-foreground font-bold' : 'text-foreground-muted',
                )}
              >
                {step.label}
              </span>
            </button>

            {!isLast && (
              <span
                className={cn(
                  'flex-1 h-0.5 mx-2 rounded-full transition-colors',
                  isCompleted ? 'bg-success' : 'bg-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
