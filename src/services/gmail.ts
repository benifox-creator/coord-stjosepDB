import { useAuthStore } from '../store/authStore'

function encodeBase64Url(text: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface EmailOptions {
  to: string
  subject: string
  body: string
}

export async function sendEmail({ to, subject, body }: EmailOptions): Promise<void> {
  const token = useAuthStore.getState().googleAccessToken
  if (!token) throw new Error('Sessió caducada. Torna a iniciar sessió.')

  const raw = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${encodeBase64Url(subject)}?=`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeBase64Url(raw) }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`Error enviant correu: ${err.error?.message ?? res.status}`)
  }
}
