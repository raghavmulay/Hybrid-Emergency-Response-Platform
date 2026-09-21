import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useConversationSocket, type Message, type MessageCreate } from "../hooks/useConversationSocket";
import Layout from "../components/Layout";
import MessageMap from "../components/MessageMap";
import LocationModal from "../components/LocationModal";
import { formatTime } from "../utils/time";

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-50 dark:bg-red-950/40 border-red-500 text-red-900 dark:text-red-200",
  HIGH: "bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-900 dark:text-orange-200",
  MEDIUM: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-500 text-yellow-900 dark:text-yellow-200",
  LOW: "bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-900 dark:text-blue-200",
};

const PRIORITY_BADGES: Record<string, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-500 text-black",
  LOW: "bg-blue-600 text-white",
};

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();

  const [text, setText] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [priority, setPriority] = useState("HIGH");
  const [location, setLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [sendError, setSendError] = useState("");
  const [showConvMap, setShowConvMap] = useState(false);
  const [selectedMapMessage, setSelectedMapMessage] = useState<Message | null>(null);
  const [showCustomCoords, setShowCustomCoords] = useState(false);
  const [customLat, setCustomLat] = useState("18.5204");
  const [customLng, setCustomLng] = useState("73.8567");

  // Load historic messages via REST
  const { data: history = [], isLoading: historyLoading } = useQuery<Message[]>({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data } = await api.get(`/conversations/${id}/messages`);
      return data;
    },
    enabled: !!id,
  });

  // Live messages via WebSocket
  const { messages: socketMessages, sendMessage, connected } = useConversationSocket(id!);

  // Combine history + live without duplicates (by id)
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const seenIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!historyLoading && history.length > 0) {
      setAllMessages(history);
      history.forEach((m) => seenIds.current.add(m.id));
    }
  }, [history, historyLoading]);

  useEffect(() => {
    if (socketMessages.length === 0) return;
    const latest = socketMessages[socketMessages.length - 1];
    if (!seenIds.current.has(latest.id)) {
      seenIds.current.add(latest.id);
      setAllMessages((prev) => [...prev, latest]);
    }
  }, [socketMessages]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]);

  // Fetch GPS location from browser
  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported by browser. Use Custom Coordinates.");
      setShowCustomCoords(true);
      return;
    }
    setLocationLoading(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: `GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        });
        setLocationLoading(false);
        setShowCustomCoords(false);
      },
      (err) => {
        setLocationError(`GPS error: ${err.message}. You can manually set coordinates below.`);
        setLocationLoading(false);
        setShowCustomCoords(true);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  const handleApplyCustomCoords = () => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    if (isNaN(lat) || isNaN(lng)) {
      setLocationError("Please enter valid numeric coordinates.");
      return;
    }
    setLocation({
      lat,
      lng,
      address: `Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    });
    setLocationError("");
    setShowCustomCoords(false);
  };

  const clearLocation = () => {
    setLocation(null);
    setLocationError("");
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSendError("");

    if (!connected) {
      setSendError("Connecting to emergency dispatch… please wait or refresh.");
    }

    const payload: MessageCreate = {
      content: text.trim(),
      is_emergency: isEmergency,
    };

    if (isEmergency) {
      payload.priority = priority;
    }

    if (location) {
      payload.latitude = location.lat;
      payload.longitude = location.lng;
      payload.address = location.address ?? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
    }

    sendMessage(payload);
    setText("");
    setLocation(null);
  };

  const messagesWithCoords = allMessages.filter(
    (m) => m.latitude !== undefined && m.longitude !== undefined && m.latitude !== null && m.longitude !== null
  );

  return (
    <Layout>
      {/* Full-height chat container */}
      <div
        className="flex flex-col rounded-2xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        style={{ height: "calc(100vh - 130px)" }}
      >
        {/* Chat header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 text-sm font-semibold flex items-center gap-1"
            >
              ← Back
            </Link>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                🚨 Emergency Dispatch #{id}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Encrypted Emergency Response Channel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Map toggle for this conversation */}
            <button
              onClick={() => setShowConvMap(!showConvMap)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                showConvMap
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              🗺️ {showConvMap ? "Hide Map" : `View Map (${messagesWithCoords.length})`}
            </button>

            {/* Connection status */}
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1 rounded-full">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connected ? "bg-green-500 shadow-sm shadow-green-500/50 animate-pulse" : "bg-red-500"
                }`}
              />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {connected ? "Connected" : "Reconnecting"}
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Map view for this conversation */}
        {showConvMap && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <MessageMap messages={allMessages} height="280px" />
          </div>
        )}

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
          {historyLoading && (
            <div className="text-center text-gray-400 py-12 flex flex-col items-center gap-2">
              <div className="animate-spin text-2xl">⏳</div>
              <p className="text-sm">Loading dispatch records…</p>
            </div>
          )}

          {!historyLoading && allMessages.length === 0 && (
            <div className="text-center text-gray-400 py-16">
              <p className="text-5xl mb-3">📡</p>
              <p className="font-semibold text-gray-600 dark:text-gray-300">No messages in this channel yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Transmit your emergency report or message with location below.
              </p>
            </div>
          )}

          {allMessages.map((m) => {
            const isEmerg = m.is_emergency;
            const pColor = m.priority ? PRIORITY_COLORS[m.priority] ?? "" : "";
            const pBadge = m.priority ? PRIORITY_BADGES[m.priority] ?? "bg-red-600 text-white" : "";
            const hasLocation = m.latitude !== undefined && m.longitude !== undefined && m.latitude !== null && m.longitude !== null;

            return (
              <div
                key={m.id}
                className={`rounded-2xl border p-4 max-w-2xl transition-all ${
                  isEmerg
                    ? `${pColor} border-l-4 shadow-md`
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm"
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {isEmerg ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pBadge}`}>
                        🚨 {m.priority ?? "EMERGENCY"}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        💬 Standard Message
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Sender #{m.sender_id}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatTime(m.timestamp)}
                  </span>
                </div>

                {/* Message text */}
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                  {m.content}
                </p>

                {/* Location Attachment Box */}
                {hasLocation && (
                  <div className="mt-3 p-2.5 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-base text-red-500">📍</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 font-mono">
                          {m.latitude!.toFixed(5)}, {m.longitude!.toFixed(5)}
                        </p>
                        {m.address && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {m.address}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMapMessage(m)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow transition-all flex items-center gap-1"
                      >
                        🗺️ View on Map
                      </button>
                      <a
                        href={`https://maps.google.com/?q=${m.latitude},${m.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        title="Open in Google Maps"
                      >
                        ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Send panel */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 space-y-2">
          {/* Emergency mode indicator banner */}
          {isEmergency && (
            <div className="bg-red-500/10 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="animate-pulse">🚨</span>
                EMERGENCY MODE ACTIVE — Dispatched with high priority to Command Center
              </span>
              <span className="uppercase font-bold tracking-wider">{priority}</span>
            </div>
          )}

          {/* Controls Bar: Emergency toggle, Priority, Location */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              {/* Emergency switch */}
              <button
                type="button"
                onClick={() => setIsEmergency(!isEmergency)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  isEmergency
                    ? "bg-red-600 text-white border-red-600 shadow-sm"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>🚨</span>
                {isEmergency ? "Emergency: ON" : "Emergency: OFF"}
              </button>

              {/* Priority select */}
              {isEmergency && (
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="CRITICAL">🔴 Critical Priority</option>
                  <option value="HIGH">🟠 High Priority</option>
                  <option value="MEDIUM">🟡 Medium Priority</option>
                  <option value="LOW">🔵 Low Priority</option>
                </select>
              )}

              {/* Location Controls */}
              {location ? (
                <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 text-green-800 dark:text-green-300 px-2.5 py-1 rounded-xl text-xs font-medium">
                  <span>📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
                  <button
                    type="button"
                    onClick={clearLocation}
                    className="ml-1 text-red-500 hover:text-red-700 font-bold px-1"
                    title="Remove location"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fetchLocation}
                    disabled={locationLoading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1"
                  >
                    📍 {locationLoading ? "Detecting GPS…" : "Attach GPS Location"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomCoords(!showCustomCoords)}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                  >
                    {showCustomCoords ? "Hide Coordinates" : "Custom Lat/Lng"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Custom coordinate entry if GPS is unavailable or blocked */}
          {showCustomCoords && !location && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Preset / Coordinates:</span>
              <input
                type="text"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                placeholder="Latitude"
                className="w-24 px-2 py-1 rounded border dark:border-gray-600 dark:bg-gray-800"
              />
              <input
                type="text"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
                placeholder="Longitude"
                className="w-24 px-2 py-1 rounded border dark:border-gray-600 dark:bg-gray-800"
              />
              <button
                type="button"
                onClick={handleApplyCustomCoords}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold"
              >
                Set Coordinates
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomLat("18.5204");
                  setCustomLng("73.8567");
                  handleApplyCustomCoords();
                }}
                className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-gray-700 dark:text-gray-200"
              >
                Pune Center (18.52, 73.85)
              </button>
            </div>
          )}

          {locationError && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{locationError}</p>
          )}

          {/* Text Input Row */}
          <form onSubmit={send} className="flex items-center gap-2 pt-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                isEmergency
                  ? "Describe emergency details (e.g. Fire in building, injured person, flood rising)…"
                  : "Type a response or report…"
              }
              className={`flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all dark:bg-gray-900 dark:text-white ${
                isEmergency
                  ? "border-red-400 focus:ring-2 focus:ring-red-400"
                  : "border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-400"
              }`}
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className={`px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow transition-all disabled:opacity-40 ${
                isEmergency
                  ? "bg-red-600 hover:bg-red-700 shadow-red-500/30"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30"
              }`}
            >
              {isEmergency ? "🚨 Send Alert" : "Send"}
            </button>
          </form>

          {sendError && <p className="text-xs text-red-500">{sendError}</p>}
        </div>
      </div>

      {/* Interactive Location Map Modal */}
      <LocationModal
        isOpen={!!selectedMapMessage}
        onClose={() => setSelectedMapMessage(null)}
        message={selectedMapMessage}
      />
    </Layout>
  );
}
