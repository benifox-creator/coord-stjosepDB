# Base de Coneixement — redisseny

> El mòdul existeix des de fa setmanes i té **zero articles a producció**. Aquest document no hi afegeix potència: en canvia el propòsit —passa a ser el lloc on el claustre busca respostes— i treu els dos motius pels quals una base de coneixement es queda buida.

## 1. El diagnòstic

El mòdul ja té cercador, etiquetes, categories configurables, enllaços i esborranys. **Res del que falta és una funció.** Està buit per dues raons:

1. **Escriure costa.** El contingut és un camp de text pla que es pinta com un paràgraf: un «com es fa X» hi surt com un mur de text, sense passos, sense negretes i sense una sola captura.
2. **Només hi pot escriure una persona.** `app_private.admin()` és exactament `rol = 'coordinador'`. Una base de coneixement d'un sol autor es queda a mitges sempre, i no per desgana: per aritmètica.

El redisseny ataca les dues.

## 2. Qui hi escriu

**El claustre només llegeix.** Decidit el 2026-09-24: qui consulta no pregunta des d'aquí. Preguntar obriria un compromís de resposta que ningú no ha assumit, i una pregunta sense resposta a la vista és pitjor que no tenir-la.

**Redactar s'obre per persona, no per rol.** Una casella nova a la fitxa de cada usuari, `pot_redactar_coneixement`, com la de `pot_gestionar_excursions` que ja hi ha. Es tria així i no per rol perquè qui sap explicar una cosa no coincideix amb cap organigrama.

**Publicar continua sent només del coordinador.** Els redactors deixen esborranys; publicar-los és un acte a part. És el mateix patró que les excursions, que es proposen i s'aproven.

### La trampa, que en aquest mòdul ja ha costat dos forats

> **Les polítiques de PostgreSQL són per fila, no per columna.** Si un redactor pot fer `update` sobre l'article, **pot posar-hi `publicat = true` ell mateix**, i la regla de sobre no val res. I si pot fer `insert` sobre la taula, pot crear-lo ja publicat: un privilegi d'`insert` per taula cobreix **totes** les columnes. Això últim és literalment el forat que la revisió final del control de pagaments va trobar el 2026-09-23.

Per tant, i **les dues sentències, no una**:

```sql
revoke insert, update on public.coneixement from authenticated;
grant insert (titol, tipus, categoria, contingut, tags, links, caduca_el) on public.coneixement to authenticated;
grant update (titol, tipus, categoria, contingut, tags, links, caduca_el) on public.coneixement to authenticated;
```

`publicat` no surt a cap de les dues llistes. S'escriu **només** des d'una funció `security definer`, `public.publica_article(p_id uuid, p_publicat boolean)`, que comprova `app_private.admin()`. `autor`, `codi`, `creat_el` i `actualitzat_el` tampoc no són escrivibles des del client: els posa la base de dades.

La comprovació de desplegament ha de mirar **les dues meitats** i que el privilegi de taula hagi desaparegut, no només una.

### Qui veu què

- **Publicats:** tothom qui vegi el mòdul.
- **Esborranys:** el coordinador i qui tingui la casella de redactar. Són un grup petit i de confiança; distingir «els meus esborranys» dels altres afegiria maquinària per a un problema que no existeix.

## 3. Els quatre tipus

Una columna `tipus`, perquè el que hi va a dins **no és tot la mateixa cosa** i barrejar-ho és com moren aquestes bases:

| Tipus | Què és | Com es veu |
|---|---|---|
| `pregunta` | El títol és la pregunta; la resposta, un paràgraf | Llista desplegable. Vint preguntes en targetes no es llegeixen; en llista, sí |
| `procediment` | El «com es fa X» | Targeta, amb passos, negretes i captures. És el que més es consultarà |
| `document` | Normativa i protocols | Poc text, i el fitxer o l'enllaç ben visible |
| `avis` | Novetats | **Amb data de caducitat obligatòria** |

### Per què els avisos caduquen per força

Un avís del gener continua al mig de la llista al juny, algú s'hi fia, i a partir d'aquell dia la base no es torna a consultar. **La data de caducitat és obligatòria per a `avis` i no existeix per als altres tres tipus.** Passada, l'avís surt de la llista principal i va a un històric consultable: no s'esborra —va passar i de vegades cal recordar quan—, però deixa d'ocupar el lloc de les coses que sí que valen avui.

## 4. El contingut: Markdown, i sense HTML enlloc

El contingut passa a ser **Markdown**, escrit en un camp de text amb previsualització al costat. No un editor ric: és una dependència gran amb la seva pròpia superfície de seguretat, i el camp ja és text pla, així que no hi ha res a migrar.

