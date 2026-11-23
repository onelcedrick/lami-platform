/**
 * Indicateur de frappe animé (3 points qui pulsent).
 * Affiché pendant que l'IA génère sa réponse.
 */
export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      {/* Avatar IA */}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a4 4 0 0 1 4 4v1h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z" />
          <circle cx="9" cy="13" r="1" fill="currentColor" />
          <circle cx="15" cy="13" r="1" fill="currentColor" />
        </svg>
      </div>
      {/* Bulle avec les 3 points animés */}
      <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 dark:bg-slate-800">
        <div className="flex gap-1.5" aria-label="L'assistant réfléchit">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
