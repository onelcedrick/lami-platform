"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";

interface PasswordInputProps {
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  className?: string;
}

/**
 * Champ mot de passe avec bouton "oeil" pour basculer
 * entre affichage masque et affichage en clair.
 */
export default function PasswordInput({
  name = "password",
  value,
  onChange,
  placeholder = "Minimum 8 caracteres",
  required = true,
  minLength,
  autoComplete = "current-password",
  className = "",
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <input
        type={visible ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-4 py-2.5 pr-11 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] transition focus:border-[var(--fg-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--fg-accent)]/20 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--fg-muted)] transition hover:text-[var(--fg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--fg-accent)]/20"
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
      </button>
    </div>
  );
}
