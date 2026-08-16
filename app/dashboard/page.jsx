"use client";
import { useEffect, useState } from "react";
import { db } from '../../lib/firebaseClient';
import { ref, query, orderByChild, startAt, onChildAdded, off } from 'firebase/database';

export default function DashboardPage() {
  const [boards, setBoards] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingBoardId, setDeletingBoardId] = useState(null);
  const [user, setUser] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [jwtPayload, setJwtPayload] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [boardSearch, setBoardSearch] = useState("");

  useEffect(() => {
    function handleClickOutside(event) {
      if (showNotifications && !event.target.closest('.notifications-dropdown')) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    let currentUserId = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      currentUserId = payload.id || payload._id;
      setJwtPayload(payload);
    } catch (e) {
      console.error('Failed to parse token payload', e);
    }

    (async () => {
      try {
        const meRes = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (meRes.ok) {
          const d = await meRes.json();
          setUser(d.user);
          const role = d && d.user && d.user.role ? String(d.user.role).toLowerCase() : null;
          setUserRole(role);
        } else {
          setUserRole(null);
        }
      } catch (e) {
        setUserRole(null);
      }
    })();

    fetchBoards(token);
    fetchNotifications(token);
    setMounted(true);

    // ----------------------------------------------------
    //  Firebase RTDB listener for real-time notifications
    //  (replaces the old socket.io connection)
    // ----------------------------------------------------
    if (!currentUserId) return;

    const joinedAt = Date.now();
    const eventsRef = query(
      ref(db, `notifications/${currentUserId}/events`),
      orderByChild('timestamp'),
      startAt(joinedAt)
    );

    const handleNewEvent = (snapshot) => {
      const { event, data } = snapshot.val() || {};
      if (event !== 'notification:created') return;
      if (!data || !data.notification) return;

      // Same "is this for me" check as before, kept for safety
      // (the RTDB path is already user-scoped, so this is now redundant
      // but harmless to keep as a defensive check)
      const notification = data.notification;
      if (String(notification.userId) === String(currentUserId)) {
        fetchNotifications(token);
      }
    };

    onChildAdded(eventsRef, handleNewEvent);

    return () => {
      off(eventsRef, 'child_added', handleNewEvent);
    };
  }, []);

  async function fetchNotifications(token) {
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to fetch notifications', data);
        return;
      }
      setNotifications(data || []);
    } catch (err) {
      console.error('fetchNotifications error', err);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/register';
  }

  function goToRegisterWithRole(role) {
    window.location.href = `/register?role=${encodeURIComponent(role)}`;
  }

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

  async function markNotificationsAsRead(notificationIds) {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notificationIds }),
      });
      if (res.ok) {
        // Update local state
        setNotifications(prev => prev.map(n => 
          notificationIds.includes(n._id) ? { ...n, isRead: true } : n
        ));
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  }

  function markAllAsRead() {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n._id);
    if (unreadIds.length > 0) {
      markNotificationsAsRead(unreadIds);
    }
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
    setShowCreateForm(false);
  }

  async function handleDeleteBoard(boardId, boardTitle) {
    if (!confirm(`Delete "${boardTitle}"? This action cannot be undone and will permanently remove all lists and tasks.`)) {
      return;
    }
    
    setDeletingBoardId(boardId);
    
    try {
      const token = localStorage.getItem('token');
      console.log('DEBUG: deleting board', { boardId, tokenPreview: token ? `${token.slice(0,8)}...` : null });
      const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      console.log('DEBUG: delete response', { status: res.status, body: data });
      if (!res.ok) {
        const msg = (data && data.error) ? data.error : `Delete failed (status ${res.status})`;
        throw new Error(msg);
      }

      // Remove from UI
      setBoards(prev => prev.filter(b => String(b._id) !== String(boardId)));
      setError('');
    } catch (err) {
      console.error('Delete board failed', err);
      setError('Failed to delete board: ' + (err.message || String(err)));
    } finally {
      setDeletingBoardId(null);
    }
  }

  const roleInfo = {
    owner: { color: 'from-amber-500 to-orange-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', icon: '👑' },
    admin: { color: 'from-purple-500 to-indigo-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', icon: '⚡' },
    member: { color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: '✏️' },
    viewer: { color: 'from-gray-500 to-slate-500', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/30', icon: '👁️' }
  };

  const currentRoleInfo = userRole ? roleInfo[userRole] : null;

  // Prevent hydration mismatch by not rendering role-dependent content until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
          <span className="text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  const filteredBoards = boards.filter((board) =>
    String(board.title || "").toLowerCase().includes(boardSearch.toLowerCase()) ||
    String(board.description || "").toLowerCase().includes(boardSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d1018] text-gray-100 relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[420px] h-[420px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 py-8">
        {/* Top navigation */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-16">
          <div className="flex items-center gap-4 min-w-0">
            {/* User avatar */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500/70 bg-gradient-to-br from-purple-600/40 to-indigo-600/40 shadow-lg shadow-purple-500/10">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-purple-200">
                    {(user?.name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {currentRoleInfo && (
                <span className="absolute -bottom-1 -right-2 text-xs">
                  {currentRoleInfo.icon}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Welcome, {user?.name || "User"}
              </h1>

              {userRole && currentRoleInfo && (
                <div className={`inline-flex items-center gap-2 mt-1.5 px-3 py-1 rounded-full ${currentRoleInfo.bgColor} border ${currentRoleInfo.borderColor}`}>
                  <span className="text-sm">{currentRoleInfo.icon}</span>
                  <span className="text-xs font-semibold">
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            <div className="relative notifications-dropdown">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative w-11 h-11 rounded-xl bg-[#171b27] border border-gray-700/60 hover:border-purple-500/50 hover:bg-[#1c2130] flex items-center justify-center text-gray-400 hover:text-white transition-all"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM15 17H9a6 6 0 01-6-6V9a6 6 0 0110.29-4.12L15 9v8z" />
                </svg>
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                    {notifications.filter(n => !n.isRead).length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-[#151925]/95 backdrop-blur-xl border border-gray-700/60 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
                    <h3 className="font-semibold text-white">Notifications</h3>
                    {notifications.filter(n => !n.isRead).length > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-5 text-center text-gray-500">No notifications yet</div>
                    ) : (
                      notifications.map(notification => (
                        <div
                          key={notification._id}
                          className={`p-4 border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors ${!notification.isRead ? 'bg-purple-500/5' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                              notification.type === 'mention' ? 'bg-blue-500' :
                              notification.type === 'comment' ? 'bg-green-500' :
                              notification.type === 'task_assigned' ? 'bg-purple-500' :
                              notification.type === 'due_date' ? 'bg-red-500' :
                              'bg-gray-500'
                            }`} />
                            <div className="flex-1">
                              <p className="text-sm text-gray-200">{notification.message}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(notification.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative hidden sm:block">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={boardSearch}
                onChange={(e) => setBoardSearch(e.target.value)}
                placeholder="Search"
                className="w-48 lg:w-52 h-11 pl-11 pr-4 rounded-xl bg-[#171b27] border border-gray-700/60 focus:border-purple-500/60 focus:outline-none text-sm text-gray-200 placeholder-gray-500 transition-all"
              />
            </div>

            <a
              href="/"
              className="hidden sm:inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#171b27] border border-gray-700/60 hover:border-gray-500 text-gray-300 hover:text-white transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5M9 21v-6h6v6" />
              </svg>
              Home
            </a>

            <button
              onClick={handleLogout}
              className="h-11 px-4 rounded-xl bg-[#171b27] border border-gray-700/60 hover:border-red-500/40 hover:bg-red-500/10 text-gray-300 hover:text-red-300 transition-all"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Quick Register Section */}
        {process.env.NEXT_PUBLIC_ALLOW_SELF_ADMIN === 'true' && (
          <div className="mb-8 p-4 bg-[#151925] border border-gray-700/60 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500 mr-2">Quick Register:</span>
              <button onClick={() => goToRegisterWithRole('owner')} className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 rounded-lg text-xs transition-all">
                👑 Owner
              </button>
              <button onClick={() => goToRegisterWithRole('admin')} className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 text-purple-300 rounded-lg text-xs transition-all">
                ⚡ Admin
              </button>
              <button onClick={() => goToRegisterWithRole('member')} className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-300 rounded-lg text-xs transition-all">
                ✏️ Member
              </button>
              <button onClick={() => goToRegisterWithRole('viewer')} className="px-3 py-1.5 bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/25 text-gray-300 rounded-lg text-xs transition-all">
                👁️ Viewer
              </button>
            </div>
          </div>
        )}

        {/* Boards section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Your Boards
            </h2>

            {(userRole === 'admin' || userRole === 'owner') && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-500/20 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Board
              </button>
            )}
          </div>

          {/* Create board modal */}
          {showCreateForm && (userRole === 'admin' || userRole === 'owner') && (
            <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-[#151925] border border-gray-700/70 rounded-2xl shadow-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-bold text-white">Create New Board</h3>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="w-9 h-9 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateBoard} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Board Title</label>
                    <input
                      type="text"
                      placeholder="Enter board title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full p-3 bg-[#0f131d] border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea
                      placeholder="Enter board description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows="3"
                      className="w-full p-3 bg-[#0f131d] border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all resize-none"
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all"
                  >
                    Create Board
                  </button>
                </form>
              </div>
            </div>
          )}

          {error && !showCreateForm && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                <span className="text-gray-400">Loading boards...</span>
              </div>
            </div>
          ) : boards.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#171b27] border border-gray-700 mb-4">
                <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No boards yet</h3>
              <p className="text-gray-500">
                {userRole === 'admin' || userRole === 'owner'
                  ? 'Create your first board to get started!'
                  : 'Boards will appear here once created by admins or owners.'}
              </p>
            </div>
          ) : filteredBoards.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No boards match "{boardSearch}"
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBoards.map((board) => {
                const currentRole = user && user.role
                  ? String(user.role).toLowerCase()
                  : (userRole || null);

                const currentUserId =
                  (jwtPayload && (jwtPayload.id || jwtPayload._id)) ||
                  (user && (user._id || user.id));

                const boardOwnerId =
                  board && (
                    typeof board.owner === 'string'
                      ? board.owner
                      : (board.owner?._id || board.owner?.id)
                  );

                const boardOwnerRole =
                  board && typeof board.owner === 'object'
                    ? (board.owner?.role ? String(board.owner.role).toLowerCase() : null)
                    : null;

                let canDelete = false;

                if (currentRole === 'owner') {
                  if (
                    currentUserId &&
                    boardOwnerId &&
                    String(boardOwnerId) === String(currentUserId)
                  ) {
                    canDelete = true;
                  } else if (boardOwnerRole === 'admin') {
                    canDelete = true;
                  }
                } else if (currentRole === 'admin') {
                  if (
                    currentUserId &&
                    boardOwnerId &&
                    String(boardOwnerId) === String(currentUserId)
                  ) {
                    canDelete = true;
                  }
                }

                const isDeleting = deletingBoardId === board._id;

                // Board.members is the list of users currently added to this board.
                // The owner is intentionally not counted here.
                const memberCount = Array.isArray(board.members)
                  ? board.members.length
                  : 0;

                return (
                 <div key={board._id} className="group relative">
  {/* Purple hover glow */}
  <div className="absolute inset-0 rounded-2xl bg-purple-600/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

  <div className="relative min-h-[250px] flex flex-col bg-[#171b29] border border-gray-700/60 rounded-2xl p-5 hover:border-purple-500/40 transition-all duration-300">

    {/* Header */}
    <div className="flex items-start justify-between gap-4">

      {/* Title + description */}
      <div className="min-w-0 flex-1">
        <h3 className="text-xl font-semibold text-white truncate">
          {board.title}
        </h3>

        {board.description ? (
          <p className="text-sm text-gray-400 mt-2 line-clamp-2">
            {board.description}
          </p>
        ) : (
          <p className="text-sm text-gray-500 mt-2">
            No description
          </p>
        )}
      </div>

      {/* Delete button */}
      {canDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDeleteBoard(board._id, board.title);
          }}
          disabled={isDeleting}
          className="
            flex-shrink-0
            w-10 h-10
            flex items-center justify-center
            rounded-xl
            bg-red-500/10
            border border-red-500/30
            text-red-400
            hover:bg-red-500/20
            hover:border-red-500/50
            hover:text-red-300
            transition-all
            disabled:opacity-50
          "
          title="Delete board"
        >
          {isDeleting ? (
            <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          )}
        </button>
      )}
    </div>

    {/* Spacer */}
    <div className="flex-1" />

    {/* Members */}
    <div className="mb-4">
      <div
        className="
          inline-flex items-center gap-2
          px-3 py-2
          rounded-xl
          bg-gray-800/70
          border border-gray-700/70
          text-gray-300
        "
      >
        <svg
          className="w-4 h-4 text-purple-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2
               M9 11a4 4 0 100-8 4 4 0 000 8z
               M22 21v-2a4 4 0 00-3-3.87
               M16 3.13a4 4 0 010 7.75"
          />
        </svg>

        <span className="text-sm font-medium">
          Members
        </span>

        <span className="text-sm font-semibold text-purple-300">
          {Array.isArray(board.members) ? board.members.length : 0}
        </span>
      </div>
    </div>

    {/* Open Board */}
    <a
      href={`/board/${board._id}`}
      className="
        w-full
        flex items-center justify-center gap-2
        px-5 py-3
        rounded-xl
        bg-gradient-to-r from-purple-600 to-indigo-600
        hover:from-purple-500 hover:to-indigo-500
        text-white
        font-semibold
        shadow-lg shadow-purple-500/20
        hover:shadow-purple-500/30
        transition-all duration-300
        group-hover:translate-y-[-1px]
      "
    >
      <span>Open Board</span>

      <svg
        className="w-4 h-4 transition-transform group-hover:translate-x-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7l5 5m0 0l-5 5m5-5H6"
        />
      </svg>
    </a>

  </div>
</div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}