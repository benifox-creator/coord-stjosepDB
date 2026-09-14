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

## Fase 2 — Autenticació

- [ ] Configurar Firebase com a Third-party Auth de Supabase per al projecte Firebase correcte (seguir la [documentació oficial](https://supabase.com/docs/guides/auth/third-party/firebase-auth))
- [ ] Assignar el claim `role: authenticated` als usuaris amb Firebase Admin, preservant els altres claims
- [ ] Forçar la renovació de sessió (logout/login) dels usuaris de prova
- [ ] Login real amb un compte `@stjosep.org` i confirmar que `auth.jwt()` porta `email`/`email_verified` correctament (es pot comprovar amb `select app_private.email()` des del SQL Editor autenticat, o simplement veient que l'app reconeix l'usuari)

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
- [ ] Crear un període que se solapi amb un altre del mateix professor **encara que sigui d'una etapa diferent** → rebutjat amb un missatge clar
- [ ] Dos períodes adjacents (p. ex. 9:00-10:00 i 10:00-11:00) → permesos, no compten com a solapament
- [ ] Canviar el curs escolar al selector mostra l'horari vigent d'aquell curs, no el de l'actual

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
- [ ] Publicar el frontend **només** quan la base de dades i la identitat hagin passat totes les fases anteriors
- [ ] Verificar que el domini de producció està als orígens autoritzats de Firebase Auth i de les credencials OAuth de Google Cloud

## Recuperació (assajar-ho ara, no quan calgui de veritat)

- [ ] Simular el fracàs d'una migració a l'assaig i confirmar que es pot aturar el desplegament, corregir, i repetir **només** la migració que ha fallat
- [ ] Si el frontend falla amb la base ja migrada, confirmar que es manté RLS activa i que **no** es torna a un frontend antic que faria servir accés anònim
- [ ] Tenir clar amb els responsables del centre qui defineix i comprova còpies de seguretat, retenció i recuperació — l'auditoria (`audit_events`) no és una còpia de seguretat ni implementa restauració

---

*Recordatori de qui va escriure la major part d'aquest treball, en tancar-lo: "Las 53 pruebas que mencioné correspondían al estado que dejé; no certificaban la ausencia de otros fallos de seguridad." Aquesta checklist no és un substitut d'una auditoria de seguretat professional si el centre ho considera necessari donat l'abast del canvi (dades de menors i personal, correu institucional).*
