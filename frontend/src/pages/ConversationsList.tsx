import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { api } from "../api/client";
import Layout from "../components/Layout";

type Conversation = { id: number; title: string; created_at: string };

export default function ConversationsList() {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: async () => (await api.get("/conversations/")).data,
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await api.post("/conversations/", { title });
      setTitle("");
      refetch();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Page header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              💬 Emergency Conversations
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Start or continue an emergency response conversation.
            </p>
          </div>
          <Link
            to="/report"
            className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            🚨 Report Emergency
          </Link>
        </div>

        {/* Create form */}
        <form onSubmit={create} className="flex gap-2 mb-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New conversation title (e.g. Flood Alert – Sector 7)"
            className="flex-1 rounded-lg border dark:border-gray-600 dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={creating || !title.trim()}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 text-white text-sm font-semibold transition-colors"
          >
            {creating ? "Creating…" : "+ Create"}
          </button>
        </form>

        {isLoading && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-3">⏳</p>
            <p>Loading conversations…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl p-4 text-sm">
            Failed to load conversations. Make sure you are logged in.
          </div>
        )}

        {!isLoading && data?.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p>No conversations yet. Create one above to get started.</p>
          </div>
        )}

        <ul className="space-y-3">
          {data?.map((c) => (
            <li key={c.id}>
              <Link
                to={`/conversations/${c.id}`}
                className="flex items-center justify-between rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500 transition-all"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{c.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    #{c.id} · Created {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-indigo-500 text-lg">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
