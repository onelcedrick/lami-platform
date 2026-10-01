import Link from "next/link";
import { ChevronRightIcon, CpuIcon, StarIcon } from "@/components/ui/icons";
import NewArrivals from "@/components/home/NewArrivals";
import PopularProducts from "@/components/home/PopularProducts";
import HeroSection from "@/components/home/HeroSection";

const SERVICES = [
  {
    title: "Vente Matériel",
    desc: "Ordinateurs, écrans, composants PC, pièces détachées.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
    tint: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  },
  {
    title: "Dépannage",
    desc: "Diagnostic à distance, tickets support, chat IA + technicien.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  {
    title: "En Boutique",
    desc: "Paiement sur place, retrait immédiat, conseils à Toamasina.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    tint: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  },
  {
    title: "Garantie",
    desc: "Produits garantis, SAV inclus, Mobile Money (MVola, Orange, Airtel).",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m12 3 2.5 6.5L21 10l-5 4.5L17.5 21 12 17.5 6.5 21 8 14.5 3 10l6.5-.5L12 3z" />
      </svg>
    ),
    tint: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  },
];

const CATEGORIES = [
  { name: "CPU", desc: "Processeurs" },
  { name: "GPU", desc: "Cartes graphiques" },
  { name: "RAM", desc: "Mémoires" },
  { name: "Stockage", desc: "SSD & HDD" },
  { name: "PC Complets", desc: "Configurations" },
];

export default function HomePage() {
  return (
    <div className="bg-[var(--bg-app)] text-[var(--fg-primary)] transition-colors duration-300">
      {/* ===================== HERO ===================== */}
      <HeroSection />

      {/* ===================== SERVICES ===================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            <span className="bg-gradient-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent dark:from-primary-400 dark:to-accent-400">Nos services</span>
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Tout ce dont vous avez besoin pour votre matériel informatique
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-800/50 dark:hover:shadow-black/20"
            >
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${s.tint}`}>
                {s.icon}
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== PRODUITS POPULAIRES ===================== */}
      <PopularProducts />

      {/* ===================== NOUVEAUX ARRIVÉS ===================== */}
      <NewArrivals />

      {/* ===================== CATÉGORIES ===================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              <span className="bg-gradient-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent dark:from-primary-400 dark:to-accent-400">Catégories</span>
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Explorez nos composants et configurations
            </p>
          </div>
          <Link
            href="/catalog"
            className="hidden items-center gap-1 text-sm font-semibold text-primary-600 transition hover:gap-2 hover:text-primary-700 dark:text-primary-400 sm:inline-flex"
          >
            Tout voir
            <ChevronRightIcon size={16} />
          </Link>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              href={`/catalog?category=${encodeURIComponent(cat.name)}`}
              className="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-700"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600 transition group-hover:bg-primary-100 group-hover:scale-110 dark:bg-primary-500/15 dark:text-primary-400 dark:group-hover:bg-primary-500/25">
                <CpuIcon size={24} />
              </div>
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">
                {cat.name}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {cat.desc}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ===================== POURQUOI L'AMI ===================== */}
      <section className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              Pourquoi L&apos;AMI ?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Une plateforme pensée pour l&apos;informatique à Madagascar
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Assistant IA conversationnel",
                desc: "Choisissez usage et budget, l'IA propose la configuration optimale compatible.",
              },
              {
                title: "Support technique RAG",
                desc: "Posez vos questions techniques. Réponses contextuelles basées sur la base de connaissances.",
              },
              {
                title: "Conversational commerce",
                desc: "Discutez, configurez et payez. Mobile Money ou retrait en boutique à Toamasina.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                  <StarIcon size={20} />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CTA FINAL ===================== */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 px-6 py-14 text-center text-white sm:px-12 sm:py-20">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />

          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Prêt à configurer votre machine ?
            </h2>
            <p className="mt-4 text-base text-primary-100 sm:text-lg">
              Parcourez le catalogue ou laissez l&apos;IA vous guider.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/catalog"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-primary-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-primary-50"
              >
                Commencer
                <ChevronRightIcon
                  size={18}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/tickets"
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/10"
              >
                Support technique
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}