// Prepara l'accés a Firebase dels usuaris que el coordinador dona d'alta a
// Configuració: crea el compte si la persona encara no ha entrat mai i hi
// afegeix el claim `role: authenticated`, sense el qual Supabase rebutja el
// testimoni (401) i l'app diu «sense accés». Abans es feia a mà amb
// `provision-firebase-user.mjs`.
//
// Desplegada amb verify_jwt desactivat: el testimoni és de Firebase i la
// comprovació la fa la pròpia funció preguntant a la base de dades, amb el
// testimoni de qui crida, si és coordinador (`es_coordinador`).
//
// Secret necessari: FIREBASE_SERVICE_ACCOUNT_JSON (clau de firebase-adminsdk).
import { MAX_CORREUS, normalitza, planifica, type CompteFirebase } from './pla.ts'

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void }
const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value }
const base64 = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
const b64url = (text: string) => base64(new TextEncoder().encode(text)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')

const ORIGENS = ['https://benifox-creator.github.io', 'http://localhost:5173', 'http://localhost:4173']
function cors(request: Request): Record<string, string> {
  const origen = request.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ORIGENS.includes(origen) ? origen : ORIGENS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

interface CompteServei { client_email: string; private_key: string; project_id: string }

async function googleToken(account: CompteServei) {
  const now = Math.floor(Date.now()/1000)
  const unsigned = `${b64url(JSON.stringify({alg:'RS256',typ:'JWT'}))}.${b64url(JSON.stringify({
    iss:account.client_email,scope:'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
    aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600,
  }))}`
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign'])
  const signed = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)))
  const assertion = `${unsigned}.${base64(signed).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}`
  const response = await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})})
  if (!response.ok) throw new Error(`Google authorization failed (${response.status}): ${(await response.text()).slice(0,300)}`)
  return (await response.json() as {access_token:string}).access_token
}

// Identity Toolkit: la mateixa API que fa servir firebase-admin per dins.
function identitat(projecte: string, token: string) {
  const crida = async (camí: string, cos: unknown) => {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projecte}/${camí}`, {
      method:'POST', signal:AbortSignal.timeout(15000),
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:JSON.stringify(cos),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`Identity Toolkit ${camí} (${response.status}): ${text.slice(0,200)}`)
    return text ? JSON.parse(text) : {}
  }
  return {
    async busca(emails: string[]): Promise<CompteFirebase[]> {
      const comptes: CompteFirebase[] = []
      for (let i = 0; i < emails.length; i += 100) {
        const r = await crida('accounts:lookup', { email: emails.slice(i, i + 100) }) as { users?: CompteFirebase[] }
        comptes.push(...(r.users ?? []))
      }
      return comptes
    },
    async crea(email: string): Promise<string> {
      try {
        return (await crida('accounts', { email, emailVerified: true }) as { localId: string }).localId
      } catch (error) {
        // Ja existeix (p. ex. ha entrat just ara): es busca i es continua.
        if (!(error instanceof Error && error.message.includes('EMAIL_EXISTS'))) throw error
        const [compte] = await this.busca([email])
        if (!compte) throw error
        return compte.localId
      }
    },
    async marca(localId: string, claims: Record<string, unknown>) {
      await crida('accounts:update', { localId, customAttributes: JSON.stringify(claims) })
    },
  }
}

async function esCoordinador(autoritzacio: string) {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/es_coordinador`, {
    method:'POST', signal:AbortSignal.timeout(15000),
    headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:autoritzacio,'Content-Type':'application/json'}, body:'{}',
  })
  return response.ok && (await response.json()) === true
}

async function registrats(): Promise<Set<string>> {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/usuaris?select=email`, {
    signal:AbortSignal.timeout(15000),
    headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:`Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`},
  })
  if (!response.ok) throw new Error(`No s'han pogut llegir els usuaris (${response.status})`)
  return new Set((await response.json() as {email:string}[]).map(u => u.email.toLowerCase()))
}

Deno.serve(async request => {
  const capçaleres = cors(request)
  if (request.method === 'OPTIONS') return new Response(null, { headers: capçaleres })
  const json = (cos: unknown, status = 200) => Response.json(cos, { status, headers: capçaleres })
  if (request.method !== 'POST') return json({ error: 'Mètode no permès' }, 405)

  const autoritzacio = request.headers.get('authorization') ?? ''
  if (!autoritzacio.startsWith('Bearer ') || !(await esCoordinador(autoritzacio).catch(() => false))) {
    return json({ error: 'Només el coordinador pot preparar l’accés dels usuaris.' }, 403)
  }

  try {
    const emails = normalitza((await request.json().catch(() => ({})) as { emails?: unknown }).emails)
    if (emails.length === 0) return json({ error: 'Cap correu per preparar.' }, 400)
    if (emails.length > MAX_CORREUS) return json({ error: `Com a màxim ${MAX_CORREUS} correus per vegada.` }, 400)

    const compte = JSON.parse(env('FIREBASE_SERVICE_ACCOUNT_JSON')) as CompteServei
    const fb = identitat(compte.project_id, await googleToken(compte))
    const pla = planifica(emails, await registrats(), await fb.busca(emails))

    const creats: string[] = [], marcats: string[] = [], errors: { email: string; error: string }[] = []
    const feines = [
      ...pla.crear.map(email => async () => { await fb.marca(await fb.crea(email), { role: 'authenticated' }); creats.push(email) }),
      ...pla.marcar.map(c => async () => { await fb.marca(c.localId, c.claims); marcats.push(c.email) }),
    ]
    // De cinc en cinc: prou ràpid per a un claustre sencer sense saturar Google.
    for (let i = 0; i < feines.length; i += 5) {
      await Promise.all(feines.slice(i, i + 5).map((feina, j) => feina().catch((error) => {
        const email = [...pla.crear, ...pla.marcar.map(c => c.email)][i + j]
        console.error('[provisiona-usuaris]', email, error instanceof Error ? error.message : error)
        errors.push({ email, error: 'No s’ha pogut preparar' })
      })))
    }
    return json({ creats, marcats, jaFets: pla.jaFets, descartats: pla.descartats, errors })
  } catch (error) {
    console.error('[provisiona-usuaris]', error instanceof Error ? error.message : error)
    return json({ error: 'El servei d’alta no està disponible.' }, 503)
  }
})
