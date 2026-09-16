import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import MessageMap from "../components/MessageMap";
import LocationModal from "../components/LocationModal";

interface Conversation {
  id: number;
  title?: string | null;
  owner_id: number;
  created_at: string;
}

interface EmergencyMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  priority: string | null;
  score?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  timestamp: string;
}

interface MessageHistoryItem {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  is_emergency: boolean;
  priority?: string | null;
  latitude?: number;
  longitude?: number;
  timestamp: string;
}

const PAGE_LIMIT = 20;

const PRIORITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-500 text-black",
  LOW: "bg-blue-600 text-white",
};

export default function AdminPanel() {
  const [page, setPage] = useState(0);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"map" | "feed" | "chats">("map");
  const [selectedMapMsg, setSelectedMapMsg] = useState<EmergencyMessage | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem("notificationsEnabled") !== "false";
  });
  const [editingMsg, setEditingMsg] = useState<EmergencyMessage | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editPriority, setEditPriority] = useState("");

  const queryClient = useQueryClient();

  // Conversations with pagination
  const { data: convData, isLoading: convLoading } = useQuery({
    queryKey: ["adminConversations", page],
    queryFn: async (): Promise<Conversation[]> => {
      const skip = page * PAGE_LIMIT;
      const res = await api.get(`/conversations?skip=${skip}&limit=${PAGE_LIMIT}`);
      return res.data;
    },
    placeholderData: (prev) => prev,
  });
  const conversations = convData ?? [];

  // Emergency messages — auto-refresh every 5 seconds
  const { data: msgData, isLoading: msgLoading, isError: msgError } = useQuery<EmergencyMessage[]>({
    queryKey: ["adminEmergencyMessages"],
    queryFn: async () => {
      const res = await api.get("/messages/emergency");
      return res.data;
    },
    refetchInterval: 5000,
  });
  const messages = msgData ?? [];
  const filtered = messages.filter(
    (m) => filterPriority === "all" || m.priority === filterPriority
  );

  // Selected conversation messages preview
  const { data: convMessages = [], isLoading: convMessagesLoading } = useQuery<MessageHistoryItem[]>({
    queryKey: ["convMessages", selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const res = await api.get(`/conversations/${selectedConvId}/messages`);
      return res.data;
    },
    enabled: !!selectedConvId,
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<EmergencyMessage> }) => {
      const res = await api.put(`/messages/${id}`, updates);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmergencyMessages"] });
      setEditingMsg(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmergencyMessages"] });
    },
  });

  const openEdit = (msg: EmergencyMessage) => {
    if (typeof window !== "undefined" && typeof window.prompt === "function") {
      const promptContent = window.prompt("Enter new content", msg.content);
      if (promptContent !== null) {
        const promptPriority = window.prompt("Enter new priority", msg.priority ?? "HIGH");
        if (promptPriority !== null) {
          editMutation.mutate({
            id: msg.id,
            updates: { content: promptContent, priority: promptPriority },
          });
          return;
        }
      }
    }
    setEditingMsg(msg);
    setEditContent(msg.content);
    setEditPriority(msg.priority ?? "HIGH");
  };

  const saveEdit = () => {
    if (!editingMsg) return;
    editMutation.mutate({
      id: editingMsg.id,
      updates: { content: editContent, priority: editPriority },
    });
  };

  const toggleNotifications = () => {
    setNotificationsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("notificationsEnabled", next.toString());
      return next;
    });
  };

  const handleFocusOnMap = (msg: EmergencyMessage) => {
    setActiveTab("map");
    setHighlightedMsgId(msg.id);
    setSelectedMapMsg(msg);
  };

  const canPrev = page > 0;
  const canNext = conversations.length === PAGE_LIMIT;

  const criticalCount = messages.filter((m) => m.priority === "CRITICAL").length;
  const highCount = messages.filter((m) => m.priority === "HIGH").length;
  const locatedCount = messages.filter((m) => m.latitude && m.longitude).length;

  return (
    <Layout>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Emergency Alerts", value: messages.length, color: "bg-indigo-600" },
          { label: "🔴 Critical Alerts", value: criticalCount, color: "bg-red-600" },
          { label: "🟠 High Priority", value: highCount, color: "bg-orange-500" },
          { label: "📍 GPS Located Alerts", value: locatedCount, color: "bg-emerald-600" },
        ].map((s) => (
          <div key={s.label} className={`${s.color} text-white rounded-2xl p-4 shadow-lg transition-transform hover:-translate-y-0.5`}>
            <p className="text-3xl font-extrabold">{s.value}</p>
            <p className="text-xs opacity-90 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("map")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "map"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            🗺️ Live Incident Map
            {locatedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white font-extrabold">
                {locatedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("feed")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "feed"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            🚨 Emergency Feed
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
              {messages.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("chats")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "chats"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            💬 Citizen Chats & Channels
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
              {conversations.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 pr-2">
          <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-gray-700/60 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600">
            <div
              onClick={toggleNotifications}
              className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${
                notificationsEnabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <div
                className={`absolute top-0.5 h-3 w-3 bg-white rounded-full shadow transition-transform ${
                  notificationsEnabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Audio Alerts
            </span>
          </label>
        </div>
      </div>

      {msgError && (
        <div className="p-4 mb-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <span>⚠️</span> Could not load emergency records. Please verify backend is running.
        </div>
      )}

      {/* TAB 1: LIVE INCIDENT MAP */}
      <div className={activeTab === "map" ? "block" : "hidden"}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/80">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                🗺️ Real-Time Incident Map
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Live location markers reported by citizens & field responders
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Filter All Priorities ({messages.length})</option>
                <option value="CRITICAL">🔴 Critical ({criticalCount})</option>
                <option value="HIGH">🟠 High ({highCount})</option>
                <option value="MEDIUM">🟡 Medium</option>
                <option value="LOW">🔵 Low</option>
              </select>
            </div>
          </div>

          <div className="p-4">
            <MessageMap
              messages={filtered}
              selectedMessageId={highlightedMsgId}
              height="550px"
            />
          </div>
        </div>
      </div>

      {/* TAB 2: EMERGENCY INCIDENT FEED */}
      <div className={activeTab === "feed" ? "block" : "hidden"}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/80">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                🚨 Emergency Incidents Feed
              </h2>
              {msgLoading && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full animate-pulse">
                  Syncing…
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Priorities ({messages.length})</option>
                <option value="CRITICAL">🔴 Critical ({criticalCount})</option>
                <option value="HIGH">🟠 High ({highCount})</option>
                <option value="MEDIUM">🟡 Medium</option>
                <option value="LOW">🔵 Low</option>
              </select>
            </div>
          </div>

          {!msgLoading && filtered.length === 0 && (
            <div className="p-16 text-center text-gray-400">
              <p className="text-4xl mb-2">✅</p>
              <p className="font-semibold text-gray-700 dark:text-gray-300">No emergency incidents matching this filter.</p>
              <p className="text-xs text-gray-500 mt-1">
                New alerts will appear here in real-time.
              </p>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60 max-h-[650px] overflow-y-auto">
              {filtered.map((msg) => {
                const hasCoords = msg.latitude && msg.longitude;
                return (
                  <div
                    key={msg.id}
                    className={`p-4 flex flex-col sm:flex-row gap-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                      highlightedMsgId === msg.id ? "bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500" : ""
                    }`}
                  >
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            PRIORITY_BADGE[msg.priority ?? "LOW"] ?? "bg-gray-500 text-white"
                          }`}
                        >
                          {msg.priority ?? "N/A"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                          Channel #{msg.conversation_id} · Citizen #{msg.sender_id} ·{" "}
                          {new Date(msg.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-relaxed">
                        {msg.content}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {hasCoords && (
                          <>
                            <button
                              onClick={() => handleFocusOnMap(msg)}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all flex items-center gap-1 border border-indigo-200 dark:border-indigo-800"
                            >
                              🗺️ View on Map ({msg.latitude!.toFixed(4)}, {msg.longitude!.toFixed(4)})
                            </button>
                            <a
                              href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 underline"
                            >
                              Google Maps ↗
                            </a>
                          </>
                        )}
                        <Link
                          to={`/conversations/${msg.conversation_id}`}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                        >
                          💬 Open Channel #{msg.conversation_id}
                        </Link>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center justify-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(msg)}
                        className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl shadow-sm transition-colors w-full"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this emergency message?")) deleteMutation.mutate(msg.id);
                        }}
                        className="text-xs font-semibold bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-xl shadow-sm transition-colors w-full"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* TAB 3: CITIZEN CHATS & CONVERSATIONS */}
      <div className={activeTab === "chats" ? "block" : "hidden"}>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  💬 Active Citizen Dispatch Channels
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Click any channel to preview historic chat messages or open the live channel
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                {conversations.length} Active Channels
              </span>
            </div>

            {convLoading && <div className="p-12 text-gray-400 text-sm text-center">Loading channels…</div>}

            {!convLoading && conversations.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                <p className="text-4xl mb-2">📭</p>
                <p>No active citizen channels found.</p>
              </div>
            )}

            {conversations.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">Channel ID</th>
                        <th className="px-4 py-3 text-left">Title</th>
                        <th className="px-4 py-3 text-left">Citizen / Initiator</th>
                        <th className="px-4 py-3 text-left">Created At</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {conversations.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedConvId(c.id)}
                          className={`cursor-pointer transition-colors ${
                            selectedConvId === c.id
                              ? "bg-indigo-50 dark:bg-indigo-950/30"
                              : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            #{c.id}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                            {c.title ?? "Emergency Report Channel"}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            Citizen #{c.owner_id}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            {new Date(c.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedConvId(c.id);
                              }}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                            >
                              👁️ Inspect
                            </button>
                            <Link
                              to={`/conversations/${c.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-block text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                            >
                              💬 Open Live Chat
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 flex items-center justify-between border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 0))}
                    disabled={!canPrev}
                    className="text-xs font-semibold px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-white dark:hover:bg-gray-700 transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-gray-500 font-medium">Page {page + 1}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!canNext}
                    className="text-xs font-semibold px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-white dark:hover:bg-gray-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Quick Chat Messages Preview Drawer for Selected Conversation */}
          {selectedConvId && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Live Chat History — Channel #{selectedConvId}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/conversations/${selectedConvId}`}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    Join Live Channel ↗
                  </Link>
                  <button
                    onClick={() => setSelectedConvId(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {convMessagesLoading && (
                <div className="p-8 text-center text-gray-400 text-sm">Loading messages…</div>
              )}

              {!convMessagesLoading && convMessages.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No messages transmitted in Channel #{selectedConvId} yet.
                </div>
              )}

              {convMessages.length > 0 && (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {convMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border text-sm ${
                        m.is_emergency
                          ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800"
                          : "bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {m.is_emergency ? `🚨 ${m.priority ?? "EMERGENCY"}` : "Citizen"} #{m.sender_id}
                        </span>
                        <span className="text-gray-400">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{m.content}</p>
                      {m.latitude && m.longitude && (
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
                          <span>📍 {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}</span>
                          <button
                            onClick={() => handleFocusOnMap({
                              ...m,
                              priority: m.priority ?? null
                            })}
                            className="underline font-semibold"
                          >
                            View on Map
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Location Map Modal */}
      <LocationModal
        isOpen={!!selectedMapMsg}
        onClose={() => setSelectedMapMsg(null)}
        message={selectedMapMsg}
      />

      {/* Edit message modal */}
      {editingMsg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              ✏️ Modify Emergency Incident Record #{editingMsg.id}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Incident Description
              </label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Severity Level
              </label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm"
              >
                <option value="CRITICAL">🔴 Critical</option>
                <option value="HIGH">🟠 High</option>
                <option value="MEDIUM">🟡 Medium</option>
                <option value="LOW">🔵 Low</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveEdit}
                disabled={editMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition-colors"
              >
                {editMutation.isPending ? "Saving…" : "Save Record"}
              </button>
              <button
                onClick={() => setEditingMsg(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
