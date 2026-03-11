import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { type Message, streamChat } from "@/lib/gemini";

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false),
      });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      upsertAssistant("\n\n*An error occurred. Please try again.*");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto px-6">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pt-16 pb-8">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="font-serif text-muted-foreground text-xl italic">
              Begin a conversation.
            </p>
          </div>
        )}

        <div className="space-y-16">
          {messages.map((msg, i) => (
            <div key={i}>
              <div
                className={`font-serif text-lg leading-relaxed ${
                  msg.role === "user"
                    ? "text-muted-foreground"
                    : "text-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-stone max-w-none [&_*]:font-serif [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_p]:leading-relaxed [&_code]:font-mono [&_code]:text-sm [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator: pulsing dot */}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="py-2">
              <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse-dot" />
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="sticky bottom-0 bg-background pb-8 pt-4">
        <div className="flex items-end gap-4 border-b-2 border-input focus-within:border-accent transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Gemini..."
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none bg-transparent py-3 font-sans text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="pb-3 font-sans text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
