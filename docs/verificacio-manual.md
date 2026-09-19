# Verificació manual — Horaris + operacio-i-migracio

> Checklist per a la persona que faci la verificació final amb sessions reals al domini `@stjosep.org`, abans de publicar aquest treball. Cap pas d'aquí s'ha pogut fer amb subagents (no tenen navegador ni sessió OAuth real) ni amb la suite PGlite (que valida PostgreSQL local, no el pont Firebase↔Supabase ni l'enviament real de correu). Fer-ho tot sobre una **còpia separada**, mai sobre producció directament.

## Fase 0 — Abans de tocar res

- [ ] Còpia de seguretat de la instal·lació actual i comprovació que es pot restaurar en un entorn separat
- [ ] Conservar identificadors i permisos anteriors a la còpia
- [ ] No fer servir dades reals d'alumnat/professorat en proves que quedin visibles (captures, entorn compartit)

## Fase 1 — Base de dades

- [ ] Executar `supabase/preflight.sql` sobre la còpia i resoldre els errors **i** revisar les files que retorna (el primer error atura la resta — no assumir que "cap error" vol dir "cap fila a revisar")
- [ ] Revisar manualment dates/franges històriques, solapaments, préstecs oberts del mateix dispositiu i assignacions d'estoc — el preflight ajuda, no substitueix la conciliació
- [ ] Aplicar `supabase/migrations/202609130001` a `202609130007`, **una vegada i en ordre**, sobre la base existent (`schema.sql` només serveix per a una base nova)
- [ ] Registrar les versions aplicades amb el mecanisme de migracions de l'entorn
- [ ] Migració 004: si hi ha dades d'un curs escolar diferent al que la data d'execució derivaria, ajustar el backfill abans de continuar
- [ ] Confirmar que ja existeix un coordinador a `usuaris` (no hi ha autoalta del primer administrador)

## Fase 2 — Autenticació ✅ VALIDADA (2026-09-14)

- [x] Configurar Firebase com a Third-party Auth de Supabase per al projecte `coord-stjosep`
- [x] Assignar el claim `role: authenticated` amb Firebase Admin, preservant els altres claims (script: `../../set-firebase-claim.mjs`, fora del repositori)
- [x] Forçar la renovació de sessió (logout/login)
- [x] Login real amb un compte `@stjosep.org` i confirmar que el token arriba complet

**Evidència recollida** (proves fetes sense aplicar cap migració ni tocar les polítiques actuals, per tant sense risc):

- Logs d'`edge_logs` de Supabase per a peticions des de `localhost:5173`: `jwt_issuer = https://securetoken.google.com/coord-stjosep`, `jwt_alg = RS256`, `jwt_role = authenticated`, `auth_user = <UID de Firebase>`, `status 200`. És a dir, **Supabase valida el token emès per Firebase i en resol la identitat**.
- Funció de diagnòstic temporal (creada i esborrada després): `email = amoreno@stjosep.org`, `email_verified = "true"`, `domini_ok = true`, i sobretot **`passaria_app_private_email = true`** — la comprovació exacta que farà `app_private.email()` un cop aplicades les migracions.

**Gotcha d'alta d'usuaris (no documentat a la guia original):** el claim només es pot assignar a usuaris que **ja existeixen a Firebase**, o sigui que han entrat com a mínim una vegada. Després de migrar, algú que entri per primer cop no tindrà claim → el servidor el tractarà com a anònim i li denegarà tot, sense que ell pugui fer-hi res. Cal executar-li el script i demanar-li que torni a entrar. Si el claustre creix, val la pena automatitzar-ho amb una Cloud Function que assigni el claim en crear-se l'usuari.

**Estat dels comptes a 2026-09-14:** `amoreno@stjosep.org` (coordinador) i `administrador@stjosep.org` (direcció) tenen el claim. `lferrer@stjosep.org` existeix a Firebase però no està donat d'alta a `usuaris` (era una prova, no necessita accés). Només hi ha **2 usuaris reals registrats**, cosa que redueix molt el risc del canvi: això encara és un pilot, no un desplegament amb tot el claustre a sobre.

## Fase 2b — Superfície del servidor ✅ VERIFICADA (2026-09-15)

Auditoria feta **només amb lectures** sobre la base de producció, sense escriure-hi res. No substitueix les proves amb sessions reals de les fases següents; cobreix el que es pot comprovar sense navegador.

- [x] **Cap taula de `public` sense RLS activada**, i cap taula amb RLS però sense cap política (que equivaldria a denegar-ho tot en silenci)
- [x] **Cap privilegi concedit al rol `anon`** sobre cap objecte de `public`
- [x] **Cap funció executable per `anon`**
- [x] Les polítiques d'`horaris` desplegades són `schedule_read` (select) i `own_schedule` (all)

**Auditoria dels RPC `SECURITY DEFINER`.** L'analitzador de Supabase avisa que 8 funcions `SECURITY DEFINER` són invocables pel rol `authenticated`. Això és el disseny volgut —són la via per on el client fa les operacions sensibles—, però només és segur si cadascuna comprova els permisos pel seu compte, perquè `SECURITY DEFINER` s'executa amb els privilegis del propietari i se salta l'RLS. Comprovades una a una:

| Funció | Comprovació pròpia |
|---|---|
| `create_absence` | `module_visible('substitucions')` i `creator()` |
| `review_absence` | `module_visible('substitucions')` i `approver()` |
| `update_substitution` | `module_visible('substitucions')`, i després `manager()` **o** ser el substitut marcant com a "Realitzada" una substitució pròpia i pendent |
| `create_loan` | `module_visible('prestecs')` i `creator()` |
| `change_loan_state` | `module_visible('prestecs')` i `manager()` |
| `delete_loan` | `admin()` |
| `queue_email` | `creator()`, el destinatari ha de ser un usuari donat d'alta o el correu de manteniment, i límits de mida |
| `retry_notification` | dins del `where`: `created_by = email()` **o** `admin()`; si no hi encaixa cap fila, excepció |

Les altres dues funcions `SECURITY DEFINER` (`claim_notifications` i `finish_notification`) **no tenen comprovació pròpia**, i és correcte: no estan concedides ni a `authenticated` ni a `anon`, només al `service_role` que fa servir el worker de correu. Cal no concedir-les mai a `authenticated`.

> Observacions per a qui ho revisi: `queue_email` impedeix fer servir l'aplicació com a reenviador de correu cap a adreces externes; `retry_notification` dona el mateix error tant si la notificació no existeix com si no és teva, cosa que evita confirmar l'existència d'identificadors aliens.

## Fase 3 — Permisos per rol (comptes reals separats, no simulats)

Repetir per **cada** rol (coordinador, direcció, titular, cap d'estudis, professorat, convidat):

- [ ] Login correcte i el menú només mostra els mòduls que li pertoquen
- [ ] Petició directa a l'API sense sessió → denegada
- [ ] Sessió amb email no verificat → denegada
- [ ] Compte fora de `@stjosep.org` → denegat
- [ ] Amb la visibilitat d'un mòdul buidada des de Configuració, el mòdul desapareix també per a aquest rol

## Fase 4 — Horaris

- [ ] Un professor crea, edita i elimina el seu propi horari (Lectiva i No lectiva)
- [ ] Amb dos comptes de professor diferents, confirmar que cap dels dos veu ni pot editar l'horari de l'altre a "El meu horari"
- [ ] Coordinador, Direcció, Titular i Cap d'Estudis veuen "Tots els horaris"; professorat i convidat no
- [ ] **Només el coordinador** pot editar l'horari d'una altra persona: a "Tots els horaris" li surten les cel·les clicables, i a Direcció, Titular i Cap d'Estudis no
- [ ] Amb sessió de Direcció, intentar l'edició d'un horari aliè directament contra l'API → denegada (la graella de només lectura no és l'única barrera)
- [ ] El coordinador crea un període per a un altre professor i aquell professor el veu a "El meu horari"
- [ ] A `audit_events`, el canvi anterior queda registrat a nom del coordinador, no del professor
- [ ] Les franges de cada etapa coincideixen amb els marcs horaris reals del centre, i es poden modificar des de Configuració → Horaris
- [ ] Crear un període que se solapi amb un altre del mateix professor **encara que sigui d'una etapa diferent** → rebutjat amb un missatge clar
- [ ] Dos períodes adjacents (p. ex. 9:00-10:00 i 10:00-11:00) → permesos, no compten com a solapament
- [ ] Canviar el curs escolar al selector mostra l'horari vigent d'aquell curs, no el de l'actual

## Fase 4b — Excursions (Fase A del mòdul)

- [ ] Un docent crea un esborrany a mitges i el desa; li surt a la llista com a **Esborrany**
- [ ] Amb camps buits, el botó d'enviar està apagat i la llista del que falta creix i minva mentre s'escriu
- [ ] Posar-hi un dissabte o un dia de `centre.dies-no-lectius` impedeix enviar-la
- [ ] **El servidor també ho rebutja, no només la pantalla**: des de la consola del navegador, amb sessió iniciada, `supabase.from('excursions').update({ estat: 'Proposada' }).eq('id', '<id d'un esborrany incomplet>')` ha de donar "Falten dades per enviar la proposta"
- [ ] Un docent **no** pot editar la proposta d'un altre, ni la seva un cop proposada
- [ ] Un docent **no** pot aprovar la seva pròpia excursió (l'acció ni tan sols li surt, i forçant-la no fa res)
- [ ] Direcció aprova una proposta i qui la va proposar rep l'avís per correu
- [ ] Direcció en rebutja una altra: **exigeix un motiu**, torna a Esborrany i el motiu surt a la fitxa
- [ ] **Amb diverses propostes fetes el mateix dia, cada aprovador rep un sol correu**, no un per proposta (mirar `notifications` al SQL Editor: ha d'haver-hi una sola fila per aprovador amb `event_key` que comenci per `excursions-pendents:`)
- [ ] Marcar com a reservada només ho pot fer qui gestiona
- [ ] Cancel·lar una excursió avisa qui la va proposar i els acompanyants
- [ ] A Configuració, donar la casella **Excursions** a un docent li permet gestionar; donar-li només aquesta **no** li ha de donar accés a cap dada econòmica (a la Fase A encara no n'hi ha: el punt important serà a la Fase B)
- [ ] El **convidat** no veu el mòdul enlloc
- [ ] Amb excursions del curs anterior, obrir el mòdul en un curs buit proposa copiar-les; copiar-ne dues les crea com a esborranys amb les dates un any més tard, amb els seus grups i **sense acompanyants ni responsable heretats**

## Fase 5 — Absències i substitucions

- [ ] Amb horari carregat, crear una absència seleccionant períodes **amb un forat** (p. ex. 1r i 3r període, sense el 2n) i comprovar que les hores totals i no lectives són les correctes
- [ ] Enviar el formulari dues vegades seguides (doble clic ràpid, o tallar la connexió i reintentar) **no duplica** l'absència
- [ ] Aprovar-la genera exactament una substitució per període lectiu marcat, cap per als no lectius
- [ ] Editar l'horari del professor **després** de crear l'absència no altera la petició ja enviada (la fotografia es manté)
- [ ] Sense horari carregat aquell dia → cau al formulari manual, permet una absència parcial
- [ ] Assignar com a substitut algú que ja té classe, pati, una altra substitució o una absència aprovada en aquella franja → rebutjat
- [ ] Reassignar el substitut avisa per correu tant l'anterior com el nou

## Fase 6 — Incidències (verificació específica del fix de seguretat)

- [ ] Crear una incidència com a professor
- [ ] Com a coordinador/direcció/titular/cap d'estudis, intentar canviar el camp `reporter` en actualitzar la incidència (p. ex. des del SQL Editor o si hi ha manera des de la UI) → ha de quedar **igual** que l'original, no acceptar el valor nou
- [ ] Tancar la incidència → la notificació de resolució arriba al reporter **original**, no a qui l'ha tancat ni a cap altra adreça

## Fase 7 — Notificacions (enviament real, no simulat)

- [ ] Desplegar `supabase/functions/send-notifications` en un entorn separat
- [ ] Configurar els secrets: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SEND_AS`, `NOTIFICATION_SCHEDULER_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (mai variables `VITE_*`)
- [ ] `verify_jwt=false` configurat **només** per aquesta funció
- [ ] Programar la invocació (p. ex. cada minut) amb el secret desat al gestor de secrets del planificador
- [ ] Provocar una notificació real i confirmar que **arriba de veritat** a la safata d'entrada del destinatari (no n'hi ha prou amb veure `estat=queued` o `sent` a la base de dades — "Programat" no significa "lliurat")
- [ ] Provocar un error de credencials abans que el worker reclami el lot i confirmar que els missatges es queden `pending`, no es perden
- [ ] Monitorar respostes 503 i antiguitat de la cua durant la prova

## Fase 8 — Préstecs i reserves

- [ ] Crear un préstec dues vegades amb el mateix identificador de petició → no es duplica, i l'estoc només baixa una vegada
- [ ] Retornar el mateix préstec repetidament → l'estoc només es restaura una vegada
- [ ] Reserva solapada al mateix espai i dia → rebutjada; reserves adjacents → permeses

## Fase 9 — Material Infantil

- [ ] Confirmar que quantitat, preu i cost queden congelats en confirmar una comanda (canviar el preu del material després no l'altera)
- [ ] Cancel·lar una comanda allibera l'assignació d'estoc i permet preparar-ne una de nova; una comanda confirmada i després cancel·lada no es pot reobrir
- [ ] Les comandes anteriors a la migració es mostren marcades com a estimacions, no com a dades fiables

## Fase 10 — Desplegament final

- [ ] `npm run lint`, `npm test` i `npm run build` passen al workflow de CI (`checks.yml`) sobre el Pull Request real, no només en local

> **Deute tècnic conegut (2026-09-14):** els workflows fan `npm install` i no `npm ci`. El `package-lock.json` s'ha generat sempre a macOS i no conté les dependències de `@napi-rs/wasm-runtime` (el binding WASM de rolldown), que npm només expandeix quan resol l'arbre a Linux; amb `npm ci` el runner falla amb `EUSAGE — Missing: @emnapi/core from lock file`. Regenerar el lockfile a macOS no ho arregla (o no canvia res, o esborra els binaris de Linux). La solució neta és generar-lo una vegada en una màquina Linux (o en un job de CI que el commiti) i tornar llavors a `npm ci`, que és més estricte i reproduïble.
- [ ] Publicar el frontend **només** quan la base de dades i la identitat hagin passat totes les fases anteriors
- [ ] Verificar que el domini de producció està als orígens autoritzats de Firebase Auth i de les credencials OAuth de Google Cloud

## Recuperació (assajar-ho ara, no quan calgui de veritat)

- [ ] Simular el fracàs d'una migració a l'assaig i confirmar que es pot aturar el desplegament, corregir, i repetir **només** la migració que ha fallat
- [ ] Si el frontend falla amb la base ja migrada, confirmar que es manté RLS activa i que **no** es torna a un frontend antic que faria servir accés anònim
- [ ] Tenir clar amb els responsables del centre qui defineix i comprova còpies de seguretat, retenció i recuperació — l'auditoria (`audit_events`) no és una còpia de seguretat ni implementa restauració

---

*Recordatori de qui va escriure la major part d'aquest treball, en tancar-lo: "Las 53 pruebas que mencioné correspondían al estado que dejé; no certificaban la ausencia de otros fallos de seguridad." Aquesta checklist no és un substitut d'una auditoria de seguretat professional si el centre ho considera necessari donat l'abast del canvi (dades de menors i personal, correu institucional).*
