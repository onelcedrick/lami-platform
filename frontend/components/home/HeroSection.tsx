"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";
import { useAuthStore } from "@/lib/store";
import StatsCounter from "./StatsCounter";
import BrandMarquee from "./BrandMarquee";

export default function HeroSection() {
  const user = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isVisitor = mounted && !user;

  return (
    <section className="relative overflow-hidden">
      {/* Gradient de fond */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900" />

      {/* Blobs animés */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] animate-pulse rounded-full bg-primary-400 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-[28rem] w-[28rem] animate-pulse rounded-full bg-blue-500 blur-3xl [animation-delay:1s]" />
        <div className="absolute right-1/3 top-1/2 h-72 w-72 animate-pulse rounded-full bg-violet-500/60 blur-3xl [animation-delay:2s]" />
      </div>

      {/* Grille subtile */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8 lg:pb-32 lg:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          {/* Colonne gauche : Texte */}
          <div className="lg:col-span-7">
            <div className="animate-fade-in-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Toamasina · Madagascar
              </span>
            </div>

            <h1 className="mt-6 animate-fade-in-up text-4xl font-bold leading-[1.05] tracking-tight text-white [animation-delay:100ms] sm:text-5xl lg:text-6xl xl:text-7xl">
              Assistance & maintenance
              <span className="mt-2 block bg-gradient-to-r from-primary-200 via-white to-primary-100 bg-clip-text text-transparent">
                informatique + IA
              </span>
            </h1>

            <p className="mt-6 max-w-xl animate-fade-in-up text-base leading-relaxed text-primary-100 [animation-delay:200ms] sm:text-lg">
              Votre expert en matériel informatique et dépannage technique à
              Madagascar. Configurez, achetez et obtenez un support intelligent.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3 animate-fade-in-up [animation-delay:300ms] sm:flex-row">
              <Link
                href="/catalog"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-primary-700 shadow-xl shadow-primary-900/30 transition hover:-translate-y-0.5 hover:bg-primary-50 hover:shadow-2xl"
              >
                Voir les produits
                <ChevronRightIcon
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>

              {isVisitor ? (
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/10"
                >
                  Créer un compte
                </Link>
              ) : (
                <Link
                  href="/tickets"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/10"
                >
                  Support technique
                </Link>
              )}
            </div>

            {/* Stats animés */}
            <div className="mt-14 grid max-w-lg animate-fade-in-up grid-cols-3 gap-6 border-t border-white/15 pt-8 [animation-delay:400ms]">
              <StatsCounter value="50+" label="Produits" />
              <StatsCounter value="24/7" label="Assistance IA" />
              <StatsCounter value="100%" label="Satisfaction" />
            </div>
          </div>

          {/* Colonne droite : Carte flottante produit vedette */}
          <div className="hidden lg:col-span-5 lg:block">
            <div className="relative animate-fade-in [animation-delay:500ms]">
              {/* Halo */}
              <div className="absolute -inset-4 rounded-3xl bg-white/10 blur-2xl" />

              {/* Carte flottante */}
              <div className="relative rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Configuration vedette
                </div>

                <div className="mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500/30 to-primary-800/50">
                  <div className="flex h-full items-center justify-center">
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" opacity="0.5">
                      <rect width="16" height="16" x="4" y="4" rx="2" />
                      <rect width="6" height="6" x="9" y="9" rx="1" />
                      <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
                    </svg>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs text-primary-200">PC Gaming L'AMI Ultimate</p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    11 000 000 Ar
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-primary-200">
                    <span className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      4.6
                    </span>
                    <span>•</span>
                    <span>Stock : 10</span>
                    <span>•</span>
                    <span>Garantie 2 ans</span>
                  </div>
                </div>

                <Link
                  href="/catalog"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                  Découvrir
                  <ChevronRightIcon size={16} />
                </Link>
              </div>

              {/* Badge flottant "IA" */}
              <div className="absolute -right-3 -top-3 rounded-2xl border border-white/20 bg-gradient-to-br from-emerald-400 to-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xl">
                ✨ Propulsé par IA
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bandeau marques */}
      <BrandMarquee />
    </section>
  );
}