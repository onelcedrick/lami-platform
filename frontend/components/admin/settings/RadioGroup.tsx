"use client";

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface RadioGroupProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: RadioOption<T>[];
  name: string;
}

export default function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  name,
}: RadioGroupProps<T>) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
              isActive
                ? "border-primary-500 bg-primary-50 dark:bg-primary-950/40"
                : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-300 hover:bg-[var(--bg-muted)]"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={isActive}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 focus:ring-primary-500"
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  isActive
                    ? "text-primary-700 dark:text-primary-300"
                    : "text-[var(--fg-primary)]"
                }`}
              >
                {opt.label}
              </p>
              {opt.description && (
                <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                  {opt.description}
                </p>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
