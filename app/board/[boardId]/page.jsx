"use client";
import { useEffect, useState } from "react";
import CalendarView from '../../../components/CalendarView';
import { io } from 'socket.io-client';
import { useParams, useRouter } from "next/navigation";

export default function BoardPage() {
  const { boardId } = useParams();
  const router = useRouter();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [serverRole, setServerRole] = useState(null);

  const [newListTitle, setNewListTitle] = useState("");
  const [newListLoading, setNewListLoading] = useState(false);
  const [showNewListForm, setShowNewListForm] = useState(false);

  const [taskInputs, setTaskInputs] = useState({});
  const [taskLoading, setTaskLoading] = useState({});
  const [showTaskForm, setShowTaskForm] = useState({});
  const [dragState, setDragState] = useState({
    draggingTaskId: null,
    sourceListId: null,
    dropIndex: null,
    destListId: null,
  });

  const [comments, setComments] = useState({});
  const [showComments, setShowComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState({});

  const [showDatePicker, setShowDatePicker] = useState(null); // taskId for which date picker is shown
  const [selectedDateValue, setSelectedDateValue] = useState('');

  const [notifications, setNotifications] = useState([]);
  const [currentView, setCurrentView] = useState('lists'); // 'lists' or 'calendar'

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    fetchBoard(token);
    (async () => {
      try {
        const meRes = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (meRes.ok) {
          const d = await meRes.json();
          const role = d && d.user && d.user.role ? String(d.user.role).toLowerCase() : null;
          setServerRole(role);
        } else {
          setServerRole(null);
        }
      } catch (e) {
        setServerRole(null);
      }
    })();
    fetchActivities(token);
    
    const SOCKET_SERVER = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:4001';
    const socket = io(SOCKET_SERVER, { auth: { token }, transports: ['websocket', 'polling'] });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error', err);
      setError('Socket error: ' + (err && err.message));
    });

    socket.on('joined', (p) => {
      console.debug('Joined board room', p);
    });

    socket.on('join-denied', (p) => {
      console.warn('Join denied', p);
      setError('Socket join denied: ' + (p && p.reason));
    });

    socket.emit('join-board', boardId);

    socket.on('task:created', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      const task = payload.data.task;
      if (!task) {
        fetchBoard(token);
        return;
      }

      setLists(prev => prev.map(l => {
        if (l._id !== String(task.listId)) return l;
        const tasks = Array.isArray(l.tasks) ? l.tasks : [];
        const exists = tasks.some(t => {
          const tid = t && (t._id || t.id || String(t));
          const incomingId = task._id || task.id || String(task);
          return String(tid) === String(incomingId);
        });
        if (exists) return l;
        return { ...l, tasks: [...tasks, task] };
      }));
    });

    socket.on('task:moved', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      const { taskId, listId: destListId, position } = payload.data || {};
      if (!taskId) return;
      setLists(prev => {
        const listsCopy = prev.map(l => ({ ...l, tasks: Array.isArray(l.tasks) ? [...l.tasks] : [] }));
        let movedTask = null;
        let sourceListIndex = -1;
        for (let i = 0; i < listsCopy.length; i++) {
          const idx = listsCopy[i].tasks.findIndex(t => (t._id === taskId || t.id === taskId || String(t) === taskId));
          if (idx !== -1) {
            movedTask = listsCopy[i].tasks.splice(idx, 1)[0];
            sourceListIndex = i;
            break;
          }
        }
        if (!movedTask) {
          fetchBoard(token);
          return prev;
        }
        const destIndex = listsCopy.findIndex(l => l._id === String(destListId));
        if (destIndex === -1) {
          fetchBoard(token);
          return prev;
        }
        const destTasks = listsCopy[destIndex].tasks;
        const insertAt = (typeof position === 'number') ? Math.max(0, Math.min(position, destTasks.length)) : destTasks.length;
        destTasks.splice(insertAt, 0, movedTask);
        return listsCopy;
      });
    });

    socket.on('task:deleted', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      const { taskId } = payload.data || {};
      if (!taskId) {
        fetchBoard(token);
        return;
      }
      setLists(prev => prev.map(l => ({ ...l, tasks: (l.tasks || []).filter(t => !(t._id === taskId || t.id === taskId || String(t) === taskId)) })));
    });

    socket.on('task:updated', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      const { taskId, updates } = payload.data || {};
      if (!taskId || !updates) return;

      setLists(prev => prev.map(list => ({
        ...list,
        tasks: (list.tasks || []).map(task => {
          const taskIdToCheck = task._id || task.id || String(task);
          return String(taskIdToCheck) === String(taskId)
            ? { ...task, ...updates }
            : task;
        })
      })));
    });

    socket.on('comment:created', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      const comment = payload.data.comment;
      if (!comment) return;

      setComments(prev => ({
        ...prev,
        [comment.taskId]: [...(prev[comment.taskId] || []), comment]
      }));

      try {
        const token = localStorage.getItem('token');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          const userId = payload.id || payload._id;
          if (comment.mentions && comment.mentions.includes(userId)) {
            addNotification(`You were mentioned in a comment on "${comment.taskTitle || 'a task'}"`, 'info');
          }
        }
      } catch (e) {
        console.error('Error parsing token for mention check:', e);
      }
    });

    socket.on('comment:deleted', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      const { commentId, taskId } = payload.data;
      if (!commentId || !taskId) return;

      setComments(prev => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter(comment => comment._id !== commentId)
      }));
    });

    socket.on('activity:created', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      const activity = payload.data;
      if (!activity) return;

      setActivities(prev => [activity, ...prev]);
    });

    return () => {
      socket.emit('leave-board', boardId);
      socket.disconnect();
    };
  }, [boardId]);

  useEffect(() => {
    function onMembersChanged(e) {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        if (!e || !e.detail || String(e.detail.boardId) !== String(boardId)) return;
        fetchBoard(token);
      } catch (err) {
        console.error('members changed handler error', err);
      }
    }
    window.addEventListener('board:members:changed', onMembersChanged);
    return () => window.removeEventListener('board:members:changed', onMembersChanged);
  }, [boardId]);

  async function fetchBoard(token) {
    try {
      setLoading(true);
      setError("");

      const resBoard = await fetch(`/api/boards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataBoard = await resBoard.json();

      if (!resBoard.ok) {
        setError(dataBoard.error || "Failed to load board");
        setLoading(false);
        return;
      }

      const foundBoard = dataBoard.boards.find(b => b._id === boardId);
      setBoard(foundBoard);

      const resLists = await fetch(`/api/lists?boardId=${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const dataLists = await resLists.json();
      setLoading(false);

      if (!resLists.ok) {
        setError(dataLists.error || "Failed to load lists");
        return;
      }

      setLists(dataLists.lists);

      const allTasks = dataLists.lists.flatMap(list => list.tasks || []);
      if (allTasks.length > 0) {
        await fetchAllComments(token, allTasks);
      }
    } catch (err) {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  function getEffectiveRoleForCurrentUser() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return 'viewer';
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const payloadRole = (payload.role || '').toString().toLowerCase();
      if (payloadRole === 'admin') return 'admin';
      if (payloadRole === 'owner') return 'owner';
      const uid = payload.id || payload._id || payload.id;
      if (!board) return 'viewer';
      if (String(board.owner) === String(uid)) return 'owner';
      if (Array.isArray(board.members)) {
        const m = board.members.find(m => (m && (m.user ? String(m.user) : String(m))) === String(uid));
        if (m) return (m.role || 'member').toString().toLowerCase();
      }
      return 'viewer';
    } catch (e) {
      return 'viewer';
    }
  }

  async function fetchActivities(token) {
    try {
      const res = await fetch(`/api/activity/${boardId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) {
        console.error('failed to fetch activities', data);
        return;
      }
      setActivities(data.activities || []);
    } catch (err) {
      console.error('fetchActivities error', err);
    }
  }

  async function handleCreateList(e) {
    e.preventDefault();
    setNewListLoading(true);
    setError("");

    const token = localStorage.getItem("token");

    const res = await fetch("/api/lists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        boardId,
        title: newListTitle,
        position: lists.length
      }),
    });

    const data = await res.json();
    setNewListLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to create list");
      return;
    }

    setLists(prev => [...prev, data.list]);
    setNewListTitle("");
    setShowNewListForm(false);
  }

  async function handleCreateTask(e, listId) {
    e.preventDefault();
    setTaskLoading(prev => ({ ...prev, [listId]: true }));
    setError("");

    const token = localStorage.getItem("token");
    const { title, description, dueDate } = taskInputs[listId] || {};

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        listId,
        title,
        description,
        dueDate: dueDate || null,
        position: lists.find(l => l._id === listId)?.tasks.length || 0
      }),
    });

    const data = await res.json();
    setTaskLoading(prev => ({ ...prev, [listId]: false }));

    if (!res.ok) {
      setError(data.error || "Failed to create task");
      return;
    }

    setLists(prev => prev.map(l => {
      if (l._id !== listId) return l;
      const tasks = Array.isArray(l.tasks) ? l.tasks : [];
      const incomingId = data.task && (data.task._id || data.task.id || String(data.task));
      const exists = tasks.some(t => {
        const tid = t && (t._id || t.id || String(t));
        return String(tid) === String(incomingId);
      });
      if (exists) {
        return { ...l, tasks: tasks.map(t => {
          const tid = t && (t._id || t.id || String(t));
          return String(tid) === String(incomingId) ? (data.task) : t;
        }) };
      }
      return { ...l, tasks: [...tasks, data.task] };
    }));

    setTaskInputs(prev => ({
      ...prev,
      [listId]: { title: "", description: "", dueDate: "" }
    }));
    setShowTaskForm(prev => ({ ...prev, [listId]: false }));
  }

  async function handleSetDueDate(taskId) {
    setShowDatePicker(taskId);
  }

  async function handleDateSelected(taskId, selectedDate) {
    setError("");
    const id = taskId && (typeof taskId === 'string' ? taskId : (taskId._id || taskId.id || String(taskId)));
    if (!id) return setError('Missing task id');

    try {
      const token = localStorage.getItem('token');
      const body = {};
      if (selectedDate) {
        const d = new Date(selectedDate);
        if (isNaN(d)) return setError('Invalid date format');
        body.dueDate = d.toISOString();
      } else {
        body.dueDate = null;
      }
      const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Update failed');

      // Update local state immediately
      setLists(prev => prev.map(list => ({
        ...list,
        tasks: (list.tasks || []).map(task => {
          const taskIdToCheck = task._id || task.id || String(task);
          return String(taskIdToCheck) === String(id)
            ? { ...task, dueDate: selectedDate ? new Date(selectedDate).toISOString() : null }
            : task;
        })
      })));

      setShowDatePicker(null);
      addNotification(selectedDate ? 'Due date updated successfully!' : 'Due date removed successfully!', 'success');
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleDeleteTask(taskId) {
    setError("");
    const id = taskId && (typeof taskId === 'string' ? taskId : (taskId._id || taskId.id || String(taskId)));
    if (!id) {
      setError('Cannot delete task: missing id');
      console.error('handleDeleteTask called with invalid id:', taskId);
      return;
    }

    const token = localStorage.getItem("token");
    const url = `/api/tasks/${id}`;
    console.debug('Deleting task', url);

    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to delete task");
      console.error('delete task failed', data);
      return;
    }

    await fetchBoard(token);
  }

  async function handleDeleteList(listId) {
    setError("");
    const id = listId && (typeof listId === 'string' ? listId : (listId._id || listId.id || String(listId)));
    if (!id) {
      setError('Cannot delete list: missing id');
      console.error('handleDeleteList called with invalid id:', listId);
      return;
    }

    const token = localStorage.getItem("token");
    const url = `/api/lists/${id}`;
    console.debug('Deleting list', url);

    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to delete list");
      console.error('delete list failed', data);
      return;
    }

    setLists(prev => prev.filter(l => l._id !== id));
  }

  async function fetchComments(taskId) {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tasks/${taskId}/comments`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to fetch comments', data);
        return;
      }
      setComments(prev => ({ ...prev, [taskId]: data.comments || [] }));
    } catch (err) {
      console.error('fetchComments error', err);
    }
  }

  async function fetchAllComments(token, tasks) {
    try {
      const commentPromises = tasks.map(async (task) => {
        const taskId = task._id || task.id;
        try {
          const res = await fetch(`/api/tasks/${taskId}/comments`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (res.ok) {
            return { taskId, comments: data.comments || [] };
          } else {
            console.error('Failed to fetch comments for task', taskId, data);
            return { taskId, comments: [] };
          }
        } catch (err) {
          console.error('fetchComments error for task', taskId, err);
          return { taskId, comments: [] };
        }
      });

      const results = await Promise.all(commentPromises);
      
      const newComments = {};
      results.forEach(({ taskId, comments }) => {
        newComments[taskId] = comments;
      });
      
      setComments(newComments);
    } catch (err) {
      console.error('fetchAllComments error', err);
    }
  }

  async function handleAddComment(taskId, content) {
    if (!content.trim()) return;
    setCommentLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add comment');
        return;
      }
      setCommentInputs(prev => ({ ...prev, [taskId]: '' }));
      addNotification('Comment added successfully!', 'success');
    } catch (err) {
      setError('Failed to add comment: ' + (err.message || String(err)));
    } finally {
      setCommentLoading(prev => ({ ...prev, [taskId]: false }));
    }
  }

  async function handleDeleteComment(commentId, taskId) {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to delete comment');
        return;
      }
      setComments(prev => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter(comment => comment._id !== commentId)
      }));
      addNotification('Comment deleted successfully!', 'success');
    } catch (err) {
      setError('Failed to delete comment: ' + (err.message || String(err)));
    }
  }

  function toggleComments(taskId) {
    setShowComments(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    if (!comments[taskId]) {
      fetchComments(taskId);
    }
  }

  function onDragStart(e, taskId, listId) {
    if (!canDragTasksClient) return;
    e.dataTransfer.setData('text/plain', taskId);
    setDragState({ draggingTaskId: taskId, sourceListId: listId, dropIndex: null, destListId: null });
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    if (!canDragTasksClient) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onTaskDragOver(e, index, listId) {
    if (!canDragTasksClient) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState(prev => ({ ...prev, dropIndex: index, destListId: listId }));
  }

  async function onDrop(e, destListId) {
    if (!canDragTasksClient) return;
    e.preventDefault();
    const token = localStorage.getItem('token');
    let id = e.dataTransfer.getData('text/plain');
    if (!id) {
      id = dragState.draggingTaskId;
    }
    if (!id) return;

    const sourceListId = dragState.sourceListId;
    if (!sourceListId) return;

    const dropIndex = (dragState.destListId === destListId && typeof dragState.dropIndex === 'number') ? dragState.dropIndex : null;

    setLists(prev => {
      const taskToMove = prev.flatMap(l => l.tasks).find(t => (t._id === id || t.id === id || String(t) === id));
      if (!taskToMove) return prev;

      return prev.map(l => {
        if (l._id === sourceListId) {
          return { ...l, tasks: l.tasks.filter(t => !(t._id === id || t.id === id || String(t) === id)) };
        }
        if (l._id === destListId) {
          const newTasks = [...l.tasks];
          if (dropIndex !== null && dropIndex >= 0 && dropIndex <= newTasks.length) {
            newTasks.splice(dropIndex, 0, taskToMove);
          } else {
            newTasks.push(taskToMove);
          }
          return { ...l, tasks: newTasks };
        }
        return l;
      });
    });

    try {
      const destList = lists.find(l => l._id === destListId);
      const targetPosition = (dropIndex !== null && dropIndex >= 0) ? dropIndex : (destList ? destList.tasks.length : 0);

      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listId: destListId, position: targetPosition }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to persist drag move', data);
        setError(data.error || 'Failed to move task');
        await fetchBoard(token);
        return;
      }
      await fetchBoard(token);
    } catch (err) {
      console.error('Error persisting drag move', err);
      setError('Failed to move task');
      await fetchBoard(token);
    } finally {
        setDragState({ draggingTaskId: null, sourceListId: null, dropIndex: null, destListId: null });
    }
  }

  const effectiveRole = serverRole || getEffectiveRoleForCurrentUser();
  const isViewerByServer = serverRole === 'viewer';
  const canCreateListClient = ['owner','admin'].includes(effectiveRole) && !isViewerByServer;
  const canCreateTaskClient = ['owner','admin','member'].includes(effectiveRole) && !isViewerByServer;
  const canManageMembersClient = ['owner'].includes(effectiveRole) && !isViewerByServer;
  const canDeleteTaskClient = ['owner','admin','member'].includes(effectiveRole) && !isViewerByServer;
  const canDragTasksClient = ['owner','admin','member'].includes(effectiveRole) && !isViewerByServer;

  useEffect(() => {
    function prevent(e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
    }
    if (!canDragTasksClient) {
      document.addEventListener('dragstart', prevent, true);
      document.addEventListener('dragover', prevent, true);
      document.addEventListener('drop', prevent, true);
      return () => {
        document.removeEventListener('dragstart', prevent, true);
        document.removeEventListener('dragover', prevent, true);
        document.removeEventListener('drop', prevent, true);
      };
    }
    return undefined;
  }, [canDragTasksClient]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
          <span className="text-gray-400 text-lg">Loading board...</span>
        </div>
      </div>
    );
  }

  if (error && !board) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h2 className="text-xl font-bold text-red-400">Error</h2>
          </div>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-800/50 border border-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-300 mb-2">Board not found</h2>
          <p className="text-gray-500">This board may have been deleted or you don't have access.</p>
        </div>
      </div>
    );
  }

  const roleInfo = {
    owner: { color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', icon: '👑' },
    admin: { color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', icon: '⚡' },
    member: { color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: '✏️' },
    viewer: { color: 'text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/30', icon: '👁️' }
  };

  const currentRoleInfo = effectiveRole ? roleInfo[effectiveRole] : roleInfo.viewer;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-gray-100">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
      </div>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-gray-800/95 to-gray-900/95 backdrop-blur-xl border-b border-gray-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-gray-400 hover:text-white transition-all shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold bg-linear-to-r from-white to-gray-300 bg-clip-text text-transparent truncate">{board.title}</h1>
              {board.description && <p className="text-sm text-gray-400 mt-0.5 truncate">{board.description}</p>}
            </div>

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${currentRoleInfo.bgColor} border ${currentRoleInfo.borderColor}`}>
              <span className="text-sm">{currentRoleInfo.icon}</span>
              <span className={`text-xs font-medium ${currentRoleInfo.color}`}>
                {effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1)}
              </span>
            </div>

            {canManageMembersClient && (
              <button
                onClick={() => router.push(`/board/${boardId}/members`)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 hover:text-blue-300 transition-all"
                title="Manage Members"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
            )}

            {['owner', 'admin'].includes(effectiveRole) && (
              <button
                onClick={() => router.push(`/board/${boardId}/analytics`)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 transition-all"
                title="View Analytics"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            )}

            <button
              onClick={() => setCurrentView(currentView === 'lists' ? 'calendar' : 'lists')}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                currentView === 'calendar'
                  ? 'bg-purple-600/30 border border-purple-500/50 text-purple-300'
                  : 'bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-gray-400 hover:text-white'
              }`}
              title={currentView === 'lists' ? 'Switch to Calendar View' : 'Switch to List View'}
            >
              {currentView === 'calendar' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content with padding for fixed header */}
      <div className="pt-26 px-4 pb-6">
        <div className="w-full space-y-6">
          {/* Conditional Content: Lists View or Calendar View */}
          {currentView === 'calendar' ? (
            <section className="relative">
              <CalendarView boardId={boardId} />
            </section>
          ) : (
            /* Section 2: Activity Logs and Lists side by side */
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Section 2a: Activity Logs - Takes 1/4 of the space on xl screens (left side) */}
              <div className="xl:col-span-1">
                <section className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Activity Logs
                    </h2>
                  </div>

                  <div className="h-[540px] bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 overflow-y-auto hide-scrollbar">
                    <div className="grid grid-cols-1 gap-3">
                      {activities.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gray-800/50 border border-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-gray-500 text-sm">No activity yet</p>
                        </div>
                      ) : (
                        activities.map(act => (
                          <div key={act._id} className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4 hover:border-purple-500/30 transition-all">
                            <p className="text-gray-200 text-sm mb-2">{act.details}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {new Date(act.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* Section 2b: Lists - Takes 3/4 of the space on xl screens (right side) */}
              <div className="xl:col-span-3">
                <section className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      Lists
                    </h2>
                    {canCreateListClient && (
                      <button
                        onClick={() => setShowNewListForm(true)}
                        className="px-4 py-2 pt- rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 font-medium transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add List
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto pb-4">
                    <div className="flex gap-6 min-w-max">
                    {lists.map(list => (
                      <div 
                        key={list._id} 
                        className="flex-shrink-0 w-80"
                        onDragOver={(e) => { if (!canDragTasksClient) { e.preventDefault(); e.stopPropagation(); return; } onDragOver(e); }}
                        onDrop={(e) => { if (!canDragTasksClient) { e.preventDefault(); e.stopPropagation(); return; } onDrop(e, list._id); }}
                      >
                        <div className="flex flex-col bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-xl overflow-hidden">
                          {/* List Header */}
                          <div className="px-4 py-3 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border-b border-gray-700/50 flex items-center justify-between">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2">
                              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              {list.title}
                              <span className="text-xs font-normal text-gray-400">({list.tasks?.length || 0})</span>
                            </h3>
                            
                            {canCreateListClient && (
                              <button
                                onClick={() => handleDeleteList(list._id || list.id)}
                                className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 transition-all"
                                title="Delete List"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* Tasks */}
                          <div className="p-4 space-y-3">
                            {list.tasks?.map((task, idx) => (
                              <div
                                key={task._id}
                                draggable={!!canDragTasksClient}
                                onDragStart={(e) => { if (!canDragTasksClient) { e.preventDefault(); e.stopPropagation(); return; } onDragStart(e, task._id || task.id || task, list._id); }}
                                onDragOver={(e) => { if (!canDragTasksClient) { e.preventDefault(); e.stopPropagation(); return; } onTaskDragOver(e, idx, list._id); }}
                                className="group bg-gray-900/50 border border-gray-700/50 rounded-xl p-4 hover:border-purple-500/50 transition-all cursor-pointer"
                                style={!canDragTasksClient ? { WebkitUserDrag: 'none', userSelect: 'none', cursor: 'default' } : undefined}
                              >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <h4 className="font-semibold text-white flex-1">{task.title}</h4>
                                  {canDragTasksClient && (
                                    <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                    </svg>
                                  )}
                                </div>
                                
                                {task.description && (
                                  <p className="text-sm text-gray-400 mb-3">{task.description}</p>
                                )}
                                
                                {task.dueDate && (
                                  <div className="flex items-center gap-2 mb-3 text-xs">
                                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                                      new Date(task.dueDate) < new Date() 
                                        ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                        : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                                    }`}>
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      {new Date(task.dueDate).toLocaleDateString()}
                                      {canCreateTaskClient && (
                                        <button
                                          onClick={() => handleDateSelected(task._id || task.id || task, null)}
                                          className="ml-1 p-0.5 rounded-full hover:bg-black/20 transition-colors"
                                          title="Remove due date"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex flex-wrap gap-2">
                                  {canCreateTaskClient && (
                                    <button
                                      onClick={() => handleSetDueDate(task._id || task.id || task)}
                                      className="flex-1 px-3 py-1.5 rounded-lg bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 text-yellow-400 text-xs font-medium transition-all"
                                    >
                                      📅 Due Date
                                    </button>
                                  )}
                                  <button
                                    onClick={() => toggleComments(task._id || task.id || task)}
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-xs font-medium transition-all"
                                  >
                                    💬 ({comments[task._id || task.id || task]?.length || 0})
                                  </button>
                                  {canDeleteTaskClient && (
                                    <button
                                      onClick={() => handleDeleteTask(task._id || task.id || task)}
                                      className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-xs font-medium transition-all"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>

                                {/* Comments Section */}
                                {showComments[task._id || task.id || task] && (
                                  <div className="mt-4 border-t border-gray-700/50 pt-4">
                                    <div className="space-y-3">
                                      {(comments[task._id || task.id || task] || []).map(comment => (
                                        <div key={comment._id} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 group hover:border-red-500/30 transition-all">
                                          <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-medium text-purple-300">
                                              {comment.userId?.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1">
                                              <div className="flex items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-medium text-white">{comment.userId?.name || 'Unknown'}</span>
                                                  <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
                                                </div>
                                                {(() => {
                                                  try {
                                                    const token = localStorage.getItem('token');
                                                    if (token) {
                                                      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                                                      const currentUserId = payload.id || payload._id;
                                                      const isCommentAuthor = String(comment.userId?._id || comment.userId) === String(currentUserId);
                                                      const isAdmin = ['owner', 'admin'].includes(effectiveRole);
                                                      if (isCommentAuthor || isAdmin) {
                                                        return (
                                                          <button
                                                            onClick={() => handleDeleteComment(comment._id, task._id || task.id || task)}
                                                            className="p-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                                            title="Delete comment"
                                                          >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                          </button>
                                                        );
                                                      }
                                                    }
                                                    return null;
                                                  } catch (e) {
                                                    return null;
                                                  }
                                                })()}
                                              </div>
                                              <p className="text-sm text-gray-300">{comment.content}</p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                      {canCreateTaskClient && (
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            placeholder="Add a comment..."
                                            value={commentInputs[task._id || task.id || task] || ''}
                                            onChange={e => setCommentInputs(prev => ({ ...prev, [task._id || task.id || task]: e.target.value }))}
                                            className="flex-1 p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm"
                                            onKeyPress={e => {
                                              if (e.key === 'Enter') {
                                                handleAddComment(task._id || task.id || task, commentInputs[task._id || task.id || task] || '');
                                              }
                                            }}
                                          />
                                          <button
                                            onClick={() => handleAddComment(task._id || task.id || task, commentInputs[task._id || task.id || task] || '')}
                                            disabled={commentLoading[task._id || task.id || task]}
                                            className="px-4 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 text-sm font-medium transition-all disabled:opacity-50"
                                          >
                                            {commentLoading[task._id || task.id || task] ? '...' : 'Add'}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Add Task Button/Form */}
                          <div className="p-4 border-t border-gray-700/50">
                            {canCreateTaskClient ? (
                              showTaskForm[list._id] ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Task title"
                                    value={taskInputs[list._id]?.title || ""}
                                    onChange={e =>
                                      setTaskInputs(prev => ({
                                        ...prev,
                                        [list._id]: { ...prev[list._id], title: e.target.value }
                                      }))
                                    }
                                    className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm"
                                    required
                                  />
                                  <textarea
                                    placeholder="Description (optional)"
                                    value={taskInputs[list._id]?.description || ""}
                                    onChange={e =>
                                      setTaskInputs(prev => ({
                                        ...prev,
                                        [list._id]: {
                                          ...prev[list._id],
                                          description: e.target.value
                                        }
                                      }))
                                    }
                                    rows="2"
                                    className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none text-sm"
                                  />
                                  <input
                                    type="date"
                                    value={taskInputs[list._id]?.dueDate || ""}
                                    onChange={e => setTaskInputs(prev => ({ ...prev, [list._id]: { ...prev[list._id], dueDate: e.target.value } }))}
                                    className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm"
                                    title="Due date"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => handleCreateTask(e, list._id)}
                                      disabled={taskLoading[list._id]}
                                      className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium shadow-lg shadow-green-500/20 transition-all text-sm"
                                    >
                                      {taskLoading[list._id] ? "Adding..." : "Add Task"}
                                    </button>
                                    <button
                                      onClick={() => setShowTaskForm(prev => ({ ...prev, [list._id]: false }))}
                                      className="px-4 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 transition-all text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setShowTaskForm(prev => ({ ...prev, [list._id]: true }))}
                                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-600 hover:border-purple-500 text-gray-400 hover:text-purple-400 transition-all text-sm font-medium"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add Task
                                </button>
                              )
                            ) : (
                              <div className="text-xs text-center text-gray-500 py-2">
                                Only members can add tasks
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Set Due Date</h3>
              <button
                onClick={() => {
                  setShowDatePicker(null);
                  setSelectedDateValue('');
                }}
                className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Due Date
                </label>
                <input
                  type="date"
                  value={selectedDateValue}
                  onChange={(e) => setSelectedDateValue(e.target.value)}
                  className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDateSelected(showDatePicker, selectedDateValue)}
                  disabled={!selectedDateValue}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select Date
                </button>
                <button
                  onClick={() => handleDateSelected(showDatePicker, null)}
                  className="px-4 py-3 rounded-xl bg-gray-700/50 hover:bg-gray-700 text-gray-300 transition-all"
                >
                  Clear Date
                </button>
                <button
                  onClick={() => {
                    setShowDatePicker(null);
                    setSelectedDateValue('');
                  }}
                  className="px-4 py-3 rounded-xl bg-gray-700/50 hover:bg-gray-700 text-gray-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New List Modal */}
      {showNewListForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Create New List</h3>
              <button
                onClick={() => setShowNewListForm(false)}
                className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="List title"
                value={newListTitle}
                onChange={e => setNewListTitle(e.target.value)}
                className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                required
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={handleCreateList}
                  disabled={newListLoading}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50"
                >
                  {newListLoading ? "Creating..." : "Create List"}
                </button>
                <button
                  onClick={() => setShowNewListForm(false)}
                  className="px-4 py-3 rounded-xl bg-gray-700/50 hover:bg-gray-700 text-gray-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-24 right-6 space-y-3 z-50">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`max-w-sm p-4 rounded-xl shadow-2xl backdrop-blur-xl border ${
                notification.type === 'success'
                  ? 'bg-green-500/90 border-green-400/50 shadow-green-500/20'
                  : notification.type === 'error'
                  ? 'bg-red-500/90 border-red-400/50 shadow-red-500/20'
                  : 'bg-blue-500/90 border-blue-400/50 shadow-blue-500/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className={`w-5 h-5 shrink-0 ${
                  notification.type === 'success'
                    ? 'text-green-100'
                    : notification.type === 'error'
                    ? 'text-red-100'
                    : 'text-blue-100'
                }`} fill="currentColor" viewBox="0 0 20 20">
                  {notification.type === 'success' ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : notification.type === 'error' ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  )}
                </svg>
                <p className={`text-sm font-medium flex-1 ${
                  notification.type === 'success'
                    ? 'text-green-100'
                    : notification.type === 'error'
                    ? 'text-red-100'
                    : 'text-blue-100'
                }`}>{notification.message}</p>
                <button
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                  className={`hover:opacity-75 transition-opacity ${
                    notification.type === 'success'
                      ? 'text-green-200'
                      : notification.type === 'error'
                      ? 'text-red-200'
                      : 'text-blue-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Toast */}
      {error && board && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-red-500/90 backdrop-blur-xl border border-red-400/50 rounded-xl px-6 py-4 shadow-2xl shadow-red-500/20 max-w-md z-50">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-white shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-white font-medium flex-1">{error}</p>
            <button
              onClick={() => setError("")}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
