import type { OnboardingStep } from '../../types/onboarding';

const STEPS: { step: OnboardingStep; label: string }[] = [
  { step: 1, label: 'Subscription' },
  { step: 2, label: 'Company' },
  { step: 3, label: 'Merchant' },
  { step: 4, label: 'User' },
];

const PROGRESS_WIDTH: Record<OnboardingStep, string> = {
  1: 'w-[12%]',
  2: 'w-[37%]',
  3: 'w-[62%]',
  4: 'w-full',
};

interface OnboardingStepperProps {
  currentStep: OnboardingStep;
  subtitle?: string;
}

export function OnboardingStepper({
  currentStep,
  subtitle,
}: OnboardingStepperProps) {
  return (
    <div className="w-full max-w-3xl mx-auto mb-10">
      <div className="relative flex items-center justify-between">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border -z-10" />
        <div
          className={`absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 -z-10 ${PROGRESS_WIDTH[currentStep]}`}
        />

        {STEPS.map(({ step, label }) => {
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;
          const isLarge = isActive && step >= 3;

          return (
            <div
              key={step}
              className="flex flex-col items-center gap-2 bg-background px-2"
            >
              <div
                className={`flex items-center justify-center rounded-full font-bold transition-all duration-300 ${
                  isLarge ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-sm'
                } ${
                  isCompleted || isActive
                    ? 'bg-primary text-white'
                    : 'bg-white border-2 border-stone-300 text-stone-400'
                }`}
              >
                {isCompleted ? (
                  <span className="material-symbols-outlined text-xl">check</span>
                ) : (
                  step
                )}
              </div>
              <span
                className={`text-label-caps ${
                  isActive ? 'text-primary' : 'text-stone-400'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {subtitle && (
        <p className="text-center text-label-caps text-stone-500 mt-6">
          {subtitle}
        </p>
      )}
    </div>
  );
}
