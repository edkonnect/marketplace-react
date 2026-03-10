import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BotMessage {
  id: number;
  role: "bot";
  text: string;
  /** Related questions shown when confidence is low */
  suggestions?: string[];
}

interface UserMessage {
  id: number;
  role: "user";
  text: string;
}

type Message = UserMessage | BotMessage;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WELCOME_MESSAGE: BotMessage = {
  id: 0,
  role: "bot",
  text: "Hi 👋 I'm the Help Assistant. I can help you with booking tutors, sessions, payments, or becoming a tutor. What would you like to know?",
};

const QUICK_SUGGESTIONS = [
  "Book a tutor",
  "Become a tutor",
  "Reschedule session",
  "Join session",
  "Contact support",
];

const LOW_CONFIDENCE_PREFIX =
  "I'm not completely sure what you mean. Did you want to know about:";

const FALLBACK_TEXT =
  "I couldn't find a good answer for that. You can contact support at support@edkonnect.com, or try one of the topics below.";

let idCounter = 1;
function nextId() {
  return idCounter++;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [location] = useLocation();

  const askMutation = trpc.chatbot.ask.useMutation();

  // Reset conversation to welcome message on every page navigation
  useEffect(() => {
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setOpen(false);
  }, [location]);

  // Auto-scroll to bottom on new messages or typing state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: UserMessage = { id: nextId(), role: "user", text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const result = await askMutation.mutateAsync({
        question: trimmed,
        pageUrl: location,
      });

      let botMsg: BotMessage;

      if (result.matched) {
        // Confident answer — show it directly
        botMsg = {
          id: nextId(),
          role: "bot",
          text: result.answer,
        };
      } else if (result.suggestions && result.suggestions.length > 0) {
        // Low confidence — show clarification with clickable suggestion chips
        botMsg = {
          id: nextId(),
          role: "bot",
          text: LOW_CONFIDENCE_PREFIX,
          suggestions: result.suggestions,
        };
      } else {
        // Nothing found at all — generic fallback
        botMsg = {
          id: nextId(),
          role: "bot",
          text: FALLBACK_TEXT,
          suggestions: QUICK_SUGGESTIONS.slice(0, 3),
        };
      }

      setMessages(prev => [...prev, botMsg]);
    } catch {
      const errorMsg: BotMessage = {
        id: nextId(),
        role: "bot",
        text: "Something went wrong. Please try again or contact support at support@edkonnect.com.",
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // Positioned left of the coordinator FAB (right-24 ≈ 96px from edge vs coordinator's right-6)
  return (
    <div className="fixed bottom-5 right-24 z-50 flex flex-col items-end gap-3">
      {/* Chat Panel */}
      {open && (
        <div className="flex flex-col w-[360px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-8rem)] rounded-2xl shadow-2xl border border-border bg-background overflow-hidden">
          {/* Header — violet gradient to stay visually distinct from coordinator's bg-primary */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">✨</span>
              <div>
                <p className="text-sm font-semibold leading-none">
                  Help Assistant
                </p>
                <p className="text-xs opacity-75 mt-0.5">Ask me anything</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 hover:bg-white/20 transition-colors"
              aria-label="Close chat"
            >
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className="flex flex-col gap-1.5">
                {/* Bubble */}
                <div
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}
                  >
                    {msg.text}
                  </div>
                </div>

                {/* Suggestion chips — only on bot messages with suggestions */}
                {msg.role === "bot" &&
                  (msg as BotMessage).suggestions &&
                  (msg as BotMessage).suggestions!.length > 0 && (
                    <div className="flex flex-col gap-1.5 pl-1">
                      {(msg as BotMessage).suggestions!.map(s => (
                        <button
                          key={s}
                          onClick={() => sendMessage(s)}
                          className="self-start text-xs px-3 py-1.5 rounded-full border border-primary/50 text-primary bg-primary/5 hover:bg-primary/15 transition-colors text-left"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1.5 items-center">
                  <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {/* Quick suggestion chips — only shown on initial welcome */}
            {messages.length === 1 && !isTyping && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border px-3 py-2.5 flex gap-2 items-center bg-background">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a question…"
              disabled={isTyping}
              className="flex-1 text-sm bg-muted rounded-full px-4 py-2 outline-none placeholder:text-muted-foreground disabled:opacity-50 focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-primary/90 transition-colors"
              aria-label="Send message"
            >
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button — animated sparkle, visually distinct from coordinator MessageSquare */}
      <div className="relative">
          <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            "relative size-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
            open
              ? "bg-muted text-foreground hover:bg-muted/80"
              : "bg-gradient-to-br from-violet-600 to-indigo-600 text-white hover:scale-105 hover:shadow-violet-400/40 hover:shadow-xl"
          )}
          aria-label={open ? "Close chat" : "Open help assistant"}
        >
          {open ? (
            /* X to close */
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            /* ❓ Help bubble icon */
            <span className="flex flex-col items-center justify-center leading-none animate-pulse">
              <span className="text-2xl">❓</span>
              <span className="text-[9px] font-bold tracking-wide mt-0.5 opacity-90">Help</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
