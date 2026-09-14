"use client";

import { useState, useRef, useEffect } from "react";
import { LogoIcon } from "@/components/ui/icons";
import { useCartStore } from "@/lib/store";
import { pushCartToServer } from "@/lib/sync-account";
import { useAuthStore } from "@/lib/store";
import { formatAriary } from "@/lib/currency";

interface Message {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  sources?: { title: string; score: number }[];
  cartAdded?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Bonjour, je suis l'assistant L'AMI. Support technique, recherche produits ou configuration PC : comment puis-je vous aider ?",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((s) => s.addItem);
  const isAuth = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);

    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/v1/ia/chat`, {
        method: "POST",
        headers,
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

      // Ajout panier si l'assistant a confirme
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
          content: data.reply || "Desole, une erreur est survenue.",
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
            "Le service IA est temporairement indisponible. Reessayez dans un instant.",
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
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label="Ouvrir l'assistant"
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Panneau chat */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[400px]">
          <div className="flex items-center gap-2.5 bg-primary-600 px-4 py-3 text-white">
            <LogoIcon size={28} />
            <div>
              <p className="text-sm font-semibold">Assistant L&apos;AMI</p>
              <p className="text-xs text-primary-200">RAG + Commerce IA</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary-600 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.mode && msg.role === "assistant" && (
                    <p className="mt-1.5 text-[10px] uppercase tracking-wide opacity-60">
                      mode: {msg.mode}
                    </p>
                  )}
                  {msg.cartAdded ? (
                    <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      {msg.cartAdded} article(s) ajoute(s) au panier
                    </p>
                  ) : null}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 border-t border-slate-200 pt-1.5">
                      <p className="text-[10px] font-medium text-slate-500">
                        Sources
                      </p>
                      {msg.sources.map((s, j) => (
                        <p key={j} className="text-[10px] text-slate-500">
                          {s.title} ({(s.score * 100).toFixed(0)}%)
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-400">
                  Reflexion...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="mb-2 flex flex-wrap gap-1">
              {[
                "PC gaming 3 millions Ar",
                "Config bureautique 1.5M Ar",
                "Oui, ajoute au panier",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                  onClick={() => setInput(s)}
                >
                  {s}
                </button>
              ))}
            </div>
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
                className="btn-primary px-3"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
