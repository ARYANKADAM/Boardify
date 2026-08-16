"use client";
import { useEffect, useState } from "react";
import CalendarView from '../../../components/CalendarView';
import { useParams, useRouter } from "next/navigation";
import { db } from '../../../lib/firebaseClient';
import { ref, query, orderByChild, startAt, onChildAdded, off } from 'firebase/database';

// Cycles through these for list header accent colors, matching the
// Boardify reference (green "Done", purple "To Do", etc.)
const LIST_COLORS = [
  { bar: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { bar: 'bg-purple-500', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { bar: 'bg-blue-500', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { bar: 'bg-amber-500', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { bar: 'bg-rose-500', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
];

const AVATAR_COLORS = [
  'bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'
];

function avatarColorFor(id) {
  if (!id) return AVATAR_COLORS[0];
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) hash = (hash + str.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function initialsFor(name) {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

export default function BoardPage() {
  const { boardId } = useParams();
  const router = useRouter();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [serverRole, setServerRole] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const [showDatePicker, setShowDatePicker] = useState(null);
  const [selectedDateValue, setSelectedDateValue] = useState('');

  const [notifications, setNotifications] = useState([]);
  const [currentView, setCurrentView] = useState('lists');

  const [openTaskMenu, setOpenTaskMenu] = useState(null);

const [showAssigneeModal, setShowAssigneeModal] = useState(null);

const [assigneeEmail, setAssigneeEmail] = useState('');

const [assigneeLoading, setAssigneeLoading] = useState(false);

const [assigneeError, setAssigneeError] = useState('');

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // ---------------- Firebase realtime handlers ----------------

  function handleTaskCreated(payload) {
    if (!payload || !payload.data) return;
    if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
    const task = payload.data.task;
    if (!task) {
      const token = localStorage.getItem('token');
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
  }

  function handleTaskMoved(payload) {
    if (!payload || !payload.data) return;
    if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
    const { taskId, listId: destListId, position } = payload.data || {};
    if (!taskId) return;
    const token = localStorage.getItem('token');
    if (token) fetchActivities(token);

    setLists(prev => {
      const listsCopy = prev.map(l => ({ ...l, tasks: Array.isArray(l.tasks) ? [...l.tasks] : [] }));
      let movedTask = null;
      for (let i = 0; i < listsCopy.length; i++) {
        const idx = listsCopy[i].tasks.findIndex(t => (t._id === taskId || t.id === taskId || String(t) === taskId));
        if (idx !== -1) {
          movedTask = listsCopy[i].tasks.splice(idx, 1)[0];
          break;
        }
      }
      if (!movedTask) {
        if (token) fetchBoard(token);
        return prev;
      }
      const destIndex = listsCopy.findIndex(l => l._id === String(destListId));
      if (destIndex === -1) {
        if (token) fetchBoard(token);
        return prev;
      }
      const destTasks = listsCopy[destIndex].tasks;
      const insertAt = (typeof position === 'number') ? Math.max(0, Math.min(position, destTasks.length)) : destTasks.length;
      destTasks.splice(insertAt, 0, movedTask);
      return listsCopy;
    });
  }

  function handleTaskDeleted(payload) {
    if (!payload || !payload.data) return;
    if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
    const { taskId } = payload.data || {};
    if (!taskId) {
      const token = localStorage.getItem('token');
      fetchBoard(token);
      return;
    }
    setLists(prev => prev.map(l => ({ ...l, tasks: (l.tasks || []).filter(t => !(t._id === taskId || t.id === taskId || String(t) === taskId)) })));
  }

  function handleTaskUpdated(payload) {
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
  }

  function handleCommentCreated(payload) {
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
        const tokenPayload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const userId = tokenPayload.id || tokenPayload._id;
        if (comment.mentions && comment.mentions.includes(userId)) {
          addNotification(`You were mentioned in a comment on "${comment.taskTitle || 'a task'}"`, 'info');
        }
      }
    } catch (e) {
      console.error('Error parsing token for mention check:', e);
    }
  }

  function handleCommentDeleted(payload) {
    if (!payload || !payload.data) return;
    if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
    const { commentId, taskId } = payload.data;
    if (!commentId || !taskId) return;

    setComments(prev => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter(comment => comment._id !== commentId)
    }));
  }

  function handleActivityCreated(payload) {
    if (!payload || !payload.data) return;
    if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
    const activity = payload.data;
    if (!activity) return;

    setActivities(prev => {
      if (activity._id && prev.some(a => String(a._id) === String(activity._id))) return prev;
      return [activity, ...prev];
    });
  }

  

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

    const joinedAt = Date.now();
    const eventsRef = query(
      ref(db, `boards/${boardId}/events`),
      orderByChild('timestamp'),
      startAt(joinedAt)
    );

    const handleNewEvent = (snapshot) => {
      const { event, data } = snapshot.val() || {};
      const payload = { boardId, data };

      switch (event) {
        case 'task:created': handleTaskCreated(payload); break;
        case 'task:moved': handleTaskMoved(payload); break;
        case 'task:deleted': handleTaskDeleted(payload); break;
        case 'task:updated': handleTaskUpdated(payload); break;
        case 'comment:created': handleCommentCreated(payload); break;
        case 'comment:deleted': handleCommentDeleted(payload); break;
        case 'activity:created': handleActivityCreated(payload); break;
        default: break;
      }
    };

    onChildAdded(eventsRef, handleNewEvent);

    return () => {
      off(eventsRef, 'child_added', handleNewEvent);
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

  async function handleAssignMember(taskId) {
  const email = assigneeEmail.trim().toLowerCase();

  if (!email) {
    setAssigneeError('Enter a Gmail address');
    return;
  }

  setAssigneeLoading(true);
  setAssigneeError('');

  try {
    const token = localStorage.getItem('token');

    const res = await fetch(
      `/api/tasks/${encodeURIComponent(taskId)}/assignees`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to assign member');
    }

    // Update current board immediately
    setLists(prev =>
      prev.map(list => ({
        ...list,
        tasks: (list.tasks || []).map(task => {
          const currentId = task._id || task.id;

          if (String(currentId) !== String(taskId)) {
            return task;
          }

          return {
            ...task,
            assignedTo: data.assignedTo
          };
        })
      }))
    );

    setAssigneeEmail('');
    setShowAssigneeModal(null);
    setOpenTaskMenu(null);

    addNotification(
      `${data.user.name || data.user.email} assigned successfully`,
      'success'
    );

  } catch (err) {
    setAssigneeError(err.message || 'Failed to assign member');
  } finally {
    setAssigneeLoading(false);
  }
}

async function handleRemoveAssignee(taskId, userId) {
  try {
    const token = localStorage.getItem('token');

    const res = await fetch(
      `/api/tasks/${encodeURIComponent(taskId)}/assignees`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to remove assignee');
    }

    setLists(prev =>
      prev.map(list => ({
        ...list,
        tasks: (list.tasks || []).map(task => {
          const currentId = task._id || task.id;

          if (String(currentId) !== String(taskId)) {
            return task;
          }

          return {
            ...task,
            assignedTo: data.assignedTo
          };
        })
      }))
    );

    addNotification(
      'Assignee removed',
      'success'
    );

  } catch (err) {
    setError(err.message || 'Failed to remove assignee');
  }
}

  async function fetchBoard(token, showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      setError("");

      const resBoard = await fetch(`/api/boards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataBoard = await resBoard.json();

      if (!resBoard.ok) {
        setError(dataBoard.error || "Failed to load board");
        if (showLoader) setLoading(false);
        return;
      }

      const foundBoard = dataBoard.boards.find(b => b._id === boardId);
      setBoard(foundBoard);

      const resLists = await fetch(`/api/lists?boardId=${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const dataLists = await resLists.json();
      if (showLoader) setLoading(false);

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
      if (showLoader) setLoading(false);
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
      return;
    }

    const token = localStorage.getItem("token");
    const url = `/api/tasks/${id}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to delete task");
      return;
    }

    await fetchBoard(token);
  }

  async function handleDeleteList(listId) {
    setError("");
    const id = listId && (typeof listId === 'string' ? listId : (listId._id || listId.id || String(listId)));
    if (!id) {
      setError('Cannot delete list: missing id');
      return;
    }

    const token = localStorage.getItem("token");
    const url = `/api/lists/${id}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to delete list");
      return;
    }

    setLists(prev => prev.filter(l => l._id !== id));
  }

  async function fetchComments(taskId) {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tasks/${taskId}/comments`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) return;
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
          if (res.ok) return { taskId, comments: data.comments || [] };
          return { taskId, comments: [] };
        } catch (err) {
          return { taskId, comments: [] };
        }
      });

      const results = await Promise.all(commentPromises);
      const newComments = {};
      results.forEach(({ taskId, comments }) => { newComments[taskId] = comments; });
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
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add comment');
        return;
      }
      const newComment = data.comment;
      if (newComment) {
        setComments(prev => {
          const existing = prev[taskId] || [];
          const alreadyExists = existing.some(c => String(c._id) === String(newComment._id));
          if (alreadyExists) return prev;
          return { ...prev, [taskId]: [...existing, newComment] };
        });
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
    if (!comments[taskId]) fetchComments(taskId);
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
    if (!id) id = dragState.draggingTaskId;
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listId: destListId, position: targetPosition }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to move task');
        await fetchBoard(token);
        return;
      }
      await fetchBoard(token, false);
      await fetchActivities(token);
    } catch (err) {
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

  // Filter tasks by search query without hiding empty lists
  const q = searchQuery.trim().toLowerCase();
  const visibleLists = q
    ? lists.map(l => ({ ...l, tasks: (l.tasks || []).filter(t => (t.title || '').toLowerCase().includes(q)) }))
    : lists;

  return (
    <div className="h-screen flex bg-[#0b0d18] text-gray-100 overflow-hidden">
      {/* Narrow navigation rail */}
      <aside className="hidden md:flex w-20 shrink-0 flex-col bg-[#111525] border-r border-[#252b40]">
        <div className="h-[72px] flex items-center justify-center border-b border-[#252b40]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-purple-900/30">
            T
          </div>
        </div>

        <nav className="flex-1 flex flex-col items-center gap-2 py-5">
          <button
            onClick={() => router.push('/dashboard')}
            title="Boards"
            className="relative w-14 h-14 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 flex flex-col items-center justify-center gap-1 shadow-inner"
          >
            <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r bg-purple-500" />
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h4v4H4V6zm6 0h4v4h-4V6zm6 0h4v4h-4V6zM4 12h4v6H4v-6zm6 0h4v6h-4v-6zm6 0h4v6h-4v-6z" />
            </svg>
            <span className="text-[10px] font-medium">Boards</span>
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            title="Projects"
            className="w-14 h-14 rounded-xl text-gray-500 hover:text-gray-200 hover:bg-gray-800/60 flex flex-col items-center justify-center gap-1 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-[10px] font-medium">Projects</span>
          </button>

          <button
            onClick={() => router.push('/settings')}
            title="Settings"
            className="w-14 h-14 rounded-xl text-gray-500 hover:text-gray-200 hover:bg-gray-800/60 flex flex-col items-center justify-center gap-1 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </nav>

        <div className="pb-5 flex justify-center">
          <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-semibold text-gray-300">
            {board?.title ? initialsFor(board.title) : 'N'}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden bg-[radial-gradient(circle_at_70%_20%,rgba(88,28,135,0.20),transparent_35%),linear-gradient(135deg,#0c0e1a,#140b1e_55%,#0d0d18)]">
        {/* Top bar */}
        <header className="h-[72px] shrink-0 bg-[#111525]/95 border-b border-[#252b40] backdrop-blur-xl px-5 lg:px-7 flex items-center gap-5">
          <div className="flex items-center gap-3 min-w-0 w-[310px] shrink-0">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-10 h-10 rounded-xl bg-[#171c2d] border border-[#2b3146] text-gray-400 hover:text-white hover:border-purple-500/50 flex items-center justify-center transition-all"
              title="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-[20px] lg:text-[22px] font-bold text-white truncate">{board.title}</h1>
              <p className="text-sm text-gray-400 truncate">{board.description || 'Collaboration for Creative Product Development'}</p>
            </div>
          </div>

          <div className="flex-1 max-w-[430px] mx-auto">
            <div className="relative">
              <svg className="w-5 h-5 text-purple-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for tasks..."
                className="w-full h-11 pl-12 pr-4 rounded-xl bg-[#171c2d] border border-purple-500/60 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <div className={`inline-flex items-center gap-2 px-4 h-10 rounded-full ${currentRoleInfo.bgColor} border ${currentRoleInfo.borderColor}`}>
              <span>{currentRoleInfo.icon}</span>
              <span className={`text-sm font-medium ${currentRoleInfo.color}`}>
                {effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1)}
              </span>
            </div>

            {canManageMembersClient && (
              <button
                onClick={() => router.push(`/board/${boardId}/members`)}
                title="Team"
                className="w-11 h-11 rounded-xl text-gray-400 hover:text-blue-300 hover:bg-blue-600/10 border border-transparent hover:border-blue-500/30 flex items-center justify-center transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
            )}

            {['owner', 'admin'].includes(effectiveRole) && (
              <button
                onClick={() => router.push(`/board/${boardId}/analytics`)}
                title="Analytics"
                className="w-11 h-11 rounded-xl text-gray-400 hover:text-purple-300 hover:bg-purple-600/10 border border-transparent hover:border-purple-500/30 flex items-center justify-center transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            )}

            <button
              onClick={() => setCurrentView(currentView === 'lists' ? 'calendar' : 'lists')}
              title={currentView === 'lists' ? 'Calendar' : 'Board'}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${currentView === 'calendar' ? 'bg-purple-600/20 border border-purple-500/40 text-purple-300' : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Board content */}
        <main className="flex-1 min-h-0 h-[calc(100vh-72px)] px-5 lg:px-7 py-7 overflow-hidden">
          {currentView === 'calendar' ? (
            <div className="h-full overflow-auto">
              <CalendarView boardId={boardId} />
            </div>
          ) : (
            <div className="h-full flex gap-6 min-w-0">
              {/* Activity */}
              <section className="w-[330px] shrink-0 h-full flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <h2 className="text-[22px] font-bold text-white">Activity Log</h2>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar pr-2 space-y-3 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                  {activities.length === 0 ? (
                    <div className="h-full min-h-[300px] flex items-center justify-center text-gray-600 text-sm">No activity yet</div>
                  ) : (
                    activities.map(act => {
                      const who = act.userId?.name || act.userId?.email || act.details?.split('@')[0] || 'someone';
                      return (
                        <div key={act._id} className="bg-[#181d2d]/90 border border-[#30374d] rounded-2xl p-3.5 shadow-lg shadow-black/10 hover:border-purple-500/30 transition-all">
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-full ${avatarColorFor(act.userId?._id || act.userId)} flex items-center justify-center text-xs font-bold text-white shrink-0 border-2 border-[#252b40]`}>
                              {initialsFor(who)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-white text-sm truncate">{who}</span>
                                <span className="text-[11px] text-gray-500 whitespace-nowrap">{new Date(act.timestamp).toLocaleDateString()}</span>
                              </div>
                              <p className="text-gray-300 text-sm leading-snug mt-1">{act.details}</p>
                              <p className="text-[11px] text-gray-500 mt-1.5">{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Lists */}
              <section className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <h2 className="text-[22px] font-bold text-white">Lists</h2>
                  </div>

                  {canCreateListClient && (
                    <button
                      onClick={() => setShowNewListForm(true)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white font-semibold transition-all flex items-center gap-2 shadow-lg shadow-purple-900/20"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New List
                    </button>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-x-auto hide-scrollbar overflow-y-hidden pb-3">
                  <div className="flex items-start gap-5 h-full min-w-max">
                    {visibleLists.map((list, listIdx) => {
                      const color = LIST_COLORS[listIdx % LIST_COLORS.length];
                      const tasks = list.tasks || [];

                      return (
                        <div
                          key={list._id}
                          className="w-[310px] xl:w-[315px] shrink-0 h-fit max-h-full"
                          onDragOver={(e) => { if (!canDragTasksClient) { e.preventDefault(); e.stopPropagation(); return; } onDragOver(e); }}
                          onDrop={(e) => { if (!canDragTasksClient) { e.preventDefault(); e.stopPropagation(); return; } onDrop(e, list._id); }}
                        >
                          <div className="bg-[#121725]/95 border border-[#2c3348] rounded-2xl overflow-hidden shadow-xl shadow-black/20">
                            <div className={`h-1.5 ${color.bar}`} />

                            <div className="px-4 py-4 flex items-center justify-between border-b border-[#252b40]">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <h3 className="font-bold text-[17px] text-white truncate">{list.title}</h3>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color.badge}`}>
                                  {tasks.length}
                                </span>
                              </div>

                              {canCreateListClient && (
                                <button
                                  onClick={() => handleDeleteList(list._id || list.id)}
                                  className="w-8 h-8 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 flex items-center justify-center transition-all shrink-0"
                                  title="Delete List"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {canCreateTaskClient && (
                              <div className="px-3 py-3 border-b border-[#252b40]">
                                {showTaskForm[list._id] ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      placeholder="Task title"
                                      value={taskInputs[list._id]?.title || ''}
                                      onChange={e => setTaskInputs(prev => ({ ...prev, [list._id]: { ...prev[list._id], title: e.target.value } }))}
                                      className="w-full p-2.5 bg-[#1a2031] border border-[#343b51] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                                      required
                                    />
                                    <textarea
                                      placeholder="Description (optional)"
                                      value={taskInputs[list._id]?.description || ''}
                                      onChange={e => setTaskInputs(prev => ({ ...prev, [list._id]: { ...prev[list._id], description: e.target.value } }))}
                                      rows="2"
                                      className="w-full p-2.5 bg-[#1a2031] border border-[#343b51] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none text-sm"
                                    />
                                    <input
                                      type="date"
                                      value={taskInputs[list._id]?.dueDate || ''}
                                      onChange={e => setTaskInputs(prev => ({ ...prev, [list._id]: { ...prev[list._id], dueDate: e.target.value } }))}
                                      className="w-full p-2.5 bg-[#1a2031] border border-[#343b51] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 text-sm"
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={(e) => handleCreateTask(e, list._id)} disabled={taskLoading[list._id]} className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm">
                                        {taskLoading[list._id] ? 'Adding...' : 'Add Task'}
                                      </button>
                                      <button onClick={() => setShowTaskForm(prev => ({ ...prev, [list._id]: false }))} className="px-3 py-2 rounded-xl bg-gray-700/60 hover:bg-gray-700 text-gray-300 text-sm">
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setShowTaskForm(prev => ({ ...prev, [list._id]: true }))}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#1a2031] hover:bg-[#20273a] text-gray-400 hover:text-white text-sm transition-all border border-transparent hover:border-[#343b51]"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add a task...
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                              {tasks.map((task, idx) => {
                                const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [];
                                const tid = task._id || task.id || task;
                                const status = task.status || task.tag || '';
                               const due = task.dueDate ? new Date(task.dueDate) : null;

const overdue = (() => {
  if (!due) return false;

  const dueDate = new Date(due);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
})();

                                return (
                                  <div
                                    key={tid}
                                    draggable={!!canDragTasksClient}
                                    onDragStart={(e) => { if (!canDragTasksClient) { e.preventDefault(); e.stopPropagation(); return; } onDragStart(e, tid, list._id); }}
                                    onDragOver={(e) => { if (!canDragTasksClient) { e.preventDefault(); e.stopPropagation(); return; } onTaskDragOver(e, idx, list._id); }}
                                    className="group bg-[#1b2132] border border-[#333b52] rounded-xl overflow-hidden hover:border-purple-500/50 transition-all cursor-grab active:cursor-grabbing shadow-lg shadow-black/10"
                                    style={!canDragTasksClient ? { WebkitUserDrag: 'none', userSelect: 'none', cursor: 'default' } : undefined}
                                  >
                                    <div className="p-3.5">
                                       <div className="flex items-start justify-between gap-2">
                                         <h4 className="font-bold text-[17px] text-white leading-tight flex-1">{task.title}</h4>

                                         {['owner', 'admin'].includes(effectiveRole) && (
                                           <div className="relative shrink-0">
                                             <button
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 setOpenTaskMenu(openTaskMenu === tid ? null : tid);
                                               }}
                                               className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700/70 transition-all"
                                               title="Task options"
                                             >
                                               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                 <path d="M6 10a2 2 0 114 0 2 2 0 01-4 0zm4-2a2 2 0 100 4 2 2 0 000-4zm2 2a2 2 0 114 0 2 2 0 01-4 0z" />
                                               </svg>
                                             </button>

                                             {openTaskMenu === tid && (
                                               <div
                                                 className="absolute right-0 top-9 z-40 w-44 bg-[#121725] border border-[#343b51] rounded-xl shadow-2xl overflow-hidden"
                                                 onClick={(e) => e.stopPropagation()}
                                               >
                                                 <button
                                                   onClick={() => {
                                                     setOpenTaskMenu(null);
                                                     setAssigneeEmail('');
                                                     setAssigneeError('');
                                                     setShowAssigneeModal(tid);
                                                   }}
                                                   className="w-full px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-gray-800 transition-all flex items-center gap-2"
                                                 >
                                                   <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                   </svg>
                                                   Assign member
                                                 </button>
                                               </div>
                                             )}
                                           </div>
                                         )}
                                       </div>

                                      {status && (
                                        <span className="inline-flex mt-2 px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium">
                                          {status}
                                        </span>
                                      )}

                                      {task.description && (
                                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{task.description}</p>
                                      )}

                                     {due && (
  <span
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
      overdue
        ? 'bg-red-500/15 text-red-300 border-red-500/30'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    }`}
  >
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>

    {due.toLocaleDateString('en-GB')}
  </span>
)}

                                      <div className="flex items-center gap-2 mt-3">
                                        {canCreateTaskClient && (
                                          <button onClick={() => handleSetDueDate(tid)} className="px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-1.5 transition-all" title="Due Date">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            Due Date
                                          </button>
                                        )}

                                        <button onClick={() => toggleComments(tid)} className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-1.5 transition-all">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8m-8 4h5m8-2a7 7 0 11-14 0 7 7 0 0114 0z" />
                                          </svg>
                                          ({comments[tid]?.length || 0})
                                        </button>

                                        {canDeleteTaskClient && (
                                          <button onClick={() => handleDeleteTask(tid)} className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-xs flex items-center justify-center transition-all" title="Delete task">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                     {assignees.length > 0 && (
                                       <div className="px-3.5 py-3 border-t border-[#333b52] bg-[#171c2b]/70">
                                         <p className="text-xs text-gray-300 font-medium mb-3">
                                           Assignees
                                         </p>

                                         <div className="flex items-center -space-x-2.5 pl-1">
                                           {assignees.slice(0, 6).map((a, i) => {
                                             const aid = a?._id || a?.id || a;
                                             const name = a?.name || a?.email || '?';

                                             return (
                                               <div
                                                 key={i}
                                                 className="relative group/avatar shrink-0 w-9 h-9"
                                                 style={{ zIndex: assignees.length - i }}
                                               >
                                                 <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white bg-[#252b40] shadow-md flex items-center justify-center">
                                                   {a?.avatar ? (
                                                     <img
                                                       src={a.avatar}
                                                       alt={name}
                                                       title={name}
                                                       className="w-full h-full object-cover"
                                                     />
                                                   ) : (
                                                     <div
                                                       title={name}
                                                       className={`w-full h-full ${avatarColorFor(aid)} flex items-center justify-center text-xs font-bold text-white`}
                                                     >
                                                       {initialsFor(name)}
                                                     </div>
                                                   )}
                                                 </div>

                                                 {['owner', 'admin'].includes(effectiveRole) && (
                                                   <button
                                                     type="button"
                                                     onClick={(e) => {
                                                       e.stopPropagation();
                                                       handleRemoveAssignee(tid, aid);
                                                     }}
                                                     className="absolute -top-1 -right-1 hidden group-hover/avatar:flex w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white items-center justify-center text-[10px] leading-none border border-white shadow-md"
                                                     title={`Remove ${name}`}
                                                   >
                                                     ×
                                                   </button>
                                                 )}
                                               </div>
                                             );
                                           })}

                                           {assignees.length > 6 && (
                                             <div
                                               className="relative w-9 h-9 rounded-full border-2 border-white bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-200 shadow-md shrink-0"
                                               title={`${assignees.length - 6} more assignees`}
                                             >
                                               +{assignees.length - 6}
                                             </div>
                                           )}
                                         </div>
                                       </div>
                                     )}
                                    {showComments[tid] && (
                                      <div className="p-3 border-t border-[#333b52] space-y-2 bg-[#151a29]">
                                        {(comments[tid] || []).map(comment => (
                                          <div key={comment._id} className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-2 group/comment">
                                            <div className="flex items-start gap-2">
                                              <div className={`w-6 h-6 rounded-full ${avatarColorFor(comment.userId?._id || comment.userId)} flex items-center justify-center text-[10px] font-semibold text-white shrink-0`}>
                                                {initialsFor(comment.userId?.name)}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="text-xs font-medium text-white">{comment.userId?.name || 'Unknown'}</span>
                                                  {(() => {
                                                    try {
                                                      const token = localStorage.getItem('token');
                                                      if (!token) return null;
                                                      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                                                      const currentUserId = payload.id || payload._id;
                                                      const isCommentAuthor = String(comment.userId?._id || comment.userId) === String(currentUserId);
                                                      const isAdmin = ['owner', 'admin'].includes(effectiveRole);
                                                      if (!isCommentAuthor && !isAdmin) return null;
                                                      return <button onClick={() => handleDeleteComment(comment._id, tid)} className="text-red-400 opacity-0 group-hover/comment:opacity-100 text-xs">✕</button>;
                                                    } catch (e) { return null; }
                                                  })()}
                                                </div>
                                                <p className="text-xs text-gray-300 mt-0.5">{comment.content}</p>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                        {canCreateTaskClient && (
                                          <div className="flex gap-1.5">
                                            <input
                                              type="text"
                                              placeholder="Add a comment..."
                                              value={commentInputs[tid] || ''}
                                              onChange={e => setCommentInputs(prev => ({ ...prev, [tid]: e.target.value }))}
                                              className="flex-1 p-2 bg-gray-900/60 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 text-xs"
                                              onKeyPress={e => { if (e.key === 'Enter') handleAddComment(tid, commentInputs[tid] || ''); }}
                                            />
                                            <button onClick={() => handleAddComment(tid, commentInputs[tid] || '')} disabled={commentLoading[tid]} className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs disabled:opacity-50">
                                              {commentLoading[tid] ? '...' : 'Add'}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {tasks.length === 0 && (
                                <div className="py-10 text-center text-gray-600 text-sm">No tasks{q ? ' match your search' : ''}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#121725] border border-[#343b51] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Set Due Date</h3>
              <button onClick={() => { setShowDatePicker(null); setSelectedDateValue(''); }} className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <input type="date" value={selectedDateValue} onChange={(e) => setSelectedDateValue(e.target.value)} className="w-full p-3 bg-[#1a2031] border border-[#343b51] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500" autoFocus />
              <div className="flex gap-3">
                <button onClick={() => handleDateSelected(showDatePicker, selectedDateValue)} disabled={!selectedDateValue} className="flex-1 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold disabled:opacity-50">Select Date</button>
                <button onClick={() => handleDateSelected(showDatePicker, null)} className="px-4 py-3 rounded-xl bg-gray-700/50 hover:bg-gray-700 text-gray-300">Clear</button>
                <button onClick={() => { setShowDatePicker(null); setSelectedDateValue(''); }} className="px-4 py-3 rounded-xl bg-gray-700/50 hover:bg-gray-700 text-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New List Modal */}
      {showNewListForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#121725] border border-[#343b51] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Create New List</h3>
              <button onClick={() => setShowNewListForm(false)} className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="List title" value={newListTitle} onChange={e => setNewListTitle(e.target.value)} className="w-full p-3 bg-[#1a2031] border border-[#343b51] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500" required autoFocus />
              <div className="flex gap-3">
                <button onClick={handleCreateList} disabled={newListLoading} className="flex-1 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold disabled:opacity-50">{newListLoading ? 'Creating...' : 'Create List'}</button>
                <button onClick={() => setShowNewListForm(false)} className="px-4 py-3 rounded-xl bg-gray-700/50 hover:bg-gray-700 text-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

       {/* Assign Member Modal */}
       {showAssigneeModal && (
         <div
           className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
           onClick={() => {
             setShowAssigneeModal(null);
             setAssigneeEmail('');
             setAssigneeError('');
           }}
         >
           <div
             className="w-full max-w-md bg-[#121725] border border-[#343b51] rounded-2xl p-6 shadow-2xl"
             onClick={(e) => e.stopPropagation()}
           >
             <div className="flex items-center justify-between mb-5">
               <div>
                 <h3 className="text-xl font-bold text-white">Assign Member</h3>
                 <p className="text-xs text-gray-500 mt-1">Add a board member to this task</p>
               </div>

               <button
                 onClick={() => {
                   setShowAssigneeModal(null);
                   setAssigneeEmail('');
                   setAssigneeError('');
                 }}
                 className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>

             <div className="space-y-4">
               <div>
                 <label className="block text-xs font-medium text-gray-400 mb-2">
                   Member Gmail
                 </label>

                 <input
                   type="email"
                   value={assigneeEmail}
                   onChange={(e) => {
                     setAssigneeEmail(e.target.value);
                     setAssigneeError('');
                   }}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       handleAssignMember(showAssigneeModal);
                     }
                   }}
                   placeholder="member@gmail.com"
                   autoFocus
                   className="w-full p-3 bg-[#1a2031] border border-[#343b51] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                 />
               </div>

               {assigneeError && (
                 <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                   {assigneeError}
                 </div>
               )}

               <div className="flex gap-3">
                 <button
                   onClick={() => {
                     setShowAssigneeModal(null);
                     setAssigneeEmail('');
                     setAssigneeError('');
                   }}
                   className="flex-1 px-4 py-3 rounded-xl bg-gray-700/50 hover:bg-gray-700 text-gray-300"
                 >
                   Cancel
                 </button>

                 <button
                   onClick={() => handleAssignMember(showAssigneeModal)}
                   disabled={assigneeLoading || !assigneeEmail.trim()}
                   className="flex-1 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {assigneeLoading ? 'Assigning...' : 'Add Member'}
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
            <div key={notification.id} className={`max-w-sm p-4 rounded-xl shadow-2xl backdrop-blur-xl border ${notification.type === 'success' ? 'bg-green-500/90 border-green-400/50' : notification.type === 'error' ? 'bg-red-500/90 border-red-400/50' : 'bg-blue-500/90 border-blue-400/50'}`}>
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium flex-1 text-white">{notification.message}</p>
                <button onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))} className="text-white/80 hover:text-white">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Toast */}
      {error && board && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-xl border border-red-400/50 rounded-xl px-6 py-4 shadow-2xl max-w-md z-50">
          <div className="flex items-center gap-3">
            <p className="text-white font-medium flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-white hover:text-gray-200">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}