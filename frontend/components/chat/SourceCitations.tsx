/**
 * ============================================================
 * CITATIONS DES SOURCES RAG
 * ============================================================
 * Affiche les documents de connaissance utilisés par l'IA
 * dans un panneau dépliable (accordéon).
 * L'utilisateur peut vérifier d'où vient la réponse.
 */

import { useState } from "react";
import type { ChatSource } from "@/lib/chat/chat-types";

interface SourceCitationsProps {
  sources: ChatSource[];
}

export default function SourceCitations({ sources }: SourceCitationsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
      {/* Bouton pour déplier/replier */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {/* Icône livre */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          {sources.length} source{sources.length > 1 ? "s" : ""}
        </span>
        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Liste des sources (visible si déplié) */}
      {expanded && (
        <ul className="space-y-2 border-t border-slate-200 px-3 py-2 dark:border-slate-700">
          {sources.map((s) => (
            <li key={s.id} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {s.title}
                </span>
                {/* Score de pertinence en badge */}
                <span className="ml-2 shrink-0 rounded-full bg-primary-100 px-1.5 py-0.5 text-[9px] font-semibold text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
                  {(s.score * 100).toFixed(0)}%
                </span>
              </div>
              {/* Extrait du contenu */}
              <p className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">
                {s.content.slice(0, 150)}
                {s.content.length > 150 ? "…" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
