"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { LogoIcon, PlusIcon, TrashIcon, MessageIcon, XIcon } from "@/components/ui/icons";
import { useCartStore, useAuthStore } from "@/lib/store";
import { pushCartToServer } from "@/lib/sync-account";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  sources?: { title: string; score: number }[];
  cartAdded?: number;
  created_at?: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  mode: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((s) => s.addItem);
  const isAuth = useAuthStore((s) => s.isAuthenticated);

  // ----- Session ID pour les anonymes -----
  const getSessionId = useCallback((): string => {
    if (typeof window === "undefined") return "";
    let sid = localStorage.getItem("lami-ia-session");
    if (!sid) {
      sid = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem("lami-ia-session", sid);
    }
    return sid;
  }, []);

  // ----- Headers -----
  const buildHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Session-Id": getSessionId(),
    };
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, [getSessionId]);

  // ----- Message d'accueil -----
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "Bonjour 👋 Je suis l'assistant L'AMI.\n\nJe peux vous aider pour :\n• Le support technique (diagnostic, guides)\n• La recherche de composants et configurations PC\n• La création de tickets support\n\nComment puis-je vous aider ?",
        },
      ]);
    }
  }, [messages.length]);

  // ----- Scroll auto -----
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // ----- Charger l'historique quand on ouvre -----
  useEffect(() => {
    if (open && showHistory) {
      loadConversations();
    }
  }, [open, showHistory]);

  const loadConversations = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ia/conversations`, {
        headers: buildHeaders(),
      });
      const json = await res.json();
      if (Array.isArray(json)) {
        setConversations(json);
      }
    } catch {
      /* silent */
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadConversation = async (id: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ia/conversations/${id}`, {
        headers: buildHeaders(),
      });
      const json = await res.json();
      if (json.messages) {
        setMessages(
          json.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            mode: m.mode,
            sources: m.sources,
            cartAdded: m.cart_added,
            created_at: m.created_at,
          }))
        );
        setConversationId(id);
        setShowHistory(false);
      }
    } catch {
      /* silent */
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer cette conversation ?")) return;
    try {
      await fetch(`${API_BASE}/api/v1/ia/conversations/${id}`, {
        method: "DELETE",
        headers: buildHeaders(),
      });
      setConversations((c) => c.filter((x) => x.id !== id));
      if (conversationId === id) {
        startNewConversation();
      }
    } catch {
      /* silent */
    }
  };

  const startNewConversation = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Nouvelle conversation démarrée. Comment puis-je vous aider ?",
      },
    ]);
    setConversationId(null);
    setShowHistory(false);
  };

  // ----- Envoi du message -----
  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/ia/chat`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          mode: "auto",
        }),
      });

      const json = await res.json();
      const data = json.data || json;

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      // Ajout panier
      let cartAdded = 0;
      const toolCalls = data.tool_calls || [];
      for (const tc of toolCalls) {
        if (
          (tc.name === "add_to_cart" || tc.name === "add_build_to_cart") &&
          tc.result?.items
        ) {
          for (const it of tc.result.items) {
            if (!it.product_id && !it.id) continue;
            addItem({
              productId: it.product_id || it.id,
              name: it.name || "Composant",
              price: Number(it.price) || 0,
              quantity: Number(it.quantity) || 1,
              image: it.image || undefined,
            });
            cartAdded++;
          }
        }
      }
      if (cartAdded > 0 && isAuth()) {
        void pushCartToServer();
      }

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.reply || "Désolé, une erreur est survenue.",
          mode: data.mode,
          cartAdded: cartAdded || undefined,
          sources: data.sources?.map((s: { title: string; score: number }) => ({
            title: s.title,
            score: s.score,
          })),
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Le service IA est temporairement indisponible. Réessayez dans un instant.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-xl shadow-primary-900/30 transition hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label="Ouvrir l'assistant"
      >
        {open ? (
          <XIcon size={24} />
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-emerald-400 ring-2 ring-white" />
          </>
        )}
      </button>

      {/* Panneau chat */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[600px] w-[380px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900 sm:w-[420px]">
          {/* Header */}
          <div className="relative flex items-center gap-3 bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-4 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <LogoIcon size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {showHistory ? "Historique" : "Assistant L'AMI"}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-primary-100">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {showHistory
                  ? `${conversations.length} conversation(s)`
                  : "En ligne · RAG + IA"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              title={showHistory ? "Nouvelle conversation" : "Historique"}
            >
              {showHistory ? <PlusIcon size={18} /> : <MessageIcon size={18} />}
            </button>
            {!showHistory && (
              <button
                type="button"
                onClick={startNewConversation}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                title="Nouvelle conversation"
              >
                <PlusIcon size={18} />
              </button>
            )}
          </div>

          {/* Vue historique */}
          {showHistory ? (
            <div className="flex-1 overflow-y-auto p-2">
              {historyLoading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                    />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageIcon size={32} className="text-slate-300 dark:text-slate-600" />
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Aucune conversation
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Commencez à discuter pour créer votre historique
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => loadConversation(c.id)}
                      className={`group flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
                        conversationId === c.id
                          ? "bg-primary-50 dark:bg-primary-950/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          conversationId === c.id
                            ? "bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        <MessageIcon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {c.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {c.message_count} message{c.message_count > 1 ? "s" : ""} ·{" "}
                          {new Date(c.last_message_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => deleteConversation(c.id, e)}
                        className="rounded-lg p-1.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                        title="Supprimer"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white">
                        <LogoIcon size={16} />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "rounded-br-sm bg-primary-600 text-white"
                          : "rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {msg.cartAdded ? (
                        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {msg.cartAdded} article(s) ajouté(s) au panier
                        </div>
                      ) : null}

                      {msg.sources && msg.sources.length > 0 && (
                        <details className="mt-2 border-t border-slate-200/60 pt-2 dark:border-slate-700">
                          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {msg.sources.length} source(s)
                          </summary>
                          <div className="mt-1.5 space-y-1">
                            {msg.sources.map((s, j) => (
                              <p
                                key={j}
                                className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400"
                              >
                                <span className="truncate">{s.title}</span>
                                <span className="shrink-0 rounded-full bg-primary-100 px-1.5 py-0.5 text-[9px] font-semibold text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
                                  {(s.score * 100).toFixed(0)}%
                                </span>
                              </p>
                            ))}
                          </div>
                        </details>
                      )}

                      {msg.mode && msg.role === "assistant" && (
                        <p className="mt-1.5 text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
                          {msg.mode}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2 justify-start">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white">
                      <LogoIcon size={16} />
                    </div>
                    <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 dark:bg-slate-800">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Suggestions rapides */}
              {messages.length <= 1 && (
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-2 dark:border-slate-800">
                  {[
                    "PC gaming 3M Ar",
                    "Config bureautique 1.5M",
                    "Écran bleu au démarrage",
                    "Voir le catalogue",
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInput(s)}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-primary-700 dark:hover:bg-primary-950/40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="border-t border-slate-100 p-3 dark:border-slate-800">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Posez votre question..."
                    className="input-field flex-1 text-sm"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}