import Link from "next/link";
import { ChevronRightIcon, StarIcon } from "@/components/ui/icons";
import AnimatedSection from "@/components/ui/AnimatedSection";
import NewArrivals from "@/components/home/NewArrivals";
import PopularProducts from "@/components/home/PopularProducts";
import HeroSection from "@/components/home/HeroSection";
import TrustBar from "@/components/home/TrustBar";
import CategoryGrid from "@/components/home/CategoryGrid";
import PromoCards from "@/components/home/PromoCards";

const FEATURES = [
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
];

export default function HomePage() {
  return (
    <div className="bg-[var(--bg-app)] text-[var(--fg-primary)] transition-colors duration-300">
      {/* 1. Hero */}
      <HeroSection />

      {/* 2. Barre de confiance */}
      <TrustBar />

      {/* 3. Categories rapides */}
      <CategoryGrid />

      {/* 4. Produits populaires */}
      <PopularProducts />

      {/* 5. Bannieres promo */}
      <PromoCards />

      {/* 6. Nouveautes */}
      <NewArrivals />

      {/* 7. Pourquoi L'AMI */}
      <AnimatedSection className="border-y border-[var(--border)] bg-[var(--bg-surface)] py-16">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-10 xl:px-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-md bg-[var(--cyan)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cyan)]">
              Notre difference
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Pourquoi choisir L&apos;AMI ?
            </h2>
            <p className="mt-3 text-sm text-[var(--fg-secondary)]">
              Une plateforme pensee pour l&apos;informatique a Madagascar
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <AnimatedSection
                key={f.title}
                delay={i * 0.1}
                className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 transition-all hover:-translate-y-1 hover:border-[var(--cyan)]/40 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--cyan)]/10 text-[var(--cyan)] transition-transform group-hover:scale-110">
                  <StarIcon size={22} />
                </div>
                <h3 className="mt-4 font-bold text-[var(--fg-primary)]">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--fg-secondary)]">
                  {f.desc}
                </p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* 8. CTA final */}
      <AnimatedSection className="py-16 sm:py-20">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-10 xl:px-16">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--navy-core)] via-[var(--navy-panel)] to-[var(--navy-deep)] px-6 py-14 text-center sm:px-12 sm:py-20">
            {/* Halos */}
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--cyan)]/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[var(--orange)]/10 blur-3xl" />

            <div className="relative mx-auto max-w-2xl">
              <span className="inline-block rounded-md bg-[var(--cyan)]/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cyan)] backdrop-blur">
                Pret a commencer ?
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Configurez votre machine
                <br />
                <span className="text-[var(--cyan)]">en quelques clics.</span>
              </h2>
              <p className="mt-4 text-base text-white/70 sm:text-lg">
                Parcourez le catalogue ou laissez notre IA vous guider.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/catalog"
                  className="group inline-flex items-center gap-2 rounded-lg bg-[var(--cyan)] px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-[var(--navy-deep)] shadow-lg shadow-[var(--cyan)]/30 transition-all hover:bg-[var(--cyan-hover)] hover:shadow-xl"
                >
                  Parcourir le catalogue
                  <ChevronRightIcon
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  href="/tickets"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white backdrop-blur transition-all hover:border-[var(--cyan)]/50 hover:bg-white/10"
                >
                  Support technique
                </Link>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
