import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, AlertCircle } from "lucide-react";
import { askAI } from "@/server/ai.functions";

export const Route = createFileRoute("/_app/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant — MediCore" }] }),
  component: AssistantPage,
});

type Msg = {
  role: "user" | "assistant";
  content: string;
};

function AssistantPage() {
  const { t } = useI18n();

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hello, I'm the MediCore assistant. I can help with general clinical questions and how to use the app. " +
        t("aiDisclaimer"),
    },
  ]);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const next: Msg[] = [
      ...messages,
      { role: "user", content: text },
    ];

    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const res = await askAI({ data: { messages: next } });

      setMessages([
        ...next,
        { role: "assistant", content: res.reply },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Assistant unavailable.";

      setMessages([
        ...next,
        {
          role: "assistant",
          content: `I do not have enough information. (${msg})`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-9rem)]">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">{t("assistant")}</h1>
      </div>

      <div className="rounded-md border bg-warning/10 text-sm px-3 py-2 mb-3 flex gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 text-warning" />
        <span>{t("aiDisclaimer")}</span>
      </div>

      <div className="flex-1 rounded-lg border bg-card p-4 overflow-y-auto space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="text-xs text-muted-foreground">
            {t("loading")}
          </div>
        )}

        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex gap-2"
      >
        <Input
          placeholder={t("aiPlaceholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
