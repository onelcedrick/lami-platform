"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRightIcon, CpuIcon, ZapIcon } from "@/components/ui/icons";

export default function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <section className="relative overflow-hidden bg-[var(--navy-deep)]">
      {/* Grille subtile */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,212,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Halo cyan */}
      <div className="pointer-events-none absolute -right-32 top-0 h-[40rem] w-[40rem] rounded-full bg-[var(--cyan)]/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-[30rem] w-[30rem] rounded-full bg-[var(--orange)]/5 blur-3xl" />

      <div className="relative mx-auto w-full px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24 xl:px-16">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          {/* ============ COLONNE GAUCHE : TEXTE ============ */}
          <div className="lg:col-span-7">
            {/* Badge */}
            <div className="animate-fade-in-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--orange)]/40 bg-[var(--orange)]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--orange)] backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--orange)]" />
                Nouveau 2026
              </span>
            </div>

            {/* Titre */}
            <h1 className="mt-6 animate-fade-in-up text-4xl font-extrabold leading-[1.05] tracking-tight text-white [animation-delay:100ms] sm:text-5xl lg:text-6xl">
              Le meilleur de la tech,
              <span className="mt-1 block text-[var(--cyan)]">
                pour votre setup.
              </span>
            </h1>

            {/* Sous-titre */}
            <p className="mt-6 max-w-xl animate-fade-in-up text-base leading-relaxed text-white/70 [animation-delay:200ms] sm:text-lg">
              Composants haute performance, PC sur mesure et support expert.
              Livraison rapide à Toamasina et dans toute Madagascar.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3 animate-fade-in-up [animation-delay:300ms] sm:flex-row">
              <Link
                href="/catalog"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--cyan)] px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-[var(--navy-deep)] shadow-lg shadow-[var(--cyan)]/20 transition-all hover:bg-[var(--cyan-hover)] hover:shadow-xl hover:shadow-[var(--cyan)]/30"
              >
                Configurer mon PC
                <ChevronRightIcon
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>

              <Link
                href="/catalog?sort=price_asc"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white backdrop-blur transition-all hover:border-[var(--cyan)]/50 hover:bg-white/10"
              >
                Voir les promos
              </Link>
            </div>

            {/* Mini-stats */}
            <div className="mt-12 grid max-w-lg animate-fade-in-up grid-cols-3 gap-6 border-t border-white/10 pt-8 [animation-delay:400ms]">
              <div>
                <p className="text-2xl font-extrabold text-white sm:text-3xl tabular-nums">
                  840+
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">
                  Produits
                </p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-[var(--cyan)] sm:text-3xl tabular-nums">
                  24h
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">
                  Livraison
                </p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white sm:text-3xl tabular-nums">
                  3 ans
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">
                  Garantie
                </p>
              </div>
            </div>
          </div>

          {/* ============ COLONNE DROITE : CARTE FLOTTANTE ============ */}
          <div className="hidden lg:col-span-5 lg:block">
            <div className="relative animate-fade-in [animation-delay:500ms]">
              {/* Halo */}
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[var(--cyan)]/20 to-transparent blur-2xl" />

              {/* Carte produit */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[var(--navy-panel)]/80 p-6 backdrop-blur-xl">
                {/* Badge promo */}
                <div className="absolute right-4 top-4 rounded-md bg-[var(--orange)] px-2 py-1 text-[10px] font-bold uppercase text-white shadow-lg">
                  -15%
                </div>

                {/* Placeholder image */}
                <div className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-[var(--navy-core)] to-[var(--navy-deep)]">
                  <CpuIcon size={120} className="text-[var(--cyan)]/30" />
                </div>

                {/* Infos produit */}
                <div className="mt-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                    PC Gaming L&apos;AMI
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    Configuration Ultimate
                  </p>

                  {/* Specs */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70">
                      RTX 4070 Ti
                    </span>
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70">
                      Ryzen 7
                    </span>
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70">
                      32 Go
                    </span>
                  </div>

                  {/* Prix */}
                  <div className="mt-4 flex items-baseline gap-2">
                    <p className="text-2xl font-extrabold text-[var(--cyan)]">
                      11 000 000 Ar
                    </p>
                    <p className="text-sm text-white/40 line-through">
                      12 900 000 Ar
                    </p>
                  </div>

                  {/* CTA */}
                  <Link
                    href="/catalog"
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--cyan)] py-3 text-xs font-bold uppercase tracking-wide text-[var(--navy-deep)] transition hover:bg-[var(--cyan-hover)]"
                  >
                    <ZapIcon size={14} />
                    Decouvrir
                  </Link>
                </div>
              </div>

              {/* Badge flottant */}
              <div className="absolute -right-2 -top-2 rounded-xl border border-[var(--cyan)]/40 bg-[var(--navy-core)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--cyan)] shadow-xl">
                Propulse par IA
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
