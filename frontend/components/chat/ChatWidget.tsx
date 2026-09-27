"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { LogoIcon, PlusIcon, TrashIcon, MessageIcon, XIcon, CartIcon, StarIcon } from "@/components/ui/icons";
import { useCartStore, useAuthStore } from "@/lib/store";
import { pushCartToServer } from "@/lib/sync-account";
import { formatAriary } from "@/lib/currency";

interface ProductCardData {
  id: string;
  name: string;
  brand: string;
  price: number;
  stock: number;
  image?: string;
  slug?: string;
  rating?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  sources?: { title: string; score: number }[];
  cartAdded?: number;
  products?: ProductCardData[];
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

  const getSessionId = useCallback((): string => {
    if (typeof window === "undefined") return "";
    let sid = localStorage.getItem("lami-ia-session");
    if (!sid) {
      sid = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem("lami-ia-session", sid);
    }
    return sid;
  }, []);

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

  // Message d'accueil — SANS EMOJI
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "Bonjour, je suis l'assistant L'AMI.\n\nJe peux vous aider à :\n• Trouver des composants PC\n• Configurer une machine selon votre budget\n• Diagnostiquer un problème technique\n\nQue recherchez-vous ?",
        },
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open && showHistory) loadConversations();
  }, [open, showHistory]);

  const loadConversations = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ia/conversations`, {
        headers: buildHeaders(),
      });
      const json = await res.json();
      if (Array.isArray(json)) setConversations(json);
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
            products: m.products || [],
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
      if (conversationId === id) startNewConversation();
    } catch {
      /* silent */
    }
  };

  const startNewConversation = () => {
    setMessages([
      {
        role: "assistant",
        content: "Nouvelle conversation. Comment puis-je vous aider ?",
      },
    ]);
    setConversationId(null);
    setShowHistory(false);
  };

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

      if (data.conversation_id) setConversationId(data.conversation_id);

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
      if (cartAdded > 0 && isAuth()) void pushCartToServer();

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.reply || "Désolé, une erreur est survenue.",
          mode: data.mode,
          cartAdded: cartAdded || undefined,
          products: data.products || [],
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
          content: "Le service IA est temporairement indisponible. Réessayez dans un instant.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ----- Ajouter au panier depuis une card -----
  const handleAddToCart = (p: ProductCardData) => {
    addItem({
      productId: p.id,
      name: p.name,
      price: p.price,
      quantity: 1,
      image: p.image,
    });
    if (isAuth()) void pushCartToServer();
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

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[620px] w-[400px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-700/50 dark:bg-slate-900">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white">
              <LogoIcon size={22} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {showHistory ? "Historique" : "Assistant L'AMI"}
              </p>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {showHistory
                  ? `${conversations.length} conversation${conversations.length > 1 ? "s" : ""}`
                  : "En ligne"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              title={showHistory ? "Retour" : "Historique"}
            >
              {showHistory ? <PlusIcon size={16} /> : <MessageIcon size={16} />}
            </button>
            {!showHistory && (
              <button
                type="button"
                onClick={startNewConversation}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Nouvelle conversation"
              >
                <PlusIcon size={16} />
              </button>
            )}
          </div>

          {/* Vue historique */}
          {showHistory ? (
            <div className="flex-1 overflow-y-auto p-2">
              {historyLoading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageIcon size={28} className="text-slate-300 dark:text-slate-600" />
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Aucune conversation
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => loadConversation(c.id)}
                      className={`group flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition ${
                        conversationId === c.id
                          ? "bg-primary-50 dark:bg-primary-950/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          conversationId === c.id
                            ? "bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        <MessageIcon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                          {c.title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          {c.message_count} msg ·{" "}
                          {new Date(c.last_message_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => deleteConversation(c.id, e)}
                        className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                        title="Supprimer"
                      >
                        <TrashIcon size={12} />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
                        <LogoIcon size={14} />
                      </div>
                    )}
                    <div className="max-w-[85%] space-y-2">
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
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
                            {msg.cartAdded} article(s) ajouté(s)
                          </div>
                        ) : null}

                        {msg.sources && msg.sources.length > 0 && (
                          <details className="mt-2 border-t border-slate-200/60 pt-2 dark:border-slate-700">
                            <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {msg.sources.length} source(s)
                            </summary>
                            <div className="mt-1.5 space-y-1">
                              {msg.sources.map((s, j) => (
                                <p key={j} className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                  <span className="truncate">{s.title}</span>
                                  <span className="shrink-0 rounded-full bg-primary-100 px-1.5 py-0.5 text-[9px] font-semibold text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
                                    {(s.score * 100).toFixed(0)}%
                                  </span>
                                </p>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>

                      {/* ✅ Cards produits */}
                      {msg.products && msg.products.length > 0 && (
                        <div className="space-y-1.5">
                          {msg.products.map((p) => (
                            <ProductCardInline
                              key={p.id}
                              product={p}
                              onAdd={() => handleAddToCart(p)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2 justify-start">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
                      <LogoIcon size={14} />
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
                    "RTX 4070",
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
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white transition hover:bg-primary-700 disabled:opacity-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

// ---------------------------------------------------------------------------
// Card produit inline dans le chat
// ---------------------------------------------------------------------------

function ProductCardInline({
  product,
  onAdd,
}: {
  product: ProductCardData;
  onAdd: () => void;
}) {
  const href = `/product/${encodeURIComponent(product.slug || product.id)}`;

  return (
    <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-2 transition hover:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-primary-700">
      {/* Image */}
      <Link
        href={href}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700"
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            {product.brand?.slice(0, 2) || "?"}
          </div>
        )}
      </Link>

      {/* Infos */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={href}
          className="line-clamp-1 text-xs font-medium text-slate-900 hover:text-primary-600 dark:text-slate-100 dark:hover:text-primary-400"
        >
          {product.name}
        </Link>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">
          {product.brand}
        </p>
        <div className="mt-auto flex items-center justify-between gap-1.5 pt-1">
          <div className="min-w-0">
            <p className="text-xs font-bold text-primary-600 dark:text-primary-400">
              {formatAriary(product.price)}
            </p>
            {product.rating && product.rating > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                <StarIcon size={10} />
                {product.rating.toFixed(1)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onAdd}
            disabled={product.stock <= 0}
            className="flex h-6 shrink-0 items-center gap-1 rounded-md bg-primary-600 px-2 text-[10px] font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            <CartIcon size={10} />
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}