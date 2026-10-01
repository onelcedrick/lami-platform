"use client";

import { useEffect, useState } from "react";
import KPICard from "@/components/admin/live/KPICard";
import LiveFeed from "@/components/admin/live/LiveFeed";
import ServiceHealthGrid from "@/components/admin/live/ServiceHealthGrid";
import LatencyChart from "@/components/admin/live/LatencyChart";
import { useLiveStore } from "@/lib/live-store";
import { useSSE } from "@/lib/use-sse";
import { liveApi } from "@/lib/live-api";
import { formatAriary } from "@/lib/currency";
import {
  CartIcon,
  EyeIcon,
  TicketIcon,
  RefreshIcon,
  ZapIcon,
} from "@/components/ui/icons";

export default function AdminLiveDashboardPage() {
  const { connected, events, services, kpi, setServices, setKPI } = useLiveStore();
  const [refreshing, setRefreshing] = useState(false);
  const [latencyHistory, setLatencyHistory] = useState<
    { time: string; p50: number; p95: number }[]
  >([]);

  useSSE();

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const [k, s] = await Promise.all([liveApi.kpi(), liveApi.services()]);
      if (!mounted) return;
      if (k) {
        setKPI(k);
        setLatencyHistory((prev) => {
          const now = new Date().toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          const next = [
            ...prev,
            {
              time: now,
              p50: k.ia_latence_p50_ms,
              p95: Math.round(k.ia_latence_p50_ms * 1.8),
            },
          ];
          return next.slice(-30);
        });
      }
      if (s) setServices(s);
    }
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setKPI, setServices]);

  async function manualRefresh() {
    setRefreshing(true);
    const [k, s] = await Promise.all([liveApi.kpi(), liveApi.services()]);
    if (k) setKPI(k);
    if (s) setServices(s);
    setRefreshing(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Dashboard temps reel
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Vue live de la plateforme L AMI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              connected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            />
            {connected ? "Connecte" : "Deconnecte"}
          </span>
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="btn-secondary"
          >
            <RefreshIcon size={16} />
            {refreshing ? "..." : "Rafraichir"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="CA du jour"
          value={kpi ? formatAriary(kpi.ca_jour_mga) : "-"}
          icon={<ZapIcon size={20} />}
          accent="green"
          subtitle={`${kpi?.commandes_jour ?? 0} commande(s)`}
        />
        <KPICard
          label="Commandes"
          value={kpi?.commandes_jour ?? 0}
          icon={<CartIcon size={20} />}
          accent="blue"
          subtitle={
            kpi ? `Panier moyen ${formatAriary(kpi.panier_moyen_mga)}` : undefined
          }
        />
        <KPICard
          label="Visiteurs du jour"
          value={kpi?.visiteurs_jour ?? 0}
          icon={<EyeIcon size={20} />}
          accent="purple"
        />
        <KPICard
          label="Tickets ouverts"
          value={kpi?.tickets_ouverts ?? 0}
          icon={<TicketIcon size={20} />}
          accent={kpi && kpi.tickets_ouverts > 10 ? "red" : "amber"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ServiceHealthGrid services={services} />
        <LatencyChart data={latencyHistory} />
      </div>

      <div className="mt-6">
        <LiveFeed events={events} />
      </div>
    </div>
  );
}
