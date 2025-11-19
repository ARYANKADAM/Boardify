"use client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [boards, setBoards] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    fetchBoards(token);
  }, []);

  async function fetchBoards(token) {
    setLoading(true);
    setError("");
    const res = await fetch("/api/boards", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to load boards");
      return;
    }
    setBoards(data.boards);
  }

  async function handleCreateBoard(e) {
    e.preventDefault();
    setError("");
    const token = localStorage.getItem("token");
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create board");
      return;
    }
    setTitle("");
    setDescription("");
    setBoards((prev) => [...prev, data.board]);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded shadow">
        <h1 className="text-3xl font-bold mb-6 text-blue-700">Your Boards</h1>
        <form className="mb-8" onSubmit={handleCreateBoard}>
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Board Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 p-2 border rounded"
              required
            />
            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 p-2 border rounded"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Create Board
            </button>
          </div>
          {error && <div className="text-red-500 mb-2">{error}</div>}
        </form>
        {loading ? (
          <div className="text-gray-500">Loading boards...</div>
        ) : boards.length === 0 ? (
          <div className="text-gray-500">No boards found.</div>
        ) : (
          <ul className="space-y-4">
            {boards.map((board) => (
              <li key={board._id} className="p-4 border rounded flex justify-between items-center">
                <div>
                  <div className="font-semibold text-lg">{board.title}</div>
                  <div className="text-gray-600 text-sm">{board.description}</div>
                </div>
                <a
                  href={`/board/${board._id}`}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  View
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
