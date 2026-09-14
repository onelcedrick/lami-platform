"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Résout une URL de fichier :
 * - URLs MinIO internes → réécrites vers l'API Gateway
 * - URLs absolues → retournées telles quelles
 * - Chemins relatifs → préfixés par l'API_BASE
 */
function fileUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    if (rawUrl.includes("minio:") || rawUrl.includes(":9000/")) {
      const name = rawUrl.split("/").pop() || "";
      return `${API_BASE}/api/v1/tickets/files/${name}`;
    }
    return rawUrl;
  }
  if (rawUrl.startsWith("/api/")) return `${API_BASE}${rawUrl}`;
  return `${API_BASE}/api/v1/tickets/files/${rawUrl.replace(/^\//, "")}`;
}

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  mime_type: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  author_id: string;
  author_role: string;
  author_name?: string;
  content: string;
  attachments?: ChatAttachment[];
  is_internal?: boolean;
  created_at: string;
}

interface TicketChatProps {
  ticketId: string;
  messages: ChatMessage[];
  allowInternal?: boolean;
  onMessagesUpdated: (messages: ChatMessage[]) => void;
  apiBase?: string;
}

function isImage(mime: string) {
  return mime?.startsWith("image/");
}

function formatSize(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function TicketChat({
  ticketId,
  messages,
  allowInternal = false,
  onMessagesUpdated,
}: TicketChatProps) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = messages.filter((m) => allowInternal || !m.is_internal);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible.length]);

  // Polling + SSE pour messages en temps réel
  useEffect(() => {
    if (!ticketId) return;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const tok =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token") ||
          (JSON.parse(localStorage.getItem("lami-auth") || "{}")?.state
            ?.accessToken ?? null)
        : null;

    const poll = async () => {
      try {
        const res = await api.getTicket(ticketId);
        if (res.success && res.data) {
          const ticket = res.data as { messages?: ChatMessage[] };
          if (ticket.messages) onMessagesUpdated(ticket.messages);
        }
      } catch {
        /* silent */
      }
    };
    poll();
    pollTimer = setInterval(poll, 2000);

    let es: EventSource | null = null;
    try {
      const url = `${API_BASE}/api/v1/tickets/${ticketId}/stream?access_token=${encodeURIComponent(
        tok || ""
      )}`;
      es = new EventSource(url);
      es.addEventListener("messages", (ev) => {
        try {
          const msgs = JSON.parse(ev.data) as ChatMessage[];
          onMessagesUpdated(msgs);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        /* garde le polling */
      };
    } catch {
      /* SSE non dispo */
    }

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      es?.close();
    };
  }, [ticketId, onMessagesUpdated]);

  const uploadOne = async (file: File): Promise<ChatAttachment | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/v1/tickets/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const json = await res.json();
    if (json.success && json.data) return json.data as ChatAttachment;
    throw new Error(json.error || "Upload échoué");
  };

  const handleSend = async () => {
    if (!text.trim() && files.length === 0) return;
    setSending(true);
    setError("");
    try {
      const attachments: ChatAttachment[] = [];
      if (files.length > 0) {
        setUploading(true);
        for (const f of files) {
          const att = await uploadOne(f);
          if (att) attachments.push(att);
        }
        setUploading(false);
      }

      const res = await api.addTicketMessage(ticketId, {
        content: text.trim(),
        is_internal: allowInternal ? internal : false,
        attachments,
        author_name: user
          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
          : undefined,
      });

      if (res.success && res.data) {
        const ticket = res.data as { messages?: ChatMessage[] };
        if (ticket.messages) onMessagesUpdated(ticket.messages);
        setText("");
        setFiles([]);
        setInternal(false);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setError(res.error || "Envoi impossible");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const roleLabel = (role: string) => {
    if (role === "technician") return "Technicien";
    if (role === "admin" || role === "super_admin") return "Admin";
    return "Client";
  };

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
        Conversation
      </div>

      <div
        className="flex-1 space-y-3 overflow-y-auto p-4"
        style={{ maxHeight: 360 }}
      >
        {visible.length === 0 ? (
          <p className="text-center text-sm text-slate-400">
            Aucun message — démarrez la discussion
          </p>
        ) : (
          visible.map((m) => {
            const mine = m.author_id === user?.id;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.is_internal
                      ? "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                      : mine
                        ? "bg-primary-600 text-white"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  <p className="text-[10px] opacity-70">
                    {m.author_name || roleLabel(m.author_role)}
                    {m.is_internal ? " · note interne" : ""}
                    {" · "}
                    {new Date(m.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {m.content && (
                    <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
                  )}
                  {m.attachments && m.attachments.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {m.attachments.map((a) => (
                        <li key={a.id}>
                          {isImage(a.mime_type) ? (
                            <a
                              href={fileUrl(a.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={fileUrl(a.url)}
                                alt={a.name}
                                className="max-h-40 rounded-lg border border-white/20"
                              />
                            </a>
                          ) : (
                            <a
                              href={fileUrl(a.url)}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs underline ${
                                mine && !m.is_internal
                                  ? "bg-white/15"
                                  : "bg-white dark:bg-slate-900"
                              }`}
                            >
                              <span>📎 {a.name}</span>
                              <span className="opacity-60">
                                ({formatSize(a.size)})
                              </span>
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 text-xs text-red-600">{error}</p>}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2 dark:border-slate-800">
          {files.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800"
            >
              {f.name}
              <button
                type="button"
                className="text-red-500"
                onClick={() =>
                  setFiles((prev) => prev.filter((_, j) => j !== i))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 p-3 dark:border-slate-800">
        {allowInternal && (
          <label className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
            />
            Note interne (invisible au client)
          </label>
        )}
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files || []);
              setFiles((prev) => [...prev, ...list].slice(0, 5));
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            title="Joindre un fichier"
          >
            📎
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Écrire un message..."
            className="input-field flex-1 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="button"
            disabled={
              sending || uploading || (!text.trim() && files.length === 0)
            }
            onClick={handleSend}
            className="btn-primary self-end text-sm disabled:opacity-50"
          >
            {uploading ? "Upload..." : sending ? "..." : "Envoyer"}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          Images, PDF, Word, Excel, ZIP — max 10 Mo / fichier (5 max)
        </p>
      </div>
    </div>
  );
}
