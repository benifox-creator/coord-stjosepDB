# Horaris — Revisió del pla (2026-09-14)

> Aquest document substitueix, per a tot allò que s'hi digui explícitament, `docs/superpowers/plans/2026-09-12-horaris.md`. No reescriu tasca per tasca: documenta què ha canviat, per què el pla original ha quedat superat en la majoria de punts, i què queda realment pendent.

## Què ha passat

Mentre s'executava el pla original (Tasques 1-7 completades i commitejades a `feat-horaris`), una altra sessió ha treballat **sense commitejar**, en aquest mateix worktree, en una iniciativa molt més àmplia (`docs/operacio-i-migracio.md`): substitueix el model de seguretat permissiu (`anon_full_access`) per RLS real basat en JWT de Firebase com a Third-party Auth de Supabase, mou la lògica de negoci crítica al servidor (funcions `security definer` en PL/pgSQL), afegeix un sistema d'auditoria, una cua de notificacions per correu, i versiona els horaris per curs escolar. Això toca **58 fitxers** de tot el projecte, no només Horaris.

He revisat aquest treball (llegit el nucli de seguretat i les migracions d'horaris/absències jo mateix, més una revisió de seguretat acotada de la resta —notificacions, préstecs, la Edge Function— ja completada). Veredicte: **és un treball sòlid i coherent en conjunt, no trencat ni maliciós, però amb un forat de seguretat real que cal tancar abans de fusionar-ho** — `npm test` (53/53) i `npm run build` (incloent el nou `check:worker`) passen nets ara mateix amb tot això aplicat.

### Troballes de la revisió de seguretat

**Important — cal arreglar abans de fusionar:**
- `supabase/migrations/202609130007_operational_notifications.sql:9-16` — el trigger només fixa `reporter := app_private.email()` a l'INSERT d'`incidencies`. La política `module_update` (`202609130002_access.sql:75-88`) només exigeix `app_private.manager()`, sense restringir columnes, així que qualsevol coordinador/direcció/titular/cap d'estudis pot fer `update incidencies set reporter='qualsevol@fora.cat'` i la cua envia el correu del centre a aquesta adreça — evitant la llista blanca que `queue_email` sí aplica a la resta del sistema. Comparat amb `validate_substitution`, que sí verifica el destinatari contra `usuaris`, aquest camí és l'excepció insegura.

  **✅ Arreglat (2026-09-14):** el trigger ara fa `new.reporter := old.reporter` en qualsevol UPDATE d'`incidencies`, així el reporter queda immutable un cop creada la incidència. Afegit un test de regressió a `tests/database.test.ts` ("does not let closing an incident redirect its notification to an arbitrary reporter") que falla sense el fix i passa amb ell (verificat manualment revertint el fix i tornant-lo a aplicar). Suite completa: 54/54 tests, build net. **Encara sense commitejar** — forma part del mateix lot de canvis pendents de commitejar del punt "Què queda pendent de debò" més avall.

**Minor (no bloquegen, però val la pena anotar-los):**
- `…0007:8-10` — `app_private.email()` retorna `NULL` (no `''`) sense sessió amb claim verificat; `reporter` és `not null`, així que qualsevol inserció fora del flux normal (service_role, script d'importació) falla amb un error poc clar.
- `supabase/preflight.sql:8-20` — el primer error dins el bloc `DO` avorta la transacció i amaga les comprovacions posteriors; l'operador no veu "errors i files" alhora com demana la guia. (Sí és realment de només lectura: `begin transaction read only`.)
- `…0005:60-66` (`retry_notification`) — sense límit de freqüència; qualsevol `created_by` pot reintentar en bucle els seus propis avisos fallats.

**Confirmat correcte:** el parsing d'hores i `slot()` (rang `[)`, verificat amb test propi que "9:00-10:00"/"10:00-11:00" no col·lideixen), la cua de notificacions (`for update skip locked`, lease reclamable, `attempts<5`, backoff `least(3600,30*2^attempts)`), la Edge Function (POST+secret abans de qualsevol feina, falla tancada si falta el secret, cap fuita de secrets en errors), la migració de comandes (sense conflicte amb RLS), i que `schema.sql` no ha divergit de les migracions (verificat pels propis tests, que apliquen totes dues rutes).

**Buits de cobertura de tests** (no bloquegen, però són el següent que jo afegiria): no hi ha cap test que un professor no pugui llegir les absències d'un altre (`absence_read`, `202609130002_access.sql:101`, sense provar — el cas anàleg a `horaris` sí que ho està), ni de `substitution_read`, `own_notifications`, denegació d'escriptura a `convidat`, o `app_private.minutes` amb entrada malformada.

## Per què el pla original queda superat

El disseny original (pla de 2026-09-12) assumia el model de seguretat que hi havia llavors: RLS permissiu, tota la lògica (còmput d'hores, generació de substitucions) al client, identitat de professor com a string sense verificar contra res més que `usuaris`. La nova base assumeix el contrari: el client mai és de confiança, i el servidor és qui decideix.

Concretament:

- **Tasca 2 (esquema):** superada. `horaris`/`absencia_periodes` ja no es defineixen només a `schema.sql` — viuen ara al flux de migracions `supabase/migrations/2026091300XX_*.sql`, i `horaris` ha crescut amb `curs_escolar`, `vigent_desde`, `vigent_fins`, `necessita_cobertura`. La migració `202609130002_access.sql` substitueix la unique key original (`professor, dia_setmana, etapa, franja`) per un control de solapament fet amb un trigger (`validate_schedule`) que compara rangs de temps real i **rebutja solapaments entre etapes diferents** — exactament l'escenari que el pla original havia decidit cobrir afegint `etapa` a la clau única, però resolt d'una manera més correcta (la clau única no distingia solapaments parcials; el trigger sí).
- **Tasques 5, 7, 8 (stores i lògica de negoci):** superades. `useAbsencies.crear`/`aprovar` ja no insereixen files ni calculen hores al client — criden `create_absence`/`review_absence` via `callRpc`, funcions `security definer` que fan, dins una única transacció amb bloqueig consultiu: validar el dia no lectiu, sumar minuts dels períodes, desar la fotografia a `absencia_periodes`, i generar les substitucions de cobertura. La idempotència hi és de sèrie (`request_id`), cosa que el pla original no contemplava.
- **Tasques 6, 9 (UI):** ja implementades sobre la nova base. `HorarisPage.tsx` versiona per curs escolar amb un selector de "data de consulta"; `AbsenciaForm.tsx` ja fa la selecció de períodes amb fallback manual (la mateixa idea del pla original) més `RequestId` per evitar duplicats en reenviaments, i ja descarta dies no lectius (`centre.dies-no-lectius`) — una cobertura que el pla original no havia previst.
- **Tasques 1, 3, 4:** es mantenen com a base vàlida (Vitest configurat, `horaris.tipus-no-lectiva`/`visibilitat.horaris`, tipus i permisos del mòdul) — res d'això ha quedat invalidat, només ampliat amb els camps nous.
- **Tasca 10 (verificació manual final):** encara pendent, sense canvis de fons — segueix sent l'únic pas que necessita un humà amb sessió real de Google al domini del centre.

## Diferències de disseny a tenir en compte d'ara endavant

- **Client mai de confiança:** qualsevol nova funcionalitat sobre absències/horaris/substitucions ha d'anar via RPC (`create_absence`, `review_absence`, `update_substitution`) o CRUD directe només quan la taula té política RLS pròpia adequada (`own_schedule` per a `horaris`) — no tornar a posar lògica de validació de solapaments o generació de cobertura al client.
- **Horaris versionats:** un horari ja no és "el d'ara", és "el vigent en una data dins un curs escolar concret" (`vigent_desde`/`vigent_fins`/`curs_escolar`). Qualsevol pantalla que llegeixi `horaris` ha de filtrar per vigència, com ja fa `HorarisPage.tsx` (`activeHoraris`).
- **`app_private.slot`/`app_private.minutes` (SQL) i `slotMinutes`/`overlaps` (`src/utils/schoolCalendar.ts`, client):** mantenen la mateixa semàntica de rang mig-obert `[inici, fi)` — verificat que "9:00-10:00" i "10:00-11:00" no es consideren solapats ni al client ni al servidor. Qualsevol lògica de franges nova ha de reutilitzar aquestes funcions, no reimplementar el parsing.
- **`request_id` com a patró d'idempotència:** ja s'usa a `create_absence` i a `create_loan` (préstecs). Qualsevol acció nova que pugui reenviar-se (doble clic, reintent de xarxa) hauria de seguir el mateix patró.

## Què queda pendent de debò

1. ~~Tancar el forat de seguretat d'`incidencies.reporter`~~ — **fet i verificat** amb test de regressió (veure troballes de seguretat més amunt). Encara sense commitejar, com la resta del lot.
2. **Decidir què fer amb els canvis sense commitejar.** Ara mateix hi ha 58 fitxers modificats i uns quants directoris nous (`supabase/migrations/`, `supabase/functions/`, `tests/`, `src/app/`, `src/utils/`) sense cap commit. Abans de continuar-hi treballant cal:
   - Confirmar que la sessió que ho ha escrit ("Dispatch background conversation") ha acabat i no hi tornarà a escriure a sobre.
   - Commitejar-ho en commits lògics (per migració/àrea, seguint l'estil `feat(...)`/`fix(...)` ja establert), no en un sol commit gegant.
3. **`schema.sql` ha quedat desactualitzat respecte a les migracions** (per exemple, encara no reflecteix `curs_escolar`/`vigent_desde`/`vigent_fins` a `horaris` als seus `create table`) — verificat que no és un problema real: els propis tests (`tests/database.test.ts`, `tests/migration.test.ts`) apliquen totes dues rutes (schema.sql nou + migracions, i schema.sql antic + migracions) i passen; `schema.sql` sol ja no crea cap política (falla tancat).
4. **Afegir els tests de RLS que falten** (aïllament d'absències entre professors, `substitution_read`, `own_notifications`, denegació a `convidat`, `app_private.minutes` amb entrada malformada) — no bloquegen, però són el buit de cobertura més clar.
5. **Verificació manual final amb sessions reals de cada rol** (Tasca 10 original, mai feta) — necessita algú amb accés real al domini `@stjosep.org`.
6. **Decidir l'abast d'aquest merge**: donat que el treball sense commitejar va molt més enllà d'Horaris (préstecs, reserves, auditoria, notificacions), pot valer la pena tractar-ho com una branca/iniciativa pròpia en lloc de fusionar-ho tot sota `feat-horaris` — a decidir amb qui porti la sessió "Dispatch background conversation".
