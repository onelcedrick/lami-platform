"use client";

import { useEffect, useRef } from "react";

const BRANDS = [
  { name: "AMD", color: "text-red-500" },
  { name: "NVIDIA", color: "text-green-600" },
  { name: "Intel", color: "text-blue-600" },
  { name: "Samsung", color: "text-blue-700" },
  { name: "Corsair", color: "text-yellow-600" },
  { name: "MSI", color: "text-red-600" },
  { name: "ASUS", color: "text-slate-700" },
  { name: "Gigabyte", color: "text-orange-600" },
];

/**
 * Bandeau de marques avec défilement infini.
 * Utilise une double liste pour créer l'effet de boucle.
 */
export default function BrandMarquee() {
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <section className="border-y border-white/10 bg-black/20 py-8 backdrop-blur-sm">
      <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">
        Nos marques partenaires
      </p>

      <div className="relative overflow-hidden">
        {/* Dégradés de fondu sur les côtés */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-primary-900 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-primary-900 to-transparent" />

        {/* Track double pour l'effet infini */}
        <div
          ref={trackRef}
          className="flex animate-marquee items-center gap-16 whitespace-nowrap"
        >
          {[...BRANDS, ...BRANDS].map((brand, i) => (
            <span
              key={`${brand.name}-${i}`}
              className={`select-none text-2xl font-bold uppercase tracking-wider opacity-60 transition hover:opacity-100 sm:text-3xl ${brand.color}`}
            >
              {brand.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}