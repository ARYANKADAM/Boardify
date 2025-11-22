'use client';
import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

export default function BoardMembersManager({ boardId, initialMembers = [] }) {
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  async function lookupUser() {
    setError(null);
    setFoundUser(null);
    if (!query) return setError('Enter email or id');
    setLoading(true);
    try {
      const url = `/api/users?email=${encodeURIComponent(query)}`;
      const res = await fetchWithAuth(url, { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Lookup failed');
      setFoundUser({ 
        id: data.user._id || data.user.id, 
        email: data.user.email, 
        name: data.user.name || null, 
        role: (data.user.role || 'member').toString().toLowerCase() 
      });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function addMember() {
    setError(null);
    if (!foundUser) return setError('No user selected');
    setLoading(true);
    const prev = members.slice();
    const optimistic = { 
      id: foundUser.id, 
      email: foundUser.email, 
      name: foundUser.name || null, 
      role: (role || 'member').toString().toLowerCase() 
    };
    setMembers(prev.concat(optimistic));
    try {
      const res = await fetchWithAuth(`/api/boards/${boardId}/members`, {
        method: 'POST',
        body: JSON.stringify({ memberId: foundUser.id, role: (role || 'member').toString().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Add failed');
      const combined = prev.concat({ 
        id: data.member.id || data.member._id || foundUser.id, 
        email: data.member.email || foundUser.email, 
        name: data.member.name || foundUser.name || null, 
        role: (data.member.role || role || 'member').toString().toLowerCase() 
      });
      const uniqueById = Array.from(new Map(combined.map(m => [String(m.id), m])).values());
      setMembers(uniqueById);
      setShowAddForm(false);
    } catch (err) {
      setMembers(prev);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
      setFoundUser(null);
      setQuery('');
    }
  }

  async function removeMember(memberId) {
    if (!confirm('Remove this member?')) return;
    const prev = members.slice();
    const idStr = String(memberId);
    setMembers(prev.filter(m => String(m.id) !== idStr));
    try {
      const res = await fetchWithAuth(`/api/boards/${boardId}/members/${encodeURIComponent(idStr)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Remove failed');
      try {
        window.dispatchEvent(new CustomEvent('board:members:changed', { detail: { boardId } }));
      } catch (e) {
        // ignore
      }
    } catch (err) {
      setMembers(prev);
      setError(err.message || String(err));
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function normalize(list) {
      if (!Array.isArray(list) || list.length === 0) {
        if (!cancelled) setMembers([]);
        return;
      }

      const promises = list.map(async (m) => {
        const memberId = m._id ? String(m._id) : (m.id ? String(m.id) : null);
        const userId = m.user ? String(m.user._id || m.user) : (m.userId ? String(m.userId) : null);
        const id = userId || memberId || (m.id || m._id) || null;
        let email = m.email || (m.user && m.user.email) || null;
        const role = (m.role || (m.user && m.user.role) || 'member').toString().toLowerCase();

        if (!email && id) {
          try {
            const res = await fetchWithAuth(`/api/users?id=${encodeURIComponent(String(id))}`, { method: 'GET' });
            if (res && res.ok) {
              const d = await res.json();
              email = d && d.user && d.user.email ? d.user.email : email;
            }
          } catch (err) {
            // ignore
          }
        }

        return { 
          id: id || (m.id || m._id), 
          memberId: memberId, 
          userId: userId, 
          email: email || null, 
          name: (m.user && m.user.name) || m.name || null, 
          role 
        };
      });

      const resolved = await Promise.all(promises);
      if (!cancelled) setMembers(resolved.filter(Boolean));
    }

    normalize(initialMembers);
    return () => { cancelled = true; };
  }, [initialMembers]);

  const roleInfo = {
    owner: { color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', icon: '👑' },
    admin: { color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', icon: '⚡' },
    member: { color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: '✏️' },
    viewer: { color: 'text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/30', icon: '👁️' }
  };

  return (
    <div className="space-y-3">
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-red-400 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
        {members.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-800/30 border border-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-xs">No members added yet</p>
          </div>
        ) : (
          members.map(m => {
            const memberRole = m.role || 'member';
            const info = roleInfo[memberRole] || roleInfo.member;
            
            return (
              <div 
                key={m.id || m.memberId || m.userId} 
                className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-2.5 hover:border-purple-500/30 transition-all group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full ${info.bgColor} border ${info.borderColor} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-sm">{info.icon}</span>
                    </div>
                    
                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {m.name || m.email || String(m.userId || m.memberId || m.id)}
                      </div>
                      {m.name && m.email && (
                        <div className="text-xs text-gray-500 truncate">{m.email}</div>
                      )}
                    </div>
                  </div>

                  {/* Role Badge & Remove Button */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${info.bgColor} border ${info.borderColor} ${info.color}`}>
                      {memberRole}
                    </span>
                    
                    <button
                      onClick={() => removeMember(m.userId || m.memberId || m.id)}
                      className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                      title="Remove member"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Member Section */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-600 hover:border-purple-500 text-gray-400 hover:text-purple-400 transition-all text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Member
        </button>
      ) : (
        <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-3 space-y-2">
          {/* Search Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Search by Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupUser()}
                placeholder="user@example.com"
                className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm"
              />
              <button
                onClick={lookupUser}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </div>

          {/* Found User */}
          {foundUser && (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-500/10 border border-purple-500/30 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {foundUser.name || foundUser.email || foundUser.id}
                  </div>
                  {foundUser.name && (
                    <div className="text-xs text-gray-500 truncate">{foundUser.email}</div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Select Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm"
                >
                  <option value="member">Member - Can edit tasks</option>
                  <option value="viewer">Viewer - Read only</option>
                  <option value="admin">Admin - Full access</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addMember}
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? 'Adding...' : 'Add Member'}
                </button>
                <button
                  onClick={() => {
                    setFoundUser(null);
                    setQuery('');
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 transition-all text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Cancel Button */}
          <button
            onClick={() => {
              setShowAddForm(false);
              setFoundUser(null);
              setQuery('');
              setError(null);
            }}
            className="w-full px-4 py-2 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 text-gray-400 hover:text-white transition-all text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
        }
      `}</style>
    </div>
  );
}