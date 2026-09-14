# Operació i migració

## Què canvia

L’aplicació gestiona activitat escolar mantenint els càrrecs existents. Horaris, absències, cobertura, reserves i recursos comparteixen una identitat verificada i permisos al servidor. La pantalla Inici prioritza el dia del docent i les decisions pendents dels responsables.

| Operació | Autoritat existent preservada |
| --- | --- |
| Usuaris, visibilitat, configuració general | Coordinació |
| Inventari i publicació de coneixement | Coordinació |
| Revisar absències | Coordinació, Direcció, Titularitat |
| Gestionar substitucions i operacions generals | Anteriors i Cap d’Estudis |
| Horari propi i comunicar absències | Personal amb accés al mòdul |
| Completar una substitució pròpia | Docent assignat |
| Material Infantil i configuració departamental | Coordinació, Direcció, Titularitat o delegació explícita `pot_gestionar_material` |
| Convidat | Lectura dels mòduls autoritzats; una delegació d’Infantil és una excepció explícita |

Una llista de visibilitat buida tanca el mòdul. Coordinació conserva l’accés administratiu; la delegació explícita d’Infantil conserva la seva excepció. La configuració departamental no dona accés a usuaris ni a visibilitat. Els motius d’absència són visibles al sol·licitant i als responsables; el camp «Tasques a realitzar» es copia a la cobertura perquè el substitut pugui treballar.

## Assaig i desplegament

