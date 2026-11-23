"use client";
/**
 * ============================================================
 * CHAT WIDGET — coquille ultra-moderne & responsive
 * ============================================================
 * ARCHITECTURE CLEAN :
 *   ChatWidget (UI) → useChat (logique) → chatService (API)
 *
 * RESPONSIVE :
 *   - Mobile  : panneau plein écran (inset-0) + safe-area
 *   - Desktop : carte flottante 420px, coins arrondis, ombre profonde
 *
 * DESIGN : glassmorphism, dégradés cyan/bleu, micro-animations
 * spring (framer-motion), scrollbar fine personnalisée.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/hooks/use-chat";
import { useChatStore } from "@/lib/chat-store";
import { DEFAULT_CHAT_CONFIG } from "@/lib/chat/chat-types";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { MessageIcon, XIcon, PlusIcon, ClockIcon, TrashIcon } from "@/components/ui/icons";

export default function ChatWidget() {
  const chat = useChat();
  const consumePendingData = useChatStore((s) => s.consumePendingData);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Scroll automatique vers le dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages, chat.isLoading]);

  // Consomme le message/contexte en attente (bouton "Demander à l'IA")
  useEffect(() => {
    if (!chat.isOpen) return;
    const { message, context } = consumePendingData();
    if (message) void chat.sendMessage(message, context ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.isOpen]);

  if (!mounted) return null;

  return (
    <>
      {/* ============ BOUTON FLOTTANT ============ */}
      <motion.button
        type="button"
        onClick={chat.toggleChat}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={chat.isOpen ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        className="fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--cyan)] to-blue-600 text-[var(--navy-deep)] shadow-xl shadow-[var(--cyan)]/30 transition-colors sm:bottom-6 sm:right-6 sm:rounded-full"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={chat.isOpen ? "close" : "open"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center justify-center"
          >
            {chat.isOpen ? <XIcon size={24} /> : <MessageIcon size={24} />}
          </motion.span>
        </AnimatePresence>
        {/* Pastille "en ligne" */}
        {!chat.isOpen && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
          </span>
        )}
      </motion.button>

      {/* ============ PANNEAU DE CHAT ============ */}
      <AnimatePresence>
        {chat.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            role="dialog"
            aria-label="Assistant L'AMI"
            className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[var(--bg-surface)]/95 backdrop-blur-2xl sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(680px,calc(100vh-7.5rem))] sm:w-[420px] sm:rounded-3xl sm:border sm:border-[var(--border)] sm:shadow-2xl sm:shadow-black/20"
          >
            {/* ---------- EN-TÊTE GLASS ---------- */}
            <header className="flex items-center gap-3 border-b border-[var(--border)] bg-gradient-to-r from-[var(--bg-surface)]/90 to-[var(--bg-muted)]/60 px-4 py-3 backdrop-blur-xl">
              {/* Avatar dégradé + halo */}
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--cyan)] to-blue-600 text-[var(--navy-deep)] shadow-lg shadow-[var(--cyan)]/30">
                  <MessageIcon size={20} />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[var(--bg-surface)]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--fg-primary)]">
                  {chat.showHistory ? "Historique" : "Assistant L'AMI"}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
                  {chat.showHistory ? (
                    <>
                      <ClockIcon size={11} />
                      {chat.historyLoading ? "Chargement…" : `${chat.conversations.length} conversation${chat.conversations.length > 1 ? "s" : ""}`}
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      En ligne · répond en ~3 s
                    </>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <HeaderButton
                  onClick={chat.toggleHistory}
                  label={chat.showHistory ? "Retour au chat" : "Historique"}
                >
                  {chat.showHistory ? <MessageIcon size={16} /> : <ClockIcon size={16} />}
                </HeaderButton>
                {!chat.showHistory && (
                  <HeaderButton onClick={chat.startNewConversation} label="Nouvelle conversation">
                    <PlusIcon size={16} />
                  </HeaderButton>
                )}
                {/* Fermer (surtout utile en mobile plein écran) */}
                <HeaderButton onClick={chat.closeChat} label="Fermer">
                  <XIcon size={16} />
                </HeaderButton>
              </div>
            </header>

            {/* ---------- CONTENU ---------- */}
            {chat.showHistory ? (
              /* ===== VUE HISTORIQUE ===== */
              <div className="chat-scroll flex-1 overflow-y-auto p-2">
                {chat.historyLoading ? (
                  <div className="space-y-2 p-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--bg-muted)]" />
                    ))}
                  </div>
                ) : chat.conversations.length === 0 ? (
                  <EmptyHistory />
                ) : (
                  <ul className="space-y-1">
                    {chat.conversations.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => void chat.loadConversation(c.id)}
                          className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                            chat.conversationId === c.id
                              ? "bg-[var(--cyan)]/10 ring-1 ring-[var(--cyan)]/40"
                              : "hover:bg-[var(--bg-muted)]"
                          }`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-muted)] text-[var(--fg-muted)] group-hover:text-[var(--cyan)]">
                            <MessageIcon size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-[var(--fg-primary)]">{c.title}</span>
                            <span className="block text-[10px] text-[var(--fg-muted)]">
                              {c.message_count} msg ·{" "}
                              {new Date(c.last_message_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            </span>
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              void chat.deleteConversation(c.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.stopPropagation();
                                void chat.deleteConversation(c.id);
                              }
                            }}
                            className="rounded-lg p-1.5 text-[var(--fg-muted)] opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/40"
                            aria-label={`Supprimer ${c.title}`}
                          >
                            <TrashIcon size={13} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              /* ===== VUE MESSAGES ===== */
              <>
                <div className="chat-scroll flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4">
                  {chat.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} onAddToCart={chat.addProductToCart} />
                  ))}
                  {chat.isLoading && <TypingIndicator />}
                  <div ref={bottomRef} />
                </div>

                {/* Suggestions rapides (premier écran) */}
                {chat.messages.length <= 1 && (
                  <div className="chat-scroll flex gap-1.5 overflow-x-auto border-t border-[var(--border)] px-3 py-2">
                    {DEFAULT_CHAT_CONFIG.quickSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void chat.sendMessage(s)}
                        className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:border-[var(--cyan)]/60 hover:bg-[var(--cyan)]/10 hover:text-[var(--cyan)]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <ChatInput disabled={chat.isLoading} onSubmit={(t) => void chat.sendMessage(t)} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------ */
/* Sous-composants locaux                                        */
/* ------------------------------------------------------------ */

/** Bouton d'action de l'en-tête (icône seule, avec tooltip) */
function HeaderButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)] active:scale-95"
    >
      {children}
    </button>
  );
}

/** État vide de l'historique */
function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-muted)] text-[var(--fg-muted)]">
        <ClockIcon size={24} />
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--fg-secondary)]">Aucune conversation</p>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">Vos échanges apparaîtront ici.</p>
    </div>
  );
}
