"use client";
/**
 * ============================================================
 * BULLE DE MESSAGE — rendu moderne d'un message du chat
 * ============================================================
 * CORRECTIONS :
 *  - Le badge panier utilise `(cartAdded ?? 0) > 0` : plus de "0"
 *    parasite rendu par React (0 && ... => 0).
 *  - Stock absent => pas de mention "Rupture" erronee.
 * DESIGN : bulles en degrade / glassmorphism, avatar gradient,
 * horodatage discret au survol uniquement.
 */
import { motion } from "framer-motion";
import type { ChatMessage, ChatProduct } from "@/lib/chat/chat-types";
import MarkdownRenderer from "./MarkdownRenderer";
import SourceCitations from "./SourceCitations";
import ProductCardChat from "./ProductCardChat";

interface MessageBubbleProps {
  message: ChatMessage;
  onAddToCart: (product: ChatProduct) => void;
}

/** Petite icone robot (avatar assistant) */
function BotIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 8V4M9 4h6" />
      <circle cx="9" cy="14" r="1" fill="currentColor" />
      <circle cx="15" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

/** Icone alerte (message d'erreur) */
function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function MessageBubble({ message, onAddToCart }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.role === "error";
  // ✅ Garde-fou : undefined/null => 0, et surtout pas de rendu JSX du 0
  const cartAdded = message.cartAdded ?? 0;

  // Classes de bulle selon le role
  const bubbleClass = isUser
    ? "rounded-2xl rounded-br-md bg-gradient-to-br from-[var(--cyan)] to-blue-600 text-[var(--navy-deep)] shadow-lg shadow-[var(--cyan)]/20"
    : isError
    ? "rounded-2xl rounded-bl-md border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
    : "rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--bg-surface)]/85 text-[var(--fg-primary)] shadow-sm backdrop-blur dark:bg-slate-800/60";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`group flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Avatar assistant (gradient + ring) */}
      {!isUser && (
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-md ring-2 ${
            isError
              ? "bg-gradient-to-br from-red-500 to-rose-600 ring-red-300/40 dark:ring-red-900/40"
              : "bg-gradient-to-br from-[var(--cyan)] to-blue-600 ring-[var(--cyan)]/25"
          }`}
          aria-hidden="true"
        >
          {isError ? <WarnIcon /> : <BotIcon />}
        </div>
      )}

      {/* Colonne contenu */}
      <div className={`flex max-w-[85%] flex-col gap-2 sm:max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Bulle principale */}
        <div className={`px-4 py-2.5 ${bubbleClass}`}>
          <MarkdownRenderer content={message.content} />

          {/* ✅ Badge panier (ne s'affiche QUE si > 0) */}
          {cartAdded > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {cartAdded} article{cartAdded > 1 ? "s" : ""} ajouté{cartAdded > 1 ? "s" : ""} au panier
            </div>
          )}
        </div>

        {/* Cartes produits inline */}
        {!isUser && message.products && message.products.length > 0 && (
          <div className="grid w-full gap-2">
            {message.products.map((p) => (
              <ProductCardChat key={p.id} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}

        {/* Sources RAG dépliables */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full">
            <SourceCitations sources={message.sources} />
          </div>
        )}

        {/* Horodatage discret (visible au survol) */}
        <span className="px-1 text-[10px] text-[var(--fg-muted)] opacity-0 transition-opacity group-hover:opacity-100">
          {message.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}
