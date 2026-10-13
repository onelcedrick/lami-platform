"use client";

import { TruckIcon, ShieldCheckIcon, LifeBuoyIcon, CheckIcon } from "@/components/ui/icons";

interface TrustItem {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

const TRUST_ITEMS: TrustItem[] = [
  {
    icon: <TruckIcon size={20} />,
    title: "Livraison 24h",
    subtitle: "Toamasina et environs",
  },
  {
    icon: <ShieldCheckIcon size={20} />,
    title: "Garantie 3 ans",
    subtitle: "Sur tout le materiel",
  },
  {
    icon: <LifeBuoyIcon size={20} />,
    title: "Support expert",
    subtitle: "Techniciens certifies",
  },
  {
    icon: <CheckIcon size={20} />,
    title: "Paiement securise",
    subtitle: "Mobile Money accepte",
  },
];

export default function TrustBar() {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-10 xl:px-16">
        <div className="grid grid-cols-2 gap-px divide-[var(--border)] sm:grid-cols-4 sm:divide-x">
          {TRUST_ITEMS.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-5 transition hover:bg-[var(--bg-muted)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--cyan)]/10 text-[var(--cyan)]">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--fg-primary)]">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="truncate text-xs text-[var(--fg-muted)]">
                    {item.subtitle}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
