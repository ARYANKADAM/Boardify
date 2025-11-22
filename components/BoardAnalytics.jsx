'use client';

import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export default function BoardAnalytics({ boardId }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();

    // Set up real-time updates for analytics
    const SOCKET_SERVER = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:4001';
    const token = localStorage.getItem('token');
    const socket = io(SOCKET_SERVER, { auth: { token }, transports: ['websocket', 'polling'] });

    socket.on('connect_error', (err) => {
      console.error('Analytics socket connect error', err);
    });

    socket.on('joined', (p) => {
      console.debug('Analytics joined board room', p);
    });

    socket.on('join-denied', (p) => {
      console.warn('Analytics join denied', p);
    });

    socket.emit('join-board', boardId);

    // Listen for task movements that affect analytics
    socket.on('task:moved', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      console.log('Analytics: Task moved, refreshing data');
      fetchAnalytics(); // Refresh analytics when tasks are moved between lists
    });

    socket.on('task:created', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      console.log('Analytics: Task created, refreshing data');
      fetchAnalytics(); // Refresh analytics when new tasks are created
    });

    socket.on('task:deleted', (payload) => {
      if (!payload || !payload.data) return;
      if (payload.boardId && String(payload.boardId) !== String(boardId)) return;
      console.log('Analytics: Task deleted, refreshing data');
      fetchAnalytics(); // Refresh analytics when tasks are deleted
    });

    return () => {
      socket.emit('leave-board', boardId);
      socket.disconnect();
    };
  }, [boardId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-400">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p className="text-red-400 font-medium">Failed to load analytics</p>
        <p className="text-gray-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!analytics) return null;

  const { overview, burndownData, teamProductivity, priorityStats } = analytics;

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-blue-400 text-sm font-medium">Total Tasks</p>
              <p className="text-white text-2xl font-bold">{overview.totalTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-green-400 text-sm font-medium">Completed</p>
              <p className="text-white text-2xl font-bold">{overview.completedTasks}</p>
            </div>
          </div>
          <p className="text-green-300 text-sm">{overview.completionRate}% completion rate</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-yellow-400 text-sm font-medium">Due Soon</p>
              <p className="text-white text-2xl font-bold">{overview.dueSoonTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-red-600/10 border border-red-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-red-400 text-sm font-medium">Overdue</p>
              <p className="text-white text-2xl font-bold">{overview.overdueTasks}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Burndown Chart */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Burndown Chart
          </h3>
          <div className="h-64 flex items-end justify-between gap-1">
            {burndownData.slice(-14).map((day, index) => (
              <div key={day.date} className="flex flex-col items-center flex-1">
                <div
                  className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t-sm transition-all hover:from-purple-400 hover:to-purple-300"
                  style={{
                    height: `${Math.max(10, (day.remaining / Math.max(...burndownData.map(d => d.remaining))) * 200)}px`,
                    minHeight: '4px'
                  }}
                  title={`${day.date}: ${day.remaining} tasks remaining`}
                ></div>
                <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <p className="text-gray-400 text-sm">Tasks remaining over the last 14 days</p>
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Priority Distribution
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-gray-300">High Priority</span>
              </div>
              <span className="text-white font-semibold">{priorityStats.high}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-gray-300">Medium Priority</span>
              </div>
              <span className="text-white font-semibold">{priorityStats.medium}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-gray-300">Low Priority</span>
              </div>
              <span className="text-white font-semibold">{priorityStats.low}</span>
            </div>
          </div>
          <div className="mt-6">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full"
                style={{
                  width: `${overview.totalTasks > 0 ? 100 : 0}%`
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Productivity */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Team Productivity
        </h3>
        {teamProductivity.length > 0 ? (
          <div className="space-y-4">
            {teamProductivity.map((member) => (
              <div key={member.email} className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-300 font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{member.name}</p>
                      <p className="text-gray-400 text-sm">{member.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">{member.completedTasks}/{member.totalTasks}</p>
                    <p className="text-gray-400 text-sm">tasks completed</p>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${member.completionRate}%` }}
                  ></div>
                </div>
                <p className="text-indigo-300 text-sm mt-2">{member.completionRate.toFixed(1)}% completion rate</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-800/50 border border-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-500">No team member data available</p>
            <p className="text-gray-600 text-sm mt-1">Assign tasks to team members to see productivity metrics</p>
          </div>
        )}
      </div>
    </div>
  );
}