import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, Send, Sparkles, User } from "lucide-react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/**
 * Parent assistant chat. Drop <ParentChatBot /> anywhere on the parent dashboard.
 * Talks to the server procedures `parentChat.chat` and `parentChat.suggest`
 * (server/ai/parentChatbot.ts).
 *
 * - Quick questions appear INSIDE the chat, right under the latest answer, and change
 *   after every answer based on the conversation.
 * - The chat scrolls to the newest message by itself.
 * - Links in answers (like session recordings) open in a new tab.
 */

type ChatMessage = { role: "user" | "assistant"; content: string };

const DEFAULT_QUESTIONS = [
  "When is our next session?",
  "What was covered in the last session?",
  "Is there any homework due?",
  "Show me the session recording",
];

export function ParentChatBot({ height = "min(72vh, 680px)" }: { height?: string | number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_QUESTIONS);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = trpc.parentChat.chat.useMutation();
  const suggestMutation = trpc.parentChat.suggest.useMutation();
  const isThinking = chatMutation.isPending;
  const isLoadingSuggestions = suggestMutation.isPending;

  // Always show the newest message (scrolls only the chat box, never the whole page).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking, isLoadingSuggestions, suggestions]);

  const send = (text: string) => {
    const content = text.trim();
    if (!content || isThinking) return;

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    textareaRef.current?.focus();

    chatMutation.mutate(
      {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        messages: next,
      },
      {
        onSuccess: (data) => {
          const withReply: ChatMessage[] = [...next, { role: "assistant", content: data.reply }];
          setMessages(withReply);

          // Fresh quick questions based on this conversation (shown under the answer).
          setSuggestions([]);
          suggestMutation.mutate(
            { messages: withReply.slice(-6) },
            {
              onSuccess: (res) => setSuggestions(res.suggestions.length > 0 ? res.suggestions : DEFAULT_QUESTIONS),
              onError: () => setSuggestions(DEFAULT_QUESTIONS),
            }
          );
        },
        onError: (error) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `⚠️ ${error.message || "Something went wrong. Please try again."}` },
          ]);
          setSuggestions(DEFAULT_QUESTIONS);
        },
      }
    );
  };

  const reset = () => {
    if (isThinking) return;
    setMessages([]);
    setSuggestions(DEFAULT_QUESTIONS);
    setInput("");
  };

  // Open links from answers (e.g. recordings) in a new tab instead of leaving the dashboard.
  const handleLinkClick = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (anchor && /^https?:/i.test(anchor.href)) {
      e.preventDefault();
      window.open(anchor.href, "_blank", "noopener,noreferrer");
    }
  };

  const chips = (items: string[], className?: string) => (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => send(q)}
          disabled={isThinking}
          className="rounded-full border border-primary/30 bg-background px-3.5 py-1.5 text-left text-sm text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm"
      style={{ height, minHeight: 420 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">EdKonnect Assistant</p>
            <p className="text-xs text-muted-foreground">Sessions, notes, recordings, homework and quizzes</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={isThinking} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="size-3.5" />
            New chat
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} onClick={handleLinkClick} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Hi! How can I help today?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask about your child's sessions, recordings, homework, quiz results and test dates.
              </p>
            </div>
            {chips(suggestions, "max-w-xl justify-center")}
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={cn("flex items-start gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    m.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_a]:font-medium [&_a]:text-primary [&_a]:underline">
                      <Streamdown>{m.content}</Streamdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="size-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Checking your records…
                </div>
              </div>
            )}

            {/* Quick questions, right under the latest answer */}
            {!isThinking && (
              <div className="pl-11">
                {isLoadingSuggestions || suggestions.length === 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2].map((n) => (
                      <div key={n} className="h-8 w-44 animate-pulse rounded-full bg-muted" />
                    ))}
                  </div>
                ) : (
                  chips(suggestions)
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t bg-background/60 p-3"
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about sessions, recordings, homework, quizzes or test dates..."
          className="max-h-32 min-h-9 flex-1 resize-none"
          rows={1}
        />
        <Button type="submit" size="icon" disabled={!input.trim() || isThinking} className="h-[38px] w-[38px] shrink-0">
          {isThinking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}

export default ParentChatBot;