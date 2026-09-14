import Link from "next/link";
import { CpuIcon, ChevronRightIcon, StarIcon } from "@/components/ui/icons";
import NewArrivals from "@/components/home/NewArrivals";
import PopularProducts from "@/components/home/PopularProducts";

const SERVICES = [
  {
    title: "Vente Materiel",
    desc: "Ordinateurs, ecrans, composants PC, pieces detachees.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
    tint: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  },
  {
    title: "Depannage",
    desc: "Diagnostic a distance, tickets support, chat IA + technicien.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  {
    title: "En Boutique",
    desc: "Paiement sur place, retrait immediat, conseils a Toamasina.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    tint: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
  },
  {
    title: "Garantie",
    desc: "Produits garantis, SAV inclus, Mobile Money (MVola, Orange, Airtel).",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m12 3 2.5 6.5L21 10l-5 4.5L17.5 21 12 17.5 6.5 21 8 14.5 3 10l6.5-.5L12 3z" />
      </svg>
    ),
    tint: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  },
];

const CATEGORIES = [
  { name: "CPU", desc: "Processeurs" },
  { name: "GPU", desc: "Cartes graphiques" },
  { name: "RAM", desc: "Memoires" },
  { name: "Stockage", desc: "SSD & HDD" },
  { name: "PC Complets", desc: "Configurations" },
];

export default function HomePage() {
  return (
    <div className="bg-slate-50/80 dark:bg-slate-950">
      {/* Hero carte (inspire AM Info, enrichi L'AMI) */}
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 px-6 py-12 text-white shadow-xl shadow-primary-900/20 sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 right-20 h-48 w-48 rounded-full bg-primary-400/20 blur-2xl" />

          <div className="relative max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wider text-primary-200">
              L&apos;AMI — Toamasina, Madagascar
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
              Assistance &amp; Maintenance
              <span className="block text-primary-200">Informatique + IA</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-primary-100 sm:text-lg">
              Votre expert en materiel informatique et depannage technique a
              Madagascar. Configurez, achetez et obtenez un support intelligent.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary-700 shadow-sm transition hover:bg-primary-50"
              >
                Voir les produits
                <ChevronRightIcon size={16} />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/70 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Creer un compte
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-8 sm:gap-12">
              {[
                { value: "50+", label: "Produits" },
                { value: "24/7", label: "Assistance IA" },
                { value: "100%", label: "Satisfaction" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-bold sm:text-3xl">{s.value}</p>
                  <p className="text-xs text-primary-200 sm:text-sm">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Nos Services */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-center text-xl font-bold text-slate-800 dark:text-slate-100 sm:text-2xl">
          Nos Services
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div
                className={`inline-flex rounded-xl p-2.5 ${s.tint}`}
              >
                {s.icon}
              </div>
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-50">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Produits populaires */}
      <PopularProducts />

      {/* Nouveaux arrives */}
      <NewArrivals />

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 sm:text-2xl">
          Categories
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Explorez nos composants et configurations
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              href={`/catalog?category=${encodeURIComponent(cat.name)}`}
              className="card group flex flex-col items-center p-5 text-center transition hover:border-primary-300 hover:shadow-md"
            >
              <div className="rounded-full bg-primary-50 p-3 text-primary-600 transition group-hover:bg-primary-100 dark:bg-primary-950/50 dark:text-primary-400">
                <CpuIcon size={26} />
              </div>
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">
                {cat.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {cat.desc}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Pourquoi L'AMI — atouts IA */}
      <section className="bg-white py-14 dark:bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-xl font-bold text-slate-800 dark:text-slate-50 sm:text-2xl">
            Pourquoi L&apos;AMI ?
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Assistant IA conversationnel",
                desc: "Choisissez usage et budget, l'IA propose la configuration optimale compatible.",
              },
              {
                title: "Support technique RAG",
                desc: "Posez vos questions techniques. Reponses contextuelles basees sur la base de connaissances.",
              },
              {
                title: "Conversational commerce",
                desc: "Discutez, configurez et payez. Mobile Money ou retrait en boutique a Toamasina.",
              },
            ].map((f) => (
              <div key={f.title} className="card p-6">
                <div className="flex items-center gap-2 text-accent-500">
                  <StarIcon size={18} />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    {f.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-50 sm:text-2xl">
          Pret a configurer votre machine ?
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Parcourez le catalogue ou laissez l&apos;IA vous guider.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/catalog" className="btn-primary inline-flex">
            Commencer
            <ChevronRightIcon size={18} />
          </Link>
          <Link href="/tickets" className="btn-secondary inline-flex">
            Support technique
          </Link>
        </div>
      </section>
    </div>
  );
}
