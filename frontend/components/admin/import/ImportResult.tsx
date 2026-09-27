"use client";

interface Props {
  created: number;
  failed: number;
  errors?: string[];
  onDownloadErrors?: () => void;
  onClose: () => void;
}

export default function ImportResult({
  created,
  failed,
  errors = [],
  onDownloadErrors,
  onClose,
}: Props) {
  const success = created > 0 && failed === 0;
  const partial = created > 0 && failed > 0;
  const total = created + failed;

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl p-6 text-center ${
          success
            ? "bg-emerald-50 dark:bg-emerald-950/30"
            : partial
              ? "bg-amber-50 dark:bg-amber-950/30"
              : "bg-red-50 dark:bg-red-950/30"
        }`}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm dark:bg-slate-900">
          {success ? "✅" : partial ? "⚠️" : "❌"}
        </div>
        <h3
          className={`mt-3 text-lg font-bold ${
            success
              ? "text-emerald-800 dark:text-emerald-300"
              : partial
                ? "text-amber-800 dark:text-amber-300"
                : "text-red-800 dark:text-red-300"
          }`}
        >
          {success
            ? "Import réussi"
            : partial
              ? "Import partiel"
              : "Import échoué"}
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          <strong>{created}</strong> créé(s) · <strong>{failed}</strong> échec(s) sur{" "}
          {total}
        </p>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-red-700 dark:text-red-300">
              Détails des erreurs ({errors.length})
            </p>
            {onDownloadErrors && (
              <button
                type="button"
                onClick={onDownloadErrors}
                className="text-xs font-medium text-red-700 hover:underline dark:text-red-300"
              >
                Télécharger
              </button>
            )}
          </div>
          <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs text-red-700 dark:text-red-300">
            {errors.slice(0, 50).map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
            {errors.length > 50 && (
              <li className="italic opacity-70">
                … et {errors.length - 50} autres erreurs
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button type="button" onClick={onClose} className="btn-primary">
          Fermer
        </button>
      </div>
    </div>
  );
}