"use client";

import { useState } from "react";
import { MOBILE_MONEY_PROVIDERS } from "@/lib/currency";
import { formatAriary } from "@/lib/currency";

interface MobileMoneyModalProps {
  orderNumber: string;
  amount: number;
  onClose: () => void;
  onConfirm: (method: string, phone: string) => Promise<void>;
}

export default function MobileMoneyModal({
  orderNumber,
  amount,
  onClose,
  onConfirm,
}: MobileMoneyModalProps) {
  const [provider, setProvider] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = MOBILE_MONEY_PROVIDERS.find((p) => p.id === provider);

  const handleSubmit = async () => {
    if (!provider) {
      setError("Choisissez un operateur");
      return;
    }
    const digits = phone.replace(/\s/g, "");
    if (digits.length < 9) {
      setError("Numero de telephone invalide");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onConfirm(provider, digits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de paiement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Paiement Mobile Money</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Fermer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-slate-400">
            Commande{" "}
            <span className="font-medium text-primary-400">#{orderNumber}</span>
            {" · "}
            <span className="font-semibold text-primary-400">{formatAriary(amount)}</span>
          </p>

          <div className="mt-4 space-y-2">
            {MOBILE_MONEY_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProvider(p.id);
                  if (!phone) setPhone(p.prefix);
                }}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  provider === p.id
                    ? "border-primary-500 bg-primary-500/10"
                    : "border-slate-700 bg-slate-800/80 hover:border-slate-600"
                }`}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.id === "mvola" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" />
                      <path d="M12 18h.01" />
                    </svg>
                  ) : (
                    p.name.charAt(0)
                  )}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-white">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    Prefixe automatique : {p.prefix}
                  </p>
                </div>
                <span
                  className={`h-5 w-5 rounded-full border-2 ${
                    provider === p.id
                      ? "border-primary-500 bg-primary-500"
                      : "border-slate-500"
                  }`}
                />
              </button>
            ))}
          </div>

          {selected && (
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Numero {selected.name}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={`${selected.prefix} xx xxx xx`}
                className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none"
              />
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !provider}
            className="mt-5 w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {loading ? "Traitement..." : `Payer ${formatAriary(amount)}`}
          </button>

          <p className="mt-3 text-center text-[11px] text-slate-500">
            Vous recevrez une notification sur votre telephone pour valider le paiement.
          </p>
        </div>
      </div>
    </div>
  );
}
