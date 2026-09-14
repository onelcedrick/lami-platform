"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface DailyStat {
  date: string;
  unique_visitors: number;
  page_views: number;
}

interface VisitorSummary {
  today_unique: number;
  today_page_views: number;
  yesterday_unique: number;
  last_7_days_unique: number;
  last_7_days_views: number;
  daily: DailyStat[];
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<VisitorSummary | null>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .visitorStats(days)
      .then((res) => {
        if (res.success && res.data) setData(res.data as VisitorSummary);
        else setError(res.error || "Impossible de charger les stats");
      })
      .catch(() => setError("Service analytics indisponible"))
      .finally(() => setLoading(false));
  }, [days]);

  const maxViews = Math.max(
    1,
    ...(data?.daily?.map((d) => d.page_views) || [1])
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Visiteurs
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Visiteurs uniques hors connexion (par jour)
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="input-field w-auto"
        >
          <option value={7}>7 jours</option>
          <option value={14}>14 jours</option>
          <option value={30}>30 jours</option>
        </select>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Aujourd'hui (uniques)", value: data?.today_unique },
          { label: "Aujourd'hui (pages vues)", value: data?.today_page_views },
          { label: "Hier (uniques)", value: data?.yesterday_unique },
          {
            label: `Uniques ${days}j`,
            value: data?.last_7_days_unique,
          },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs font-medium uppercase text-slate-400">
              {k.label}
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">
              {loading ? "—" : k.value ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Evolution quotidienne
        </h2>
        {loading ? (
          <div className="mt-6 h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : !data?.daily?.length ? (
          <p className="mt-6 text-sm text-slate-400">
            Aucune donnee encore. Les visites anonymes s&apos;accumuleront
            automatiquement.
          </p>
        ) : (
          <div className="mt-6 flex items-end gap-1.5 overflow-x-auto pb-2" style={{ minHeight: 160 }}>
            {data.daily.map((d) => {
              const h = Math.max(4, Math.round((d.page_views / maxViews) * 120));
              return (
                <div
                  key={d.date}
                  className="flex min-w-[36px] flex-1 flex-col items-center gap-1"
                  title={`${d.date}: ${d.unique_visitors} uniques, ${d.page_views} vues`}
                >
                  <span className="text-[10px] text-slate-500">
                    {d.unique_visitors}
                  </span>
                  <div
                    className="w-full max-w-[28px] rounded-t-md bg-primary-500/90 transition hover:bg-primary-600"
                    style={{ height: h }}
                  />
                  <span className="text-[9px] text-slate-400">
                    {d.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Barres = pages vues. Nombre au-dessus = visiteurs uniques (ID
          anonyme navigateur, hors comptes connectes).
        </p>
      </div>
    </div>
  );
}
