"use client";
import { useEffect, useState } from "react";
import { io } from 'socket.io-client';
import { useParams } from "next/navigation";

export default function BoardPage() {
  const { boardId } = useParams();   // ✅ Correct param
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [newListTitle, setNewListTitle] = useState("");
  const [newListLoading, setNewListLoading] = useState(false);

  const [taskInputs, setTaskInputs] = useState({});
  const [taskLoading, setTaskLoading] = useState({});
  const [dragState, setDragState] = useState({
    draggingTaskId: null,
    sourceListId: null,
    dropIndex: null,
    destListId: null,
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    fetchBoard(token);
    fetchActivities(token);
    // Connect to socket server and listen for updates (send JWT for auth)
    const SOCKET_SERVER = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:4001';
    const socket = io(SOCKET_SERVER, { auth: { token }, transports: ['websocket', 'polling'] });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error', err);
      setError('Socket error: ' + (err && err.message));
    });

    socket.on('joined', (p) => {
      // Successfully joined board room
      console.debug('Joined board room', p);
    });

    socket.on('join-denied', (p) => {
      console.warn('Join denied', p);
      setError('Socket join denied: ' + (p && p.reason));
    });

    // ask to join after connect
    socket.emit('join-board', boardId);


    socket.on('task:created', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      const task = payload.data.task;
      if (!task) {
        fetchBoard(token);
        return;
      }
      // Add task to the corresponding list if present
      setLists(prev => prev.map(l => l._id === String(task.listId) ? { ...l, tasks: [...l.tasks, task] } : l));
    });

    socket.on('task:moved', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      const { taskId, listId: destListId, position } = payload.data || {};
      if (!taskId) return;
      setLists(prev => {
        // Clone lists
        const listsCopy = prev.map(l => ({ ...l, tasks: Array.isArray(l.tasks) ? [...l.tasks] : [] }));
        // find task object in current lists
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
        // If we don't have the full task data, fall back to refetch
        if (!movedTask) {
          fetchBoard(token);
          return prev;
        }
        // Insert into destination list at position
        const destIndex = listsCopy.findIndex(l => l._id === String(destListId));
        if (destIndex === -1) {
          // dest list not present locally — fallback
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

    socket.on('activity:created', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      // Try to append activity to sidebar from payload; fallback to fetch
      const activity = payload.data;
      if (activity && activity.details) {
        setActivities(prev => [{ ...activity, timestamp: activity.timestamp || Date.now(), _id: activity._id || Math.random().toString(36).slice(2) }, ...prev]);
      } else {
        fetchActivities(token);
      }
    });

    return () => {
      socket.emit('leave-board', boardId);
      socket.disconnect();
    };
  }, [boardId]);

  async function fetchBoard(token) {
    try {
      setLoading(true);
      setError("");

      // Fetch boards
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

      // Fetch lists
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
    } catch (err) {
      setError("Something went wrong");
      setLoading(false);
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
  }

  async function handleCreateTask(e, listId) {
    e.preventDefault();
    setTaskLoading(prev => ({ ...prev, [listId]: true }));
    setError("");

    const token = localStorage.getItem("token");
    const { title, description } = taskInputs[listId] || {};

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
        position: lists.find(l => l._id === listId)?.tasks.length || 0
      }),
    });

    const data = await res.json();
    setTaskLoading(prev => ({ ...prev, [listId]: false }));

    if (!res.ok) {
      setError(data.error || "Failed to create task");
      return;
    }

    setLists(prev =>
      prev.map(l =>
        l._id === listId ? { ...l, tasks: [...l.tasks, data.task] } : l
      )
    );

    // Clear inputs
    setTaskInputs(prev => ({
      ...prev,
      [listId]: { title: "", description: "" }
    }));
  }

  async function handleDeleteTask(taskId) {
    setError("");

    // Normalize the id (taskId might be an object)
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

    // Refresh board for latest lists
    await fetchBoard(token);
  }

  async function handleDeleteList(listId) {
    setError("");

    // normalize id
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

  // Drag and drop handlers
  function onDragStart(e, taskId, listId) {
    // store dragged task id and its source list
    e.dataTransfer.setData('text/plain', taskId);
    setDragState({ draggingTaskId: taskId, sourceListId: listId, dropIndex: null, destListId: null });
    // allow move
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onTaskDragOver(e, index, listId) {
    // Called when dragging over a specific task to indicate insertion index
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState(prev => ({ ...prev, dropIndex: index, destListId: listId }));
  }

  async function onDrop(e, destListId) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    let id = e.dataTransfer.getData('text/plain');
    if (!id) {
      // try from state
      id = dragState.draggingTaskId;
    }
    if (!id) return;

    // Find source list and source tasks
    const sourceListId = dragState.sourceListId;
    if (!sourceListId) return;

    // Determine target position: use dropIndex if provided (insert before that index), otherwise append
    const dropIndex = (dragState.destListId === destListId && typeof dragState.dropIndex === 'number') ? dragState.dropIndex : null;

      // Optimistically move task in UI at the dropIndex
    setLists(prev => {
      // find task object
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

    // Persist change: update task to set listId and new position
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
        // rollback by refetching board
        await fetchBoard(token);
        return;
      }
      // Success — refresh lists to ensure canonical data (positions, etc.)
      await fetchBoard(token);
    } catch (err) {
      console.error('Error persisting drag move', err);
      setError('Failed to move task');
      await fetchBoard(token);
    } finally {
        setDragState({ draggingTaskId: null, sourceListId: null, dropIndex: null, destListId: null });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Board not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded shadow flex gap-6">

        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-6 text-blue-700">{board.title}</h1>
          <p className="mb-8 text-gray-600">{board.description}</p>

        {/* Create List */}
        <form className="mb-8 flex gap-4" onSubmit={handleCreateList}>
          <input
            type="text"
            placeholder="New List Title"
            value={newListTitle}
            onChange={e => setNewListTitle(e.target.value)}
            className="p-2 border rounded flex-1"
            required
          />

          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            disabled={newListLoading}
          >
            {newListLoading ? "Adding..." : "Add List"}
          </button>
        </form>

          {/* Lists */}
          <div className="flex gap-6 overflow-x-auto">

          {lists.length === 0 ? (
            <div className="text-gray-500">No lists found.</div>
          ) : (
            lists.map(list => (
              <div key={list._id} className="bg-gray-100 p-4 rounded w-64 min-w-64" onDragOver={onDragOver} onDrop={(e) => onDrop(e, list._id)}>

                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-semibold text-lg">{list.title}</h2>

                  <button
                    onClick={() => handleDeleteList(list._id || list.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-xs"
                  >
                    Delete List
                  </button>
                </div>

                {/* Add Task */}
                <form className="mb-4" onSubmit={e => handleCreateTask(e, list._id)}>
                  <input
                    type="text"
                    placeholder="Task Title"
                    value={taskInputs[list._id]?.title || ""}
                    onChange={e =>
                      setTaskInputs(prev => ({
                        ...prev,
                        [list._id]: { ...prev[list._id], title: e.target.value }
                      }))
                    }
                    className="w-full mb-2 p-2 border rounded"
                    required
                  />

                  <input
                    type="text"
                    placeholder="Description"
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
                    className="w-full mb-2 p-2 border rounded"
                  />

                  <button
                    type="submit"
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 w-full"
                    disabled={taskLoading[list._id]}
                  >
                    {taskLoading[list._id] ? "Adding..." : "Add Task"}
                  </button>
                </form>

                {/* Tasks */}
                <ul className="space-y-2">
                  {list.tasks.map((task, idx) => (
                    <li
                      key={task._id}
                      draggable
                      onDragStart={(e) => onDragStart(e, task._id || task.id || task, list._id)}
                      onDragOver={(e) => onTaskDragOver(e, idx, list._id)}
                      className="bg-white p-2 rounded shadow flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-gray-600">{task.description}</div>
                      </div>

                      <button
                        onClick={() => handleDeleteTask(task._id || task.id || task)}
                        className="bg-red-400 text-white px-2 py-1 rounded hover:bg-red-600 text-xs ml-2"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>

              </div>
            ))
          )}
          </div>
        </div>

        {/* Activity Sidebar */}
        <aside className="w-80 border-l pl-4">
          <h3 className="font-semibold mb-3">Activity</h3>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {activities.length === 0 ? (
              <div className="text-gray-500 text-sm">No recent activity.</div>
            ) : (
              activities.map(act => (
                <div key={act._id} className="text-sm">
                  <div className="text-gray-800">{act.details}</div>
                  <div className="text-xs text-gray-500">{new Date(act.timestamp).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
