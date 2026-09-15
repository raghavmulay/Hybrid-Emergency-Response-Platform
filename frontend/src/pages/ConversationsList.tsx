import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Conversation = { id: number; title: string; created_at: string };

export default function ConversationsList() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");

  const { data, isLoading, error, refetch } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: async () => (await api.get("/conversations/")).data,
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post("/conversations/", { title });
    setTitle("");
    refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Conversations</h1>
          <button onClick={() => { logout(); navigate("/login"); }}
            className="text-sm text-red-500 hover:underline">Logout</button>
        </div>

        <form onSubmit={create} className="flex gap-2 mb-6">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="New conversation title"
            className="flex-1 rounded border px-3 py-2" />
          <button type="submit"
            className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
            Create
          </button>
        </form>

        {isLoading && <p>Loading…</p>}
        {error && <p className="text-red-600">Failed to load. Are you logged in?</p>}
        <ul className="space-y-2">
          {data?.map((c) => (
            <li key={c.id}>
              <Link to={`/conversations/${c.id}`}
                className="block rounded bg-white p-4 shadow hover:shadow-md">
                <span className="font-medium">{c.title}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
