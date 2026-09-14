# Horaris — Revisió del pla (2026-09-14)

> Aquest document substitueix, per a tot allò que s'hi digui explícitament, `docs/superpowers/plans/2026-09-12-horaris.md`. No reescriu tasca per tasca: documenta què ha canviat, per què el pla original ha quedat superat en la majoria de punts, i què queda realment pendent.

## Què ha passat

Mentre s'executava el pla original (Tasques 1-7 completades i commitejades a `feat-horaris`), una altra sessió ha treballat **sense commitejar**, en aquest mateix worktree, en una iniciativa molt més àmplia (`docs/operacio-i-migracio.md`): substitueix el model de seguretat permissiu (`anon_full_access`) per RLS real basat en JWT de Firebase com a Third-party Auth de Supabase, mou la lògica de negoci crítica al servidor (funcions `security definer` en PL/pgSQL), afegeix un sistema d'auditoria, una cua de notificacions per correu, i versiona els horaris per curs escolar. Això toca **58 fitxers** de tot el projecte, no només Horaris.

He revisat aquest treball (llegit el nucli de seguretat i les migracions d'horaris/absències jo mateix; una revisió de seguretat acotada de la resta —notificacions, préstecs, la Edge Function— corre en paral·lel i s'annexarà aquí). Veredicte provisional: **és un treball sòlid i coherent, no trencat ni maliciós** — `npm test` (53/53) i `npm run build` (incloent el nou `check:worker`) passen nets ara mateix amb tot això aplicat.

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

1. **Decidir què fer amb els canvis sense commitejar.** Ara mateix hi ha 58 fitxers modificats i uns quants directoris nous (`supabase/migrations/`, `supabase/functions/`, `tests/`, `src/app/`, `src/utils/`) sense cap commit. Abans de continuar-hi treballant cal:
   - Confirmar que la sessió que ho ha escrit ("Dispatch background conversation") ha acabat i no hi tornarà a escriure a sobre.
   - Commitejar-ho en commits lògics (per migració/àrea, seguint l'estil `feat(...)`/`fix(...)` ja establert), no en un sol commit gegant.
2. **Revisió de seguretat/correcció de la resta de l'abast** (notificacions, préstecs, Edge Function, `preflight.sql`) — en curs en paral·lel a aquest document; qualsevol troballa Important/Crítica s'hi annexarà abans de considerar-ho llest per fusionar.
3. **`schema.sql` ha quedat desactualitzat respecte a les migracions** (per exemple, encara no reflecteix `curs_escolar`/`vigent_desde`/`vigent_fins` a `horaris` als seus `create table`) — la pròpia guia `docs/operacio-i-migracio.md` ho reconeix ("`schema.sql` és exclusivament el punt de partida d'una base nova"), però cal verificar que un cop aplicades totes les migracions sobre una base nova creada amb `schema.sql`, el resultat és idèntic al d'aplicar-les sobre la base real — forma part de la revisió pendent del punt 2.
4. **Verificació manual final amb sessions reals de cada rol** (Tasca 10 original, mai feta) — necessita algú amb accés real al domini `@stjosep.org`.
5. **Decidir l'abast d'aquest merge**: donat que el treball sense commitejar va molt més enllà d'Horaris (préstecs, reserves, auditoria, notificacions), pot valer la pena tractar-ho com una branca/iniciativa pròpia en lloc de fusionar-ho tot sota `feat-horaris` — a decidir amb qui porti la sessió "Dispatch background conversation".
