"use client";

import Link from "next/link";
import { CpuIcon, BoxIcon, PackageIcon, ServerIcon } from "@/components/ui/icons";

const CATEGORIES = [
  {
    name: "Processeurs",
    slug: "CPU",
    icon: <CpuIcon size={28} />,
    color: "var(--orange)",
  },
  {
    name: "Cartes graphiques",
    slug: "GPU",
    icon: <BoxIcon size={28} />,
    color: "var(--cyan)",
  },
  {
    name: "Stockage SSD",
    slug: "Stockage",
    icon: <PackageIcon size={28} />,
    color: "var(--cyan)",
  },
  {
    name: "Memoire RAM",
    slug: "RAM",
    icon: <ServerIcon size={28} />,
    color: "var(--orange)",
  },
];

export default function CategoryGrid() {
  return (
    <section className="border-b border-[var(--border)] bg-[var(--bg-app)]">
      <div className="mx-auto w-full px-4 py-12 sm:px-6 lg:px-10 xl:px-16">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/catalog?category=${encodeURIComponent(cat.slug)}`}
              className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--cyan)]/40 hover:shadow-md"
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                style={{
                  backgroundColor: `${cat.color}15`,
                  color: cat.color,
                }}
              >
                {cat.icon}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--fg-primary)]">
                  {cat.name}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">
                  Explorer
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
