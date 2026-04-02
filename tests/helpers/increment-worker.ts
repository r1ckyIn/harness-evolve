// Worker script spawned by concurrent counter test.
// Receives: sessionId, count, and homeOverride via process.argv
// Calls incrementCounter count times sequentially, then exits.

import { incrementCounter } from '../../src/storage/counter.js';
import { resetInit } from '../../src/storage/dirs.js';

const sessionId = process.argv[2];
const count = parseInt(process.argv[3], 10);
const homeOverride = process.argv[4];

// Override HOME for test isolation
if (homeOverride) {
  process.env.HOME = homeOverride;
}

// Reset init state since this is a fresh child process
resetInit();

async function run(): Promise<void> {
  for (let i = 0; i < count; i++) {
    await incrementCounter(sessionId);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
