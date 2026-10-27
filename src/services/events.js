/**
 * Server-Sent Events hub (near-real-time updates). In-memory => single instance.
 * To scale horizontally, swap `publish` for Redis pub/sub; call sites stay unchanged.
 */
const clients = new Set();

export function addClient(res, user) {
  const client = { res, userId: user.id, role: user.role };
  clients.add(client);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  res.on('close', () => { clearInterval(heartbeat); clients.delete(client); });
}

/** Payloads are intentionally tiny (ids only); clients refetch through the RBAC-protected REST API. */
export function publish(event, payload, { userId, admins = false } = {}) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients) {
    if ((admins && c.role === 'admin') || (userId && c.userId === String(userId))) c.res.write(frame);
  }
}
