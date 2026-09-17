// ── Queue consumer: batch write click events into D1 ──────────

import { d1RecordClick } from './db.js';

export async function handleQueue(batch, env, ctx) {
  const writes = batch.messages.map(async (msg) => {
    try {
      await d1RecordClick(env, msg.body);
      msg.ack();
    } catch (e) {
      // Retry on failure — queue will redeliver up to max_retries
      msg.retry();
    }
  });
  await Promise.allSettled(writes);
}
