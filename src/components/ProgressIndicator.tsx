import { Check } from 'lucide-react';
import { useJourney, type Step } from '../context/JourneyContext';

const STEPS: { num: Step; label: string }[] = [
  { num: 1, label: 'Learn' },
  { num: 2, label: 'Imagine' },
  { num: 3, label: 'Submit' },
  { num: 4, label: 'Ready' },
];

export default function ProgressIndicator() {
  const { currentStep, completedSteps, setCurrentStep } = useJourney();

  const canNavigate = (step: Step) => {
    // Can go to any completed step or the current step
    return completedSteps.has(step) || step === currentStep;
  };

  return (
    <div className="flex items-center gap-0 justify-center" role="list" aria-label="Journey progress">
      {STEPS.map((step, idx) => {
        const done = completedSteps.has(step.num);
        const active = currentStep === step.num;
        const clickable = canNavigate(step.num);

        return (
          <div key={step.num} className="flex items-center" role="listitem">
            <button
              onClick={() => clickable && setCurrentStep(step.num)}
              disabled={!clickable}
              aria-label={`Step ${step.num}: ${step.label}${done ? ' (completed)' : active ? ' (current)' : ''}`}
              aria-current={active ? 'step' : undefined}
              className={`
                flex flex-col items-center gap-1.5 px-3 py-1 rounded-xl transition-all duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                ${clickable ? 'cursor-pointer' : 'cursor-default opacity-40'}
              `}
            >
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
                  ${done
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md'
                    : active
                    ? 'bg-white border-2 border-blue-500 text-blue-600 shadow-md'
                    : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                  }
                `}
              >
                {done ? <Check className="w-4 h-4" strokeWidth={2.5} /> : step.num}
              </div>
              <span
                className={`text-xs font-medium transition-colors ${
                  active ? 'text-blue-600' : done ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </button>

            {idx < STEPS.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 rounded-full transition-all duration-500 ${
                  completedSteps.has(step.num) ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