**El Markdown es converteix en elements de React, mai en HTML.** No hi ha cap `dangerouslySetInnerHTML` a tota l'aplicació avui, i aquesta peça no en portarà el primer. Amb això la injecció de codi **no està filtrada: no és possible**, perquè no hi ha cap camí que passi per HTML. Val la pena encara que avui només hi escriguin tres persones, perquè «només hi escriuen tres persones» és exactament la mena de supòsit que canvia.

**El subconjunt que s'entén**, i res més: títols (`##`, `###`), negreta, cursiva, llistes, llistes numerades, enllaços, cites, codi en línia i imatges. El que no encaixi surt com el text que és.

**Es parteix en dues peces**, perquè Vitest corre sense DOM:

- `src/modules/coneixement/markdown.ts` — l'analitzador: de text a un arbre de nodes. **Mòdul pur, i és on van les proves.** Mateix patró que `preu.ts` o `balanc.ts`.
- El component que recorre l'arbre i el pinta, que és una capa fina sense decisions.

## 5. Imatges i fitxers

Un bucket de Supabase Storage, `coneixement`, i **privat**. Un bucket públic vol dir que qualsevol amb l'adreça llegeix el fitxer des d'internet sense entrar a l'aplicació, i aquí hi van protocols del centre i captures de pantalles internes. Es serveixen amb enllaços signats que caduquen.

- **Llegir:** qui vegi el mòdul.
- **Pujar i esborrar:** qui pot redactar.
- **Només imatges i PDF**, amb un màxim per fitxer. Sense el màxim, el primer vídeo de 40 MB es menja ell sol el gigabyte del pla gratuït. Amb captures normals hi caben milers.
- **En esborrar un article s'esborren els seus fitxers.** Si no, el bucket s'omple de coses que ningú no pot veure ni trobar i que continuen ocupant.

> **La data de caducitat es desa com a `date`**, no com a text. Les columnes `creat_el` i `actualitzat_el` d'aquesta taula són `text` —ve de la migració del full de càlcul— i per això qualsevol comparació de dates amb elles és comparació de cadenes. La columna nova no ha d'heretar aquell error: si `caduca_el` fos text, «ha caducat?» deixaria de ser una pregunta que la base de dades sap respondre.

> Les polítiques de Storage també són d'abast, no de bona fe: s'han de lligar al `bucket_id` i al rol. Una política que deixi escriure «a qualsevol lloc del bucket a qualsevol autenticat» és el mateix forat de sempre amb un altre vestit.

**Els enllaços de Drive es queden.** El camp `links` ja existeix. Per a un PDF que ja viu allà i el manté una altra persona, enllaçar-lo és millor que duplicar-lo: duplicar-lo és garantir que un dia les dues còpies diran coses diferents.

## 6. Trobar les coses

- **El cercador mira també dins el contingut.** Avui només mira títol i etiquetes, que és justament el que no recordes quan busques.
- **Filtre per tipus**, i les categories segueixen sortint de Configuració (`coneixement.categories`), que ja hi són i eviten que es creïn categories amb faltes.

### Però les categories d'avui són d'un altre mòdul

Les que hi ha configurades són **Procediments, Infraestructura, Dispositius, Incidències freqüents i Administratiu**. Són les d'una base de coneixement **de TIC**, que és per al que es va construir això. Si passa a ser el lloc on el claustre busca respostes, «qui obre el gimnàs els dimarts» no és cap de les cinc.

No les decideix aquest document: són configurables i les posa el centre. El que sí que diu és que **s'han de repensar abans d'obrir-ho al claustre**, perquè una llista de categories que no encaixa fa que tot acabi a «Administratiu» i que el filtre no serveixi de res.

### I llavors el mòdul canvia de lloc al menú

Hi ha una reordenació del menú lateral acordada i pendent que posava **Base Coneixement a «Gestió TIC»**, al costat de Manteniment i Pla d'Acció. Amb aquest redisseny això deixa de tenir sentit: si és on el claustre consulta, va a **«Dia a dia»**. És un detall d'aquella feina, no d'aquesta, però s'ha de recordar quan es faci.
- **L'entrada no és una graella buida:** els avisos vigents a dalt, les preguntes en llista, els procediments en targetes i els documents a part.
- **Res de «el més consultat».** Necessitaria dades d'ús que no tenim, i inventar-se un ordre és pitjor que no tenir-ne.

## 7. Què no entra

Que el claustre pregunti o comenti; historial de versions; permisos per article; cerca de text complet a PostgreSQL (amb uns quants centenars d'articles, filtrar al client hi arriba de sobres); i traduir res.

## 8. Què cal recordar en desplegar

Aquesta peça sí que porta migració, i toca tres coses que ja han donat problemes:

1. **Els privilegis per columna**, amb les dues sentències, i comprovar-los totes dues.
2. **El bucket privat.** Comprovar que ho és de debò, no que ho digui la configuració.
3. **La casella nova** a `usuaris`, que ha d'aparèixer a la pantalla de gestió d'usuaris com les altres.
