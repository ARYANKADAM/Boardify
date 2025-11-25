const { io } = require('socket.io-client');

if (process.argv.length < 4) {
  console.error('Usage: node scripts/test-join.js <socket_url> <token> [boardId]');
  console.error('Example: node scripts/test-join.js https://boardify-q2s5.onrender.com eyJ... 1234567890');
  process.exit(1);
}

const SOCKET = process.argv[2];
const TOKEN = process.argv[3];
const BOARD_ID = process.argv[4] || null;

console.log('Connecting to', SOCKET, 'with token present=', Boolean(TOKEN));

const socket = io(SOCKET, { auth: { token: TOKEN }, transports: ['websocket', 'polling'], timeout: 10000 });

socket.on('connect', () => {
  console.log('connected', socket.id);
  if (BOARD_ID) {
    console.log('emitting join-board', BOARD_ID);
    socket.emit('join-board', BOARD_ID);
  } else {
    console.log('no boardId provided, not emitting join-board');
  }
});

socket.on('joined', (p) => {
  console.log('joined', p);
  socket.disconnect();
  process.exit(0);
});

socket.on('join-denied', (p) => {
  console.error('join-denied', p);
  socket.disconnect();
  process.exit(1);
});

socket.on('connect_error', (err) => {
  console.error('connect_error', err && (err.message || err));
  if (err && err.data) console.error('err.data=', err.data);
  process.exit(1);
});

socket.on('error', (e) => {
  console.error('error', e);
});

// timeout to avoid hanging
setTimeout(() => {
  console.error('timeout - no response within 15s');
  socket.disconnect();
  process.exit(2);
}, 15000);
