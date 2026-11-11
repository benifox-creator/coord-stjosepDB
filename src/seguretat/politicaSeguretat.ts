// Política de seguretat de contingut (CSP) de la web publicada. Diu al
// navegador d'on pot carregar codi i amb qui pot parlar la pàgina: si mai algú
// aconseguís colar-hi un script, no podria carregar res de fora ni enviar
// dades enlloc que no sigui aquí.
//
// Qui hi ha i per què:
// - Supabase: les dades (https) i el temps real (wss).
// - Firebase: el domini d'autenticació (la finestra de Google i l'iframe que
//   Firebase hi obre) i les API de Google que renoven la sessió.
// - apis.google.com: el script que Firebase carrega per a l'inici de sessió.
// - Sentry: on van els errors de la web.
// - Imatges https: els articles de la Base de Coneixement en poden enllaçar.
export function politicaSeguretat({ supabaseUrl, firebaseAuthDomain }: {
  supabaseUrl: string
  firebaseAuthDomain: string
}): string {
  const supabase = supabaseUrl.replace(/\/+$/, '')
  const supabaseWs = supabase.replace(/^https:/, 'wss:')
  const firebase = firebaseAuthDomain ? `https://${firebaseAuthDomain}` : ''
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", 'https://apis.google.com'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'", supabase, supabaseWs,
      'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com',
      'https://www.googleapis.com', 'https://apis.google.com', 'https://*.sentry.io',
    ],
    'frame-src': [firebase, 'https://accounts.google.com', 'https://apis.google.com'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  }
  return Object.entries(directives)
    .map(([nom, valors]) => [nom, ...valors.filter(Boolean)].join(' '))
    .join('; ')
}
