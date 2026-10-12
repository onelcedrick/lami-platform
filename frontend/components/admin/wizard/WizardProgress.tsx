"use client";

interface WizardProgressProps {
  currentStep: 1 | 2;
  totalSteps: 2;
  stepLabels: string[];
}

export default function WizardProgress({
  currentStep,
  totalSteps,
  stepLabels,
}: WizardProgressProps) {
  return (
    <div className="mb-6">
      {/* Étapes */}
      <div className="flex items-center justify-between">
        {stepLabels.map((label, idx) => {
          const step = (idx + 1) as 1 | 2;
          const isActive = step === currentStep;
          const isDone = step < currentStep;

          return (
            <div key={idx} className="flex flex-1 items-center">
              {/* Cercle */}
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                    isActive
                      ? "border-primary-500 bg-primary-500 text-white shadow-md"
                      : isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--fg-muted)]"
                  }`}
                >
                  {isDone ? "✓" : step}
                </div>
                <div className="hidden sm:block">
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      isActive
                        ? "text-primary-600 dark:text-primary-400"
                        : isDone
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-[var(--fg-muted)]"
                    }`}
                  >
                    Étape {step}
                  </p>
                  <p className="text-sm font-medium text-[var(--fg-primary)]">
                    {label}
                  </p>
                </div>
              </div>

              {/* Ligne de connexion */}
              {step < totalSteps && (
                <div
                  className={`mx-4 h-0.5 flex-1 transition-colors ${
                    isDone
                      ? "bg-emerald-500"
                      : "bg-[var(--border)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
