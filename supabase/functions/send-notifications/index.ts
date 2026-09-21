export {}
// Deployed separately. Requires Workspace domain-wide delegation for gmail.send.
// Invoke from an authenticated scheduler; never from the public browser.
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void }
const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value }
const base64 = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
const b64url = (text: string) => base64(new TextEncoder().encode(text)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')

async function gmailToken() {
  const account = JSON.parse(env('GOOGLE_SERVICE_ACCOUNT_JSON')) as {client_email:string;private_key:string}
  const now = Math.floor(Date.now()/1000)
  const unsigned = `${b64url(JSON.stringify({alg:'RS256',typ:'JWT'}))}.${b64url(JSON.stringify({
    iss:account.client_email,sub:env('GOOGLE_SEND_AS'),scope:'https://www.googleapis.com/auth/gmail.send',
    aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600,
  }))}`
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign'])
  const signed = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)))
  const assertion = `${unsigned}.${base64(signed).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}`
  const response = await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})})
  // El cos de la resposta de Google diu **per què** ha fallat (delegació no
  // autoritzada, abast que no hi és, bústia remitent que no existeix). Sense
  // això, un 400 no es distingeix d'un altre i no hi ha per on començar.
  if (!response.ok) throw new Error(`Google authorization failed (${response.status}): ${(await response.text()).slice(0,300)}`)
  return (await response.json() as {access_token:string}).access_token
}
async function rpc(name:string,args:Record<string,unknown>={}) {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:`Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify(args)})
  if (!response.ok) throw new Error(`Notification database operation failed (${response.status})`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}
interface Notification { id:string;recipient:string;subject:string;body:string;claim_token:string }
Deno.serve(async request => {
  if (request.method!=='POST' || request.headers.get('x-scheduler-secret')!==env('NOTIFICATION_SCHEDULER_SECRET')) return new Response('Unauthorized',{status:401})
  try {
    const token = await gmailToken()
    const batch = await rpc('claim_notifications') as Notification[]
    await Promise.all(batch.map(async n => {
      let failure: string | null = null
      try {
        if (/[\r\n]/.test(n.recipient)) throw new Error('Invalid recipient')
        const mime = [`From: ${env('GOOGLE_SEND_AS')}`,`To: ${n.recipient}`,`Message-ID: <${n.id}@sjo-hub.local>`,
          `Subject: =?UTF-8?B?${base64(new TextEncoder().encode(n.subject))}?=`,
          'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','',n.body].join('\r\n')
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({raw:b64url(mime)})})
        if (!response.ok) throw new Error(`Gmail delivery failed (${response.status}): ${(await response.text()).slice(0,200)}`)
      } catch (error) { failure=error instanceof Error ? error.message : 'Delivery failed' }
      await rpc('finish_notification',{p_id:n.id,p_claim:n.claim_token,p_error:failure})
    }))
    return Response.json({processed:batch.length})
  } catch (error) {
    // El cos de la resposta es queda opac a propòsit —qui la crida no ha de
    // saber com està muntat això— però el motiu ha d'anar al registre: sense
    // ell, un 503 no diu si falta un secret, si la delegació no s'ha
    // autoritzat o si la bústia remitent no existeix, i són arreglos ben
    // diferents. Va a `console.error`, que no surt mai al navegador.
    console.error('[send-notifications]', error instanceof Error ? error.message : error)
    return new Response('Notification service unavailable',{status:503})
  }
})
