import Link from "next/link";
import { LogoIcon } from "@/components/ui/icons";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 dark:bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoIcon size={32} />
              <span className="text-lg font-bold text-white">L&apos;AMI</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Plateforme e-commerce intelligente et support technique assiste
              par IA. Composants PC, configurations et assistance expert.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Boutique
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/catalog" className="hover:text-white">
                  Catalogue
                </Link>
              </li>
              <li>
                <Link href="/catalog?usage=gaming" className="hover:text-white">
                  Gaming
                </Link>
              </li>
              <li>
                <Link href="/catalog?category=PC Complets" className="hover:text-white">
                  PC Complets
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Support
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/tickets" className="hover:text-white">
                  Creer un ticket
                </Link>
              </li>
              <li>
                <Link href="/catalog" className="hover:text-white">
                  Catalogue produits
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Compte
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/login" className="hover:text-white">
                  Connexion
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white">
                  Inscription
                </Link>
              </li>
              <li>
                <Link href="/profile" className="hover:text-white">
                  Mon profil
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} L&apos;AMI Platform -
          Tous droits reserves.
        </div>
      </div>
    </footer>
  );
}
