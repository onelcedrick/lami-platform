"use client";

import Link from "next/link";
import { ChevronRightIcon, ZapIcon, BoxIcon } from "@/components/ui/icons";

export default function PromoCards() {
  return (
    <section className="bg-[var(--bg-app)]">
      <div className="mx-auto w-full px-4 py-12 sm:px-6 lg:px-10 xl:px-16">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Banniere 1 - Navy/Cyan */}
          <Link
            href="/catalog?usage=gaming"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--navy-core)] via-[var(--navy-panel)] to-[var(--navy-deep)] p-8 text-white transition-all hover:-translate-y-1 hover:shadow-2xl sm:p-10"
          >
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[var(--cyan)]/20 blur-3xl" />
            <div className="relative">
              <span className="inline-block rounded-md bg-[var(--cyan)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--navy-deep)]">
                Promo -30%
              </span>
              <h3 className="mt-4 text-2xl font-extrabold leading-tight sm:text-3xl">
                Composants
                <br />
                Gaming
              </h3>
              <p className="mt-3 max-w-xs text-sm text-white/70">
                GPU, CPU et RAM selectionnes pour les joueurs exigeants.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--cyan)] group-hover:gap-3">
                Decouvrir
                <ChevronRightIcon size={16} />
              </span>
            </div>
          </Link>

          {/* Banniere 2 - Orange */}
          <Link
            href="/catalog?sort=price_desc"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--orange)] to-[#B93F1F] p-8 text-white transition-all hover:-translate-y-1 hover:shadow-2xl sm:p-10"
          >
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <span className="inline-block rounded-md bg-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                Nouveautes
              </span>
              <h3 className="mt-4 text-2xl font-extrabold leading-tight sm:text-3xl">
                Arrivages
                <br />
                2026
              </h3>
              <p className="mt-3 max-w-xs text-sm text-white/80">
                Les derniers composants et configurations disponibles.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white group-hover:gap-3">
                Voir la collection
                <ChevronRightIcon size={16} />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
