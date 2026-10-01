import Link from "next/link";
import {
  ChevronRightIcon,
  CpuIcon,
  StarIcon,
  BoxIcon,
  WrenchIcon,
  MapPinIcon,
  AwardIcon,
} from "@/components/ui/icons";
import AnimatedSection from "@/components/ui/AnimatedSection";
import NewArrivals from "@/components/home/NewArrivals";
import PopularProducts from "@/components/home/PopularProducts";
import HeroSection from "@/components/home/HeroSection";

const SERVICES = [
  {
    title: "Vente Matériel", desc: "Ordinateurs, écrans, composants PC, pièces détachées.",
    icon: <BoxIcon size={22} />,
    tint: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  },
  {
    title: "Dépannage", desc: "Diagnostic à distance, tickets support, chat IA + technicien.",
    icon: <WrenchIcon size={22} />,
    tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  {
    title: "En Boutique", desc: "Paiement sur place, retrait immédiat, conseils à Toamasina.",
    icon: <MapPinIcon size={22} />,
    tint: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  },
  {
    title: "Garantie", desc: "Produits garantis, SAV inclus, Mobile Money (MVola, Orange, Airtel).",
    icon: <AwardIcon size={22} />,
    tint: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  },
];

const CATEGORIES = [
  { name: "CPU", desc: "Processeurs" }, { name: "GPU", desc: "Cartes graphiques" },
  { name: "RAM", desc: "Mémoires" }, { name: "Stockage", desc: "SSD & HDD" },
  { name: "PC Complets", desc: "Configurations" },
];

export default function HomePage() {
  return (
    <div className="bg-[var(--bg-app)] text-[var(--fg-primary)] transition-colors duration-300">
      <HeroSection />

      <AnimatedSection className="space-section space-container">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="gradient-text">Nos services</span>
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--fg-secondary)]">Tout ce dont vous avez besoin pour votre matériel informatique</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s, i) => (
            <AnimatedSection key={s.title} delay={i * 0.1} className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 transition-all duration-300 hover-lift dark:border-zinc-800 dark:bg-zinc-900">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${s.tint}`}>{s.icon}</div>
              <h3 className="mt-4 font-semibold text-[var(--fg-primary)]">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--fg-secondary)]">{s.desc}</p>
            </AnimatedSection>
          ))}
        </div>
      </AnimatedSection>

      <PopularProducts />
      <NewArrivals />

      <AnimatedSection className="space-section space-container">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="gradient-text">Catégories</span>
            </h2>
            <p className="mt-2 text-sm text-[var(--fg-secondary)]">Explorez nos composants et configurations</p>
          </div>
          <Link href="/catalog" className="hidden items-center gap-1 text-sm font-semibold text-[var(--fg-accent)] transition hover:gap-2 sm:inline-flex">
            Tout voir <ChevronRightIcon size={16} />
          </Link>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIES.map((cat, i) => (
            <AnimatedSection key={cat.name} delay={i * 0.05}>
              <Link href={`/catalog?category=${encodeURIComponent(cat.name)}`} className="group flex flex-col items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center transition-all duration-300 hover-lift dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition group-hover:scale-110 dark:bg-blue-500/15 dark:text-blue-400 dark:group-hover:bg-blue-500/25">
                  <CpuIcon size={24} />
                </div>
                <h3 className="mt-3 font-semibold text-[var(--fg-primary)]">{cat.name}</h3>
                <p className="mt-1 text-xs text-[var(--fg-secondary)]">{cat.desc}</p>
              </Link>
            </AnimatedSection>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection className="border-y border-[var(--border)] bg-[var(--bg-surface)] py-16 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="space-container">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="gradient-text">Pourquoi L&apos;AMI ?</span>
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--fg-secondary)]">Une plateforme pensée pour l&apos;informatique à Madagascar</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { title: "Assistant IA conversationnel", desc: "Choisissez usage et budget, l'IA propose la configuration optimale compatible." },
              { title: "Support technique RAG", desc: "Posez vos questions techniques. Réponses contextuelles basées sur la base de connaissances." },
              { title: "Conversational commerce", desc: "Discutez, configurez et payez. Mobile Money ou retrait en boutique à Toamasina." },
            ].map((f, i) => (
              <AnimatedSection key={f.title} delay={i * 0.1} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 transition-all duration-300 hover-lift dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                  <StarIcon size={20} />
                </div>
                <h3 className="mt-4 font-semibold text-[var(--fg-primary)]">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--fg-secondary)]">{f.desc}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="space-section space-container">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 px-6 py-14 text-center text-white sm:px-12 sm:py-20">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">Prêt à configurer votre machine ?</h2>
            <p className="mt-4 text-base text-blue-100 sm:text-lg">Parcourez le catalogue ou laissez l&apos;IA vous guider.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/catalog" className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-blue-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50">
                Commencer <ChevronRightIcon size={18} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/tickets" className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/10">
                Support technique
              </Link>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