1. Obtenir una còpia de seguretat de la instal·lació actual i comprovar que es pot restaurar en un entorn separat. Conservar els identificadors i els permisos anteriors. No utilitzar dades reals en la prova visual local.
2. Assajar sobre aquesta còpia. Executar `supabase/preflight.sql` i resoldre els errors i les files que retorna. Revisar també dates i franges històriques, solapaments, préstecs oberts del mateix dispositiu i assignacions de stock. El preflight és una ajuda, no substitueix la conciliació.
3. Configurar la integració Firebase com a Third-party Auth de Supabase per al projecte Firebase correcte. Els usuaris han de tenir el claim tècnic `role: authenticated`; el càrrec escolar continua a `public.usuaris`. Assignar el claim amb Firebase Admin en un entorn segur, preservant els altres claims, i renovar la sessió dels usuaris. Seguir la [documentació oficial de la integració](https://supabase.com/docs/guides/auth/third-party/firebase-auth).
4. Comprovar que ja existeix un coordinador intern a `usuaris`. No hi ha autoalta de primer administrador. Les altes següents les fa Coordinació.
5. En una base existent, aplicar **només les migracions** `202609130001` a `202609130007`, una vegada i en ordre. `schema.sql` és exclusivament el punt de partida d’una base nova; després també s’hi apliquen les migracions. Registrar les versions aplicades amb el mecanisme de migracions de l’entorn. Cada fitxer és transaccional.
6. La migració 004 assigna als horaris antics el curs derivat de la data d’execució i vigència setembre–agost. Si hi ha dades d’un altre curs, adaptar aquest backfill durant l’assaig abans de producció. El criteri inicial de cobertura és Lectiva, Pati o Guàrdia; revisar-lo amb els responsables. Les absències ja revisades no generen cobertura retroactiva.
7. Verificar permisos amb comptes separats de cada rol, incloses peticions directes a la API, sessions sense claim, correus externs i la visibilitat buida. Provar solapaments, devolucions repetides, aprovació i reassignació de substituts. PGlite valida PostgreSQL local; no valida la verificació de signatures de Supabase ni múltiples connexions del servidor remot.
8. Configurar i provar l’enviador en l’entorn separat. Publicar el frontend només quan la base i la identitat hagin passat les proves. El workflow de `main` publica a GitHub Pages després de lint, tests i build; preparar la base abans d’integrar aquests canvis a `main`.

No s’han executat migracions, canviat permisos remots, concedit delegacions de Google ni enviat correus durant aquest treball.

## Avisos

Les operacions registren l’avís en la mateixa transacció. La cua conserva estat, intents i error; Inici mostra avisos propis i Coordinació veu tota la cua. «Programat» no significa «lliurat». Els camps antics `notificat=true` es mantenen com a històric; `queued` remet al seguiment de la cua. Els avisos antics perduts no es poden reconstruir automàticament amb garanties.

Desplegar `supabase/functions/send-notifications` de manera separada. Requereix un compte de servei de Google Workspace amb delegació autoritzada per l’administrador per a l’àmbit `gmail.send`, i un remitent del centre. La delegació és una configuració pendent; no s’ha concedit automàticament.

Secrets del servidor:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: credencial del compte de servei autoritzat.
- `GOOGLE_SEND_AS`: correu del remitent delegat.
- `NOTIFICATION_SCHEDULER_SECRET`: secret llarg exclusiu del planificador.
- `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY`: credencials del servei, mai variables `VITE_*`.

La funció comprova `x-scheduler-secret` i només accepta POST. Configurar `verify_jwt=false` **només per aquesta funció** perquè el planificador utilitza aquest secret; els endpoints de dades mantenen JWT i RLS. Programar-ne la invocació, per exemple cada minut, amb el secret desat al gestor de secrets del planificador. Monitorar respostes 503 i antiguitat de la cua: si fallen les credencials abans de reclamar el lot, els missatges continuen pendents.

Cada lot reclama fins a 10 avisos amb un lease de cinc minuts. Hi ha cinc intents amb espera creixent; les reclamacions antigues no poden confirmar-ne de noves. Si s’esgoten els intents, un responsable pot reintentar des d’Inici. L’enviament és *com a mínim una vegada*: si Gmail accepta el correu però es perd la resposta, un reintent pot duplicar-lo. El Message-ID és estable, però no garanteix deduplicació de Gmail. Comprovar el correu enviat abans de reintentar un enviament interromput.

## Horaris i cobertura

Els horaris tenen curs i dates de vigència. Es rebutgen solapaments del mateix docent encara que siguin d’etapes diferents. La graella conserva visibles les franges guardades encara que canviïn les opcions de configuració.

En comunicar una absència, el servidor comprova titular, dia i vigència, suma minuts dels períodes seleccionats i desa una fotografia. Els canvis posteriors d’horari no alteren la petició. L’aprovació i la creació de cobertura són atòmiques i es poden reintentar sense duplicats. Una absència aprovada també desassigna cobertures pendents incompatibles que tenia aquell docent. El mode manual permet absències parcials i requereix crear la cobertura manualment quan calgui.

Una cobertura rebutja docents amb classe, pati, altra substitució o absència aprovada en la mateixa franja. Si una altra persona ha canviat l’assignació des que s’obrí el detall, cal actualitzar-lo. Una absència amb períodes referenciats per cobertura no es pot eliminar mentre existeixen aquestes referències; és una protecció d’integritat, no una paperera.

## Material Infantil i històric

Demanat/Rebut congelen quantitat, preu, cost i dades de material/proveïdor. Cancel·lat deixa de consumir l’assignació d’estoc i permet preparar una línia nova; una comanda confirmada i cancel·lada no es reobre. Les exportacions exclouen cancel·lats i rebuts. La recepció física continua conciliant-se amb el recompte i les entrades del catàleg, no es presumeix automàticament a partir d’un canvi d’estat.

Les comandes prèvies a la migració no tenen fotografia fiable: es mostren com a estimacions amb l’avís corresponent. No s’inventen preus històrics. Les baixes queden registrades a `audit_events` amb autor i valors anteriors, accessibles a Coordinació. El registre d’auditoria no equival a una còpia de seguretat ni implementa restauració des de la interfície. Definir i comprovar còpies, retenció i recuperació amb els responsables del centre.

## Comprovacions i límits

`npm run lint`, `npm test` i `npm run build` són els controls locals i de CI. La suite cobreix RLS, transaccions, integritat, snapshots, cua, paginació i migració de l’esquema de `main`. La prova visual s’ha fet amb dades fictícies en escriptori i mòbil; no és una prova d’autenticació ni d’enviament real.

La lectura paginada ordena de manera estable i detecta respostes incompletes i canvis de sessió. Diverses pàgines no són una fotografia transaccional: si hi ha moltes escriptures simultànies, actualitzar la vista. Les operacions que alteren estoc, aprovacions o cobertura sí que utilitzen transaccions i bloquejos al servidor.

## Recuperació

Si una migració falla, aturar el desplegament i conservar el missatge; corregir i repetir només la migració que s’ha revertit. Si falla el frontend amb la base ja migrada, mantenir RLS i reparar el client compatible. Tornar al frontend antic no restaura compatibilitat: fa servir accés anònim. No reobrir polítiques anònimes per recuperar servei. Una restauració de base exigeix la còpia verificada i conciliació de les operacions posteriors.

Les propostes i documents comercials antics són documents històrics: les afirmacions sobre Firebase Hosting, permisos, historial o disponibilitat s’han de contrastar amb aquesta guia i amb el servei real abans de reutilitzar-les.
