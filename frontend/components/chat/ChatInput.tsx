"use client";
/**
 * ============================================================
 * ZONE DE SAISIE — textarea auto-extensible + bouton degrade
 * ============================================================
 * - Entrée = envoyer, Maj+Entrée = nouvelle ligne
 * - Compteur de caractères discret
 * - Spinner pendant le chargement
 */
import { useEffect, useRef, useState } from "react";

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

const MAX_CHARS = 4000;

export default function ChatInput({ onSubmit, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize : hauteur = contenu, plafonnée à 120px
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const send = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue("");
    // Redonne le focus pour enchaîner les messages
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-surface)]/85 p-3 pb-safe backdrop-blur-xl">
      {/* Conteneur "pill" avec glow au focus */}
      <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-2 transition-all focus-within:border-[var(--cyan)] focus-within:shadow-[0_0_0_3px_rgba(0,212,255,0.12)]">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX_CHARS}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Écrivez votre message…"
          aria-label="Votre message"
          className="max-h-[120px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-muted)] disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={disabled || !value.trim()}
          aria-label="Envoyer"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--cyan)] to-blue-600 text-[var(--navy-deep)] shadow-md shadow-[var(--cyan)]/25 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          {disabled ? (
            /* Spinner pendant la génération */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            /* Icône envoi */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          )}
        </button>
      </div>

      {/* Aide + compteur */}
      <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-[var(--fg-muted)]">
        <span className="hidden sm:inline">Entrée = envoyer · Maj+Entrée = nouvelle ligne</span>
        <span className={value.length > MAX_CHARS * 0.9 ? "text-[var(--warning)]" : ""}>
          {value.length}/{MAX_CHARS}
        </span>
      </div>
    </div>
  );
}
