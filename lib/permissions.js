// Centralized role/permission helpers for boards
// Roles on a board (computed): 'owner', 'admin' (global), 'member', 'viewer'
export function roleForUserOnBoard(user, board) {
  if (!user) return 'viewer';
  const globalRole = (user.role || '').toString().toLowerCase();
  // Global admin/owner override per-board roles
  if (globalRole === 'admin') return 'admin';
  if (globalRole === 'owner') return 'owner';
  if (board && String(board.owner) === String(user.id)) return 'owner';
  if (board && Array.isArray(board.members)) {
    const memberObj = board.members.find(m => {
      // support both shapes during migration: { user } or plain id
      const uid = m && (m.user ? String(m.user) : String(m));
      return uid === String(user.id);
    });
    if (memberObj) {
      // memberObj.role may be missing for older records—default to 'member'
      const role = (memberObj.role || 'member').toString().toLowerCase();
      if (role === 'admin') return 'admin';
      if (role === 'owner') return 'owner';
      if (role === 'member') return 'member';
      if (role === 'viewer') return 'viewer';
    }
  }
  return 'viewer';
}

// action -> allowed roles (minimum)
const RULES = {
  // Owners and admins have full control where reasonable
  deleteBoard: ['owner', 'admin'],
  manageMembers: ['owner'],
  editBoard: ['owner', 'admin'],
  viewBoard: ['owner', 'admin', 'member', 'viewer'],
  createTask: ['owner', 'admin', 'member'],
  editTask: ['owner', 'admin', 'member'],
  deleteTask: ['owner', 'admin', 'member'],
  createList: ['owner', 'admin'],
  deleteList: ['owner', 'admin'],
};

export function canPerform(user, board, action) {
  const role = roleForUserOnBoard(user, board);
  const allowed = RULES[action];
  if (!allowed) return false;
  return allowed.includes(role);
}

export default { roleForUserOnBoard, canPerform };
