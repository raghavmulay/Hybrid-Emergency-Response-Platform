import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useConversationSocket, type Message } from "../hooks/useConversationSocket";

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const [text, setText] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);

  // Load historic messages
  const { data: history = [], isLoading: historyLoading } = useQuery<Message[]>({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data } = await api.get(`/conversations/${id}/messages`);
      return data;
    },
    enabled: !!id,
  });

  // Live messages via WebSocket
  const { messages: socketMessages, sendMessage } = useConversationSocket(id!);

  // Combine historic and live messages
  const [allMessages, setAllMessages] = useState<Message[]>([]);

  // Initialize with history when loaded
  useEffect(() => {
    if (!historyLoading) {
      setAllMessages(history);
    }
  }, [history, historyLoading]);

  // Append new socket messages
  useEffect(() => {
    if (socketMessages.length) {
      const latest = socketMessages[socketMessages.length - 1];
      setAllMessages((prev) => [...prev, latest]);
    }
  }, [socketMessages]);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto‑scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage({ content: text, is_emergency: isEmergency });
    setText("");
    setIsEmergency(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white shadow px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-indigo-600 hover:underline text-sm">← Back</Link>
        <h1 className="font-semibold">Conversation #{id}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {allMessages.map((m) => (
          <div
            key={m.id}
            className={`rounded p-3 max-w-md ${m.is_emergency ? "bg-red-100 border border-red-400" : "bg-white shadow-sm"}`}
          >
            <p className="text-xs text-gray-400 mb-1">
              User {m.sender_id} · {new Date(m.timestamp).toLocaleTimeString()}
              {m.is_emergency && (
                <span className="ml-2 text-red-600 font-bold">🚨 {m.priority}</span>
              )}
            </p>
            <p>{m.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="bg-white border-t p-3 flex gap-2 items-center">
        <label className="flex items-center gap-1 text-sm text-red-600">
          <input type="checkbox" checked={isEmergency} onChange={(e) => setIsEmergency(e.target.checked)} />
          Emergency
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700">
          Send
        </button>
      </form>
    </div>
  );
}
