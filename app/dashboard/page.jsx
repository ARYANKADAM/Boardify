"use client";
import { useEffect, useState } from "react";
import { io } from 'socket.io-client';

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

    (async () => {
      try {
        const meRes = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (meRes.ok) {
          const d = await meRes.json();
          setUser(d.user);
          const role = d && d.user && d.user.role ? String(d.user.role).toLowerCase() : null;
          setUserRole(role);
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          setJwtPayload(payload);
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

    // Socket.io connection for real-time notifications
    const SOCKET_SERVER = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:4001';
    const socket = io(SOCKET_SERVER, { auth: { token }, transports: ['websocket', 'polling'] });

    socket.on('connect_error', (err) => {
      console.error('Dashboard socket connect error', err);
    });

    socket.on('notification:created', (payload) => {
      if (!payload || !payload.data) return;
      const notification = payload.data.notification;
      if (!notification) return;

      // Check if this notification is for the current user
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          const userId = payload.id || payload._id;
          // Compare as strings since notification.userId might be ObjectId
          if (String(notification.userId) === String(userId)) {
            // Refresh notifications to get the latest
            fetchNotifications(token);
          }
        }
      } catch (e) {
        console.error('Error parsing token for notification check:', e);
      }
    });

    return () => {
      socket.disconnect();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-gray-100 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {/* Header with User Info */}
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* User Avatar */}
              {user?.avatar && (
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-purple-500/50 p-0.5 bg-gradient-to-br from-purple-500/20 to-indigo-500/20">
                    <img 
                      src={user.avatar} 
                      alt={user.name} 
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  {currentRoleInfo && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center text-sm border border-gray-700">
                      {currentRoleInfo.icon}
                    </div>
                  )}
                </div>
              )}

              {/* User Info */}
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {user?.name ? `Welcome, ${user.name}` : 'Your Boards'}
                </h1>
                {userRole && currentRoleInfo && (
                  <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full ${currentRoleInfo.bgColor} border ${currentRoleInfo.borderColor}`}>
                    <span className="text-lg">{currentRoleInfo.icon}</span>
                    <span className="text-sm font-medium">
                      {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Notifications Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-gray-400 hover:text-white transition-all"
                  title="Notifications"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM15 17H9a6 6 0 01-6-6V9a6 6 0 0110.29-4.12L15 9v8z" />
                  </svg>
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                      {notifications.filter(n => !n.isRead).length}
                    </div>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl z-50 notifications-dropdown">
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
                        <div className="p-4 text-center text-gray-500">
                          <svg className="w-8 h-8 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM15 17H9a6 6 0 01-6-6V9a6 6 0 0110.29-4.12L15 9v8z" />
                          </svg>
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div
                            key={notification._id}
                            className={`p-4 border-b border-gray-700/30 hover:bg-gray-700/30 transition-colors ${
                              !notification.isRead ? 'bg-blue-500/10' : ''
                            }`}
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

              <a 
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-gray-300 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </a>
              <button 
                onClick={handleLogout} 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-medium transition-all shadow-lg shadow-red-500/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Create Board Section */}
        {(userRole === 'admin' || userRole === 'owner') && (
          <div className="mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-indigo-600/10 rounded-2xl blur-xl"></div>
              <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-xl">
                {!showCreateForm ? (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-dashed border-gray-600 hover:border-purple-500 text-gray-400 hover:text-purple-400 transition-all group"
                  >
                    <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium">Create New Board</span>
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white">Create New Board</h3>
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Board Title</label>
                        <input
                          type="text"
                          placeholder="Enter board title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Description (optional)</label>
                        <textarea
                          placeholder="Enter board description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows="3"
                          className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                        />
                      </div>
                      {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span className="text-red-400 text-sm">{error}</span>
                        </div>
                      )}
                      <button
                        onClick={handleCreateBoard}
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl text-white font-semibold shadow-lg shadow-purple-500/30 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Board
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Register Section */}
        {process.env.NEXT_PUBLIC_ALLOW_SELF_ADMIN === 'true' && (
          <div className="mb-8 p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-sm text-gray-400 mr-2">Quick Register:</span>
              <button onClick={() => goToRegisterWithRole('owner')} className="px-2 sm:px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 rounded-lg text-xs sm:text-sm transition-all">
                👑 Owner
              </button>
              <button onClick={() => goToRegisterWithRole('admin')} className="px-2 sm:px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-lg text-xs sm:text-sm transition-all">
                ⚡ Admin
              </button>
              <button onClick={() => goToRegisterWithRole('member')} className="px-2 sm:px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg text-xs sm:text-sm transition-all">
                ✏️ Member
              </button>
              <button onClick={() => goToRegisterWithRole('viewer')} className="px-2 sm:px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/30 text-gray-300 rounded-lg text-xs sm:text-sm transition-all">
                👁️ Viewer
              </button>
            </div>
          </div>
        )}

        {/* Boards Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            Your Boards
            <span className="text-sm font-normal text-gray-500">({boards.length})</span>
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                <span className="text-gray-400">Loading boards...</span>
              </div>
            </div>
          ) : boards.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800/50 border border-gray-700 mb-4">
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {boards.map((board) => {
                // Derive current role (prefer `user` from API, fallback to localStorage)
                const currentRole = user && user.role ? String(user.role).toLowerCase() : (userRole || null);
                // Derive current user id from JWT payload or `user` object
                const currentUserId = (jwtPayload && (jwtPayload.id || jwtPayload._id)) || (user && (user._id || user.id));
                // Board owner can be an id string or a populated object; normalize to id string
                const boardOwnerId = board && (typeof board.owner === 'string' ? board.owner : (board.owner?._id || board.owner?.id));
                // If the board.owner is populated, capture their role too
                const boardOwnerRole = board && (typeof board.owner === 'object' ? (board.owner?.role ? String(board.owner.role).toLowerCase() : null) : null);

                // Permission rules:
                // - If current user is `owner`: they can delete boards they created OR boards created by admins.
                // - If current user is `admin`: they can only delete boards they created.
                let canDelete = false;
                if (currentRole === 'owner') {
                  if (currentUserId && boardOwnerId && String(boardOwnerId) === String(currentUserId)) {
                    canDelete = true;
                  } else if (boardOwnerRole === 'admin') {
                    canDelete = true;
                  }
                } else if (currentRole === 'admin') {
                  if (currentUserId && boardOwnerId && String(boardOwnerId) === String(currentUserId)) {
                    canDelete = true;
                  }
                }
                const isDeleting = deletingBoardId === board._id;
                
                return (
                  <div key={board._id} className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-indigo-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-xl hover:border-purple-500/50 transition-all">
                      
                      {/* Delete Button - Top Right */}
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteBoard(board._id, board.title);
                          }}
                          disabled={isDeleting}
                          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-400 hover:text-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete board"
                        >
                          {isDeleting ? (
                            <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}

                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 pr-8">
                          <h3 className="font-bold text-lg text-white mb-2 line-clamp-2">{board.title}</h3>
                          {board.description && (
                            <p className="text-gray-400 text-sm line-clamp-2">{board.description}</p>
                          )}
                        </div>
                
                      </div>
                      
                      <a 
                        href={`/board/${board._id}`} 
                        className="inline-flex items-center justify-center w-full gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 transition-all group-hover:scale-[1.02]"
                      >
                        Open Board
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}