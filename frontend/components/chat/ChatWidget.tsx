"use client";
/**
 * ChatWidget - UI pure.
 * ChatWidget (UI) -> useChat (logique) -> chatService (API)
 * L'ouverture vient du store global : « Demander a l'IA » fonctionne
 * widget ferme, et widget deja ouvert sur un autre produit.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/hooks/use-chat";
import { useChatStore } from "@/lib/chat-store";
import { DEFAULT_CHAT_CONFIG } from "@/lib/chat/chat-types";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { MessageIcon, XIcon, PlusIcon, ClockIcon, TrashIcon } from "@/components/ui/icons";

const STATUS_UI: Record<string, { dot: string; label: string }> = {
  online: { dot: "bg-emerald-400", label: "En ligne · repond en ~1 s" },
  degraded: { dot: "bg-amber-400", label: "Service degrade · reponses limitees" },
  offline: { dot: "bg-red-400", label: "Service indisponible" },
  unknown: { dot: "bg-slate-400", label: "Connexion au service..." },
};

export default function ChatWidget() {
  const chat = useChat();
  const consumePendingData = useChatStore((s) => s.consumePendingData);
  const pendingMessage = useChatStore((s) => s.pendingMessage);
  const pendingContext = useChatStore((s) => s.pendingContext);

  const bottomRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef(chat.sendMessage);
  sendRef.current = chat.sendMessage;

  const [mounted, setMounted] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages, chat.isLoading]);

  useEffect(() => {
    if (!chat.isOpen || !pendingMessage) return;
    const { message, context } = consumePendingData();
    if (message) void sendRef.current(message, context ?? undefined);
  }, [chat.isOpen, pendingMessage, pendingContext, consumePendingData]);

  if (!mounted) return null;

  const status = STATUS_UI[chat.serviceStatus] ?? STATUS_UI.unknown;

  return (
    <>
      <motion.button
        type="button"
        onClick={chat.toggleChat}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={chat.isOpen ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        className="fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--cyan)] to-blue-600 text-[var(--navy-deep)] shadow-xl transition-colors sm:bottom-6 sm:right-6 sm:rounded-full"
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
        {!chat.isOpen && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {chat.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            role="dialog"
            aria-label="Assistant L'AMI"
            className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[var(--bg-surface)] backdrop-blur-2xl sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(680px,calc(100vh_-_7.5rem))] sm:w-[420px] sm:rounded-3xl sm:border sm:border-[var(--border)] sm:shadow-2xl"
          >
            <header className="flex items-center gap-3 border-b border-[var(--border)] bg-gradient-to-r from-[var(--bg-surface)] to-[var(--bg-muted)] px-4 py-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--cyan)] to-blue-600 text-[var(--navy-deep)] shadow-lg">
                  <MessageIcon size={20} />
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[var(--bg-surface)] ${status.dot}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--fg-primary)]">
                  {chat.showHistory ? "Historique" : "Assistant L'AMI"}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
                  {chat.showHistory ? (
                    <>
                      <ClockIcon size={11} />
                      {chat.historyLoading
                        ? "Chargement..."
                        : `${chat.conversations.length} conversation${chat.conversations.length > 1 ? "s" : ""}`}
                    </>
                  ) : (
                    <>
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </>
                  )}
                </p>
              </div>

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
                <HeaderButton onClick={chat.closeChat} label="Fermer">
                  <XIcon size={16} />
                </HeaderButton>
              </div>
            </header>

            {chat.showHistory ? (
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
                        <div
                          className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
                            chat.conversationId === c.id
                              ? "bg-[var(--bg-muted)] ring-1 ring-[var(--cyan)]"
                              : "hover:bg-[var(--bg-muted)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => void chat.loadConversation(c.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-muted)] text-[var(--fg-muted)] group-hover:text-[var(--cyan)]">
                              <MessageIcon size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-[var(--fg-primary)]">
                                {c.title}
                              </span>
                              <span className="block text-[10px] text-[var(--fg-muted)]">
                                {c.message_count} msg ·{" "}
                                {new Date(c.last_message_at).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </span>
                            </span>
                          </button>

                          {confirmDeleteId === c.id ? (
                            <span className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteId(null);
                                  void chat.deleteConversation(c.id);
                                }}
                                className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-700"
                              >
                                Supprimer
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
                              >
                                Annuler
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(c.id)}
                              aria-label={`Supprimer ${c.title}`}
                              className="shrink-0 rounded-lg p-1.5 text-[var(--fg-muted)] opacity-0 transition hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-red-950"
                            >
                              <TrashIcon size={13} />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <>
                <div
                  className="chat-scroll flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4"
                  aria-live="polite"
                >
                  {chat.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} onAddToCart={chat.addProductToCart} />
                  ))}
                  {chat.isLoading && <TypingIndicator />}
                  <div ref={bottomRef} />
                </div>

                {chat.lastFailed && !chat.isLoading && (
                  <div className="flex items-center justify-between gap-3 border-t border-red-200 bg-red-50 px-4 py-2 dark:border-red-900 dark:bg-red-950">
                    <span className="text-[11px] font-medium text-red-700 dark:text-red-300">
                      Envoi echoue — « {chat.lastFailed.text.slice(0, 32)}
                      {chat.lastFailed.text.length > 32 ? "..." : ""} »
                    </span>
                    <button
                      type="button"
                      onClick={chat.retryLast}
                      className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-red-700 active:scale-95"
                    >
                      Reessayer
                    </button>
                  </div>
                )}

                {chat.isLoading && (
                  <div className="flex justify-center border-t border-[var(--border)] bg-[var(--bg-muted)] py-1.5">
                    <button
                      type="button"
                      onClick={chat.stopGeneration}
                      className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:border-red-400 hover:text-red-500"
                    >
                      Arreter la generation
                    </button>
                  </div>
                )}

                {chat.messages.length <= 1 && !chat.isLoading && (
                  <div className="chat-scroll flex gap-1.5 overflow-x-auto border-t border-[var(--border)] px-3 py-2">
                    {DEFAULT_CHAT_CONFIG.quickSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void chat.sendMessage(s)}
                        className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition hover:border-[var(--cyan)] hover:bg-[var(--bg-muted)] hover:text-[var(--cyan)]"
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

function HeaderButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
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

function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-muted)] text-[var(--fg-muted)]">
        <ClockIcon size={24} />
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--fg-secondary)]">Aucune conversation</p>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">Vos echanges apparaitront ici.</p>
    </div>
  );
}
