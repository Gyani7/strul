export async function handleQueue(batch, env, ctx) {
  if (!env.SHORTUL_DB) {
    for (const message of batch.messages) {
      message.retry();
    }
    return;
  }

  const statements = [];

  for (const message of batch.messages) {
    const event = message.body || {};

    // New events already contain event_id.
    // msg.id gives us a stable fallback for older Queue messages.
    const eventId =
      event.event_id ||
      message.id ||
      crypto.randomUUID();

    statements.push(
      env.SHORTUL_DB.prepare(`
        INSERT OR IGNORE INTO click_buffer
          (
            event_id,
            shortcode,
            clicked_at,
            country,
            device_type,
            referrer,
            visitor_hash,
            synced
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).bind(
        eventId,
        event.shortcode || '',
        event.clicked_at || new Date().toISOString(),
        event.country || null,
        event.device_type || null,
        event.referrer || null,
        event.visitor_hash || null
      )
    );
  }

  try {
    // One D1 batch instead of one request per click.
    await env.SHORTUL_DB.batch(statements);

    // Only ACK after D1 confirms the batch.
    for (const message of batch.messages) {
      message.ack();
    }
  } catch (error) {
    console.error('Queue → D1 batch failed:', error);

    // Nothing is ACKed, so Queue can retry the batch.
    for (const message of batch.messages) {
      message.retry();
    }
  }
}
