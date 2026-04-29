"use client";

import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";


export interface AIChatContext {
  type: "single_signal" | "all_signals";
  payload: unknown;
  /** Title shown in the dialog header */
  title: string;
  /** Pre-filled first user prompt — sent automatically on open */
  seedPrompt: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}


export function AIChatTrigger({
  context,
  variant = "icon",
  className,
}: {
  context: AIChatContext;
  variant?: "icon" | "button";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask AI"
          title="Ask AI about this signal"
          className={cn(
            "inline-flex items-center justify-center rounded-md p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-orange-200",
            className,
          )}
        >
          <Sparkles className="size-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-400",
            className,
          )}
        >
          <Sparkles className="size-3.5" />
          Ask AI
        </button>
      )}
      {open && (
        <AIChatDialog context={context} onClose={() => setOpen(false)} />
      )}
    </>
  );
}


function AIChatDialog({
  context,
  onClose,
}: {
  context: AIChatContext;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed the conversation with the default prompt on mount.
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    void send(context.seedPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || pending) return;
    setError(null);
    setPending(true);
    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          context: { type: context.type, payload: context.payload },
        }),
      });
      const data: { message?: string; error?: string } = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMessages([...next, { role: "assistant", content: data.message ?? "" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim()) return;
    void send(input);
    setInput("");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-t-xl border border-zinc-700 bg-zinc-950 shadow-2xl sm:h-[600px] sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-orange-300" />
            <span className="text-sm font-semibold text-zinc-100">
              {context.title}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && pending && (
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Loader2 className="size-3.5 animate-spin" />
              Thinking…
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-orange-500 text-white"
                    : "bg-zinc-900 text-zinc-100 border border-zinc-800",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {pending && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-300 inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Thinking…
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-md border border-rose-700 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="border-t border-zinc-800 p-3 flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
              }
            }}
            placeholder="Follow up with a question…"
            rows={1}
            className="flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="inline-flex items-center justify-center rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-400 disabled:opacity-50"
            aria-label="Send"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
