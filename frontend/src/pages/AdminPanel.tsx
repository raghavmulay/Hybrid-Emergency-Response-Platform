// AdminPanel.tsx – corrected implementation with TanStack Query v5 syntax

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useState } from "react";
import Layout from "../components/Layout";
import MessageMap from "../components/MessageMap";

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
  timestamp: string;
}

const PAGE_LIMIT = 20;

export default function AdminPanel() {
  const [page, setPage] = useState(0);

  // Conversations with pagination
  const {
    data: convData,
    isLoading: convLoading,
    isError: convError,
  } = useQuery<Conversation[]>({
    queryKey: ["adminConversations", page],
    queryFn: async () => {
      const skip = page * PAGE_LIMIT;
      const res = await api.get(`/conversations?skip=${skip}&limit=${PAGE_LIMIT}`);
      return res.data;
    },
    keepPreviousData: true,
  });
  const conversations = convData ?? [];

  // Emergency messages
  const {
    data: msgData,
    isLoading: msgLoading,
    isError: msgError,
  } = useQuery<EmergencyMessage[]>({
    queryKey: ["adminEmergencyMessages"],
    queryFn: async () => {
      const res = await api.get("/messages/emergency");
      return res.data;
    },
  });
  const messages = msgData ?? [];

  const [filterPriority, setFilterPriority] = useState<string>("all");
  const filtered = messages.filter(
    (m) => filterPriority === "all" || m.priority === filterPriority
  );

  const [showMap, setShowMap] = useState(false);

  const queryClient = useQueryClient();

  // Edit mutation (object syntax)
  const editMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<EmergencyMessage> }) => {
      const res = await api.put(`/messages/${id}`, updates);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmergencyMessages"] });
    },
  });

  // Delete mutation (object syntax)
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmergencyMessages"] });
    },
  });

  const handleEdit = (msg: EmergencyMessage) => {
    const newContent = window.prompt("Edit content", msg.content);
    if (newContent === null) return;
    const newPriority = window.prompt(
      "Edit priority (CRITICAL, HIGH, MEDIUM, LOW)",
      msg.priority ?? ""
    );
    const updates: Partial<EmergencyMessage> = { content: newContent };
    if (newPriority !== null) updates.priority = newPriority || null;
    editMutation.mutate({ id: msg.id, updates });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      deleteMutation.mutate(id);
    }
  };

  const canPrev = page > 0;
  const canNext = conversations.length === PAGE_LIMIT;

  return (
    <Layout>
      <div className="p-6">
        {/* Conversations */}
        <h1 className="text-2xl font-bold mb-4">Admin Panel – Conversations</h1>
        {convLoading && <p>Loading conversations…</p>}
        {convError && <p className="text-red-600">Failed to load conversations.</p>}
        {!convLoading && conversations.length === 0 && <p>No conversations found.</p>}
        {conversations.length > 0 && (
          <>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border">ID</th>
                    <th className="px-4 py-2 border">Title</th>
                    <th className="px-4 py-2 border">Owner ID</th>
                    <th className="px-4 py-2 border">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((c) => (
                    <tr key={c.id} className="odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-2 border text-center">{c.id}</td>
                      <td className="px-4 py-2 border text-center">{c.title ?? "-"}</td>
                      <td className="px-4 py-2 border text-center">{c.owner_id}</td>
                      <td className="px-4 py-2 border text-center">{new Date(c.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between mb-8">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={!canPrev}
                className={`px-4 py-2 rounded ${canPrev ? "bg-indigo-600 text-white" : "bg-gray-300 text-gray-600"}`}
              >
                Prev
              </button>
              <span className="self-center">Page {page + 1}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!canNext}
                className={`px-4 py-2 rounded ${canNext ? "bg-indigo-600 text-white" : "bg-gray-300 text-gray-600"}`}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Emergency Messages */}
        <h1 className="text-2xl font-bold mb-4">Admin Panel – Emergency Messages</h1>
        <div className="flex items-center mb-4">
          <label className="mr-2">Priority filter:</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="border rounded p-1 mr-4"
          >
            <option value="all">All</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <button
            onClick={() => setShowMap(!showMap)}
            className="bg-indigo-600 text-white px-3 py-1 rounded"
          >
            {showMap ? "Hide" : "Show"} Map
          </button>
        </div>
        {msgLoading && <p>Loading emergency messages…</p>}
        {msgError && <p className="text-red-600">Failed to load messages.</p>}
        {!msgLoading && filtered.length === 0 && <p>No emergency messages.</p>}
        {filtered.length > 0 && (
          <div className="overflow-x-auto mb-8">
            <table className="min-w-full border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border">Conversation</th>
                  <th className="px-4 py-2 border">Sender</th>
                  <th className="px-4 py-2 border">Content</th>
                  <th className="px-4 py-2 border">Priority</th>
                  <th className="px-4 py-2 border">Score</th>
                  <th className="px-4 py-2 border">Location</th>
                  <th className="px-4 py-2 border">Timestamp</th>
                  <th className="px-4 py-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((msg) => (
                  <tr key={msg.id} className="odd:bg-white even:bg-gray-50">
                    <td className="px-4 py-2 border text-center">{msg.conversation_id}</td>
                    <td className="px-4 py-2 border text-center">{msg.sender_id}</td>
                    <td className="px-4 py-2 border">{msg.content}</td>
                    <td className="px-4 py-2 border text-center text-red-600 font-bold">{msg.priority}</td>
                    <td className="px-4 py-2 border text-center">{msg.score ?? "-"}</td>
                    <td className="px-4 py-2 border text-center">{msg.latitude && msg.longitude ? `${msg.latitude.toFixed(4)}, ${msg.longitude.toFixed(4)}` : "-"}</td>
                    <td className="px-4 py-2 border text-center">{new Date(msg.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-2 border text-center space-x-2">
                      <button onClick={() => handleEdit(msg)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded">Edit</button>
                      <button onClick={() => handleDelete(msg.id)} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showMap && <MessageMap messages={filtered} />}
      </div>
    </Layout>
  );
}
