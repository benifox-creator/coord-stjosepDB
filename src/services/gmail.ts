import { callRpc } from './db'

// A successful call means persisted in the delivery queue, not delivered yet.
// Delivery and retries belong to the server worker, independent of browser sessions.
export async function sendEmail({ to, subject, body }: { to: string; subject: string; body: string }): Promise<void> {
  await callRpc('queue_email', { p_to: to, p_subject: subject, p_body: body })
}
