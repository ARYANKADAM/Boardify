import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Resolve .env.local relative to this script file so dotenv loads correctly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env.local');

// Diagnostics: print resolved env path and file existence before loading
console.log('Resolved env path:', envPath);
console.log('.env.local exists:', fs.existsSync(envPath));
try {
  const raw = fs.readFileSync(envPath, { encoding: 'utf8' });
  console.log('.env.local preview:\n', raw.split('\n').slice(0, 20).join('\n'));
} catch (e) {
  console.log('Could not read .env.local:', e && e.message);
}

dotenv.config({ path: envPath });
console.log('After dotenv.config -> process.env.MONGODB_URI:', process.env.MONGODB_URI ? '[SET]' : '[NOT SET]');

// Import application modules dynamically AFTER dotenv has loaded to avoid
// ESM import hoisting which can evaluate modules (and their env checks)
const { connectToDatabase } = await import('../lib/mongodb.js');
const BoardModule = await import('../models/Board.js');
const Board = BoardModule.default || BoardModule;

async function main() {
  console.log('Connecting to database...');
  try {
    // Fail fast if the MongoDB server is unreachable (Atlas may hang waiting)
    await Promise.race([
      connectToDatabase(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timed out (10s)')), 10000))
    ]);
    console.log('Connected. Scanning boards...');
  } catch (e) {
    console.error('Failed to connect to MongoDB:', e && e.message);
    console.error('Common causes: invalid MONGODB_URI, Atlas IP whitelist not allowing your IP, network/DNS issues, or incorrect credentials.');
    console.error('Your resolved MONGODB_URI begins with:', (process.env.MONGODB_URI || '').slice(0, 40));
    process.exit(1);
  }
  const boards = await Board.find({});
  let changedCount = 0;
  for (const board of boards) {
    if (!Array.isArray(board.members)) continue;
    let needsUpdate = false;
    const newMembers = board.members.map(m => {
      if (m && typeof m === 'object' && (m.user || m.user === null)) {
        // already shaped
        return m;
      }
      // legacy value (ObjectId or string)
      needsUpdate = true;
      const uid = m && m._id ? String(m._id) : String(m);
      return { user: uid, role: 'member' };
    });
    if (needsUpdate) {
      board.members = newMembers;
      try {
        await board.save();
        console.log(`Updated board ${board._id}`);
        changedCount++;
      } catch (e) {
        console.error(`Failed to update board ${board._id}:`, e);
      }
    }
  }
  console.log(`Migration complete. Updated ${changedCount} boards.`);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
