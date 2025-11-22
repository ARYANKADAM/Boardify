'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BoardMembersManager from '@/components/BoardMembersManager';

export default function BoardMembersPage() {
  const { boardId } = useParams();
  const router = useRouter();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serverRole, setServerRole] = useState(null);

  useEffect(() => {
    async function fetchBoard() {
      try {
        setLoading(true);
        setError('');

        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const res = await fetch('/api/boards', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to load board');
          setLoading(false);
          return;
        }

        const foundBoard = data.boards.find(b => b._id === boardId);
        if (!foundBoard) {
          setError('Board not found');
          setLoading(false);
          return;
        }

        setBoard(foundBoard);

        // Get server-side role
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const uid = payload.id || payload._id;
        if (String(foundBoard.owner) === String(uid)) {
          setServerRole('owner');
        } else if (Array.isArray(foundBoard.members) && foundBoard.members.some(m => String(m.user || m) === String(uid))) {
          setServerRole('member');
        } else {
          setServerRole('viewer');
        }

        setLoading(false);
      } catch (err) {
        setError('Something went wrong');
        setLoading(false);
      }
    }

    if (boardId) {
      fetchBoard();
    }
  }, [boardId, router]);

  const getEffectiveRole = () => {
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
  };

  const effectiveRole = getEffectiveRole();
  const canManageMembers = effectiveRole === 'owner';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
          <span className="text-gray-400 text-lg">Loading board members...</span>
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h2 className="text-xl font-bold text-red-400">Error</h2>
          </div>
          <p className="text-red-300">{error || 'Board not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-lg transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!canManageMembers) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-800/50 border border-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-300 mb-2">Access Denied</h2>
          <p className="text-gray-500">Only board owners can manage members.</p>
          <button
            onClick={() => router.push(`/board/${boardId}`)}
            className="mt-4 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-lg transition-all"
          >
            Back to Board
          </button>
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
              onClick={() => router.push(`/board/${boardId}`)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-gray-400 hover:text-white transition-all shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold bg-linear-to-r from-white to-gray-300 bg-clip-text text-transparent truncate">
                {board.title} - Members
              </h1>
              {board.description && <p className="text-sm text-gray-400 mt-0.5 truncate">{board.description}</p>}
            </div>

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${currentRoleInfo.bgColor} border ${currentRoleInfo.borderColor}`}>
              <span className="text-sm">{currentRoleInfo.icon}</span>
              <span className={`text-xs font-medium ${currentRoleInfo.color}`}>
                {effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-26 px-4 pb-6">
        <div className="w-full max-w-6xl mx-auto">
          <section className="relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Board Members
              </h2>
            </div>

            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8">
              <BoardMembersManager boardId={boardId} initialMembers={board.members || []} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}