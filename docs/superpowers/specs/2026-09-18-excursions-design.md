# Excursions — disseny

> Substitueix l'Excel `Excursió Curs.xlsm` amb què es gestionen avui les sortides del centre. Aquest document cobreix **la primera entrega**; la resta de peces queden llistades al final.

## 1. El problema

Les excursions es planifiquen **totes a principi de curs**: cada nivell decideix les seves i després cadascuna s'activa unes setmanes abans. Avui el circuit és un Excel de 12 fulls i 4.300 fórmules, més una macro que obre Word.

El que falla, segons qui ho pateix:

1. **Ningú sap en quin estat està** una excursió i cal anar preguntant.
2. **Arriben propostes incompletes** i s'ha d'empaitar el professorat.
3. **Tot va dispers**: correus, missatges i converses de passadís.

No hi ha problema de xocs de dates entre grups, així que **no es construeix detecció de conflictes**.

A més, el coordinador TIC és avui el coll d'ampolla: recull, calcula i genera les circulars. Amb aquest mòdul deixa de ser-ho.

### Errors verificats de l'Excel actual

| Error | S'ha donat? |
|---|---|
| La macro porta el curs escrit a mà a la ruta (`Curso 2022-2023`) | Sí, cada setembre |
| Amb 3 autocars el preu surt **en blanc** (només parteix pel primer `+`) | Mai |
| Llindar "per alumne o total" de 50 € en una fulla i de 20 € en una altra | Mai (0 de 45) |
| La circular diu "DIMARTS" i "Dimecres" per a la mateixa data | El dia només és correcte en **12 de 48** excursions; en **4 cau en diumenge** |
| La data es construeix amb `ANY(AVUI())` | Una circular feta al desembre per al gener surt amb l'any anterior |
| 4 dels 10 marcadors de la plantilla estan partits dins l'XML | Funciona només perquè la macro fa servir el cercador de Word |
| "L'AMPA col·labora" surt sempre, fins i tot amb aportació 0 | Sí |

## 2. Abast

**Entra:** pla del curs, proposta amb camps obligatoris i esborrany, copiar del curs anterior, aprovació, **petició de pressupost als autocars**, dades de reserva, càlcul del preu, circular en Word, estats i avisos per correu, i els permisos de gestió.

**No entra** (cada cosa amb la seva entrega): control de pagaments per número de llista, bestretes i tancament econòmic, informes del curs, i que els acompanyants generin les seves substitucions.

### Es construeix en dues fases

L'abast d'aquest document és massa gran per a un sol pla d'implementació, i la primera meitat ja té valor per ella mateixa:

- **Fase A — el circuit.** Pla del curs, proposta amb camps obligatoris, copiar del curs anterior, aprovació, estats i avisos. **No toca diners.** Amb això sols ja queden resolts els tres problemes de l'apartat 1, i l'Excel continua fent els números mentrestant.
- **Fase B — els diners i la circular.** Petició de pressupost, costos, càlcul del preu, congelació i generació del `.docx`. És el que jubila l'Excel del tot.

Cada fase té el seu pla i es desplega per separat.

## 3. Rols i permisos

Es reutilitza el patró que ja existeix per a Material Infantil (`pot_gestionar_material` + `app_private.infantil_manager()`).

Calen **dos camps nous**, perquè un de sol no distingiria Secretaria d'un docent a qui s'activi la gestió:

- `usuaris.pot_gestionar_excursions boolean not null default false` — logística.
- `usuaris.pot_gestionar_costos_excursions boolean not null default false` — diners.

- `app_private.excursions_costos()` → `rol in ('coordinador','direccio','titular') or pot_gestionar_costos_excursions`.
- `app_private.excursions_gestio()` → `excursions_costos() or pot_gestionar_excursions`.

| Qui | Pot fer |
|---|---|
| Tot el professorat (`creator()`) | **Veure tot el pla** i crear i editar les **seves** propostes |
| Aprovadors (`approver()`: coordinador, direcció, titular) | Aprovar i rebutjar |
| Gestió (`excursions_gestio()`) | Marcar reservada, demanar pressupostos, enviar la circular, cancel·lar |
| Costos (`excursions_costos()`) | Veure i editar **costos i preu**, i importar pressupostos |

La transparència és deliberada: que tothom vegi l'estat de totes les excursions és la solució al problema 1.

**Secretaria** té els dos permisos: reserva, negocia amb les empreses d'autocars i entra els costos. **Un docent a qui s'activi la gestió** té només el primer: ajuda a organitzar però **no veu diners**.

> El resum econòmic del curs i els resultats (peça futura) es decidirà a part; per defecte es quedaran amb coordinació, direcció i titularitat.

## 4. Model de dades

### `public.excursions` — dades públiques del mòdul

`id`, `codi` (`EXC-0001`, amb `public.format_code`), `curs_escolar`, `estat`, `etapa`,
`lloc`, `poblacio`, `activitat`, `data` (**date completa, amb any**), `hora_sortida`, `hora_tornada`,
`transport` (`autocar` | `altres`) i `transport_detall` (text lliure: metro, tren, FGC, a peu…),
`acompanyants_externs`, `observacions`, `nota_circular`,
`responsable` (qui mana el dia de la sortida; per defecte qui la proposa),
`proposada_per`, `proposada_el`, `aprovada_per`, `aprovada_el`, `motiu_rebuig`,
`reservada_per`, `reservada_el`,
`preu_alumne` (**el preu congelat; públic perquè surt a la circular**), `preu_confirmat_per`, `preu_confirmat_el`,
`data_circular`, `data_limit_pagament`, `data_limit_resguard`, `circular_enviada_per`, `circular_enviada_el`,
`creat_el`, `creat_per`.

**Sobre el transport:** fins ara tot el que no era autocar s'apuntava com a "Metro", inclosos tren, FGC i anar a peu. El que li importa a l'aplicació és només **si es lloga autocar o no**, perquè és l'únic que té cost; el detall va a text lliure i surt a la circular.

**Sortides de més d'un dia:** avui no n'hi ha, però es preveu que n'hi pugui haver (colònies amb nit, viatge de final de curs). **No es construeix ara**, i per això hi ha una sola `data`. El dia que calgui, el que s'haurà de tocar és: afegir `data_fi`, la frase de dates de la circular ("del 3 al 5 de juny") i decidir si el preu es calcula per nit. Queda dit perquè no sorprengui.

### `public.excursio_grups`

`excursio_id`, `grup` (de `substitucions.grups`), `alumnes_previstos`, `alumnes_finals` (pot ser buit).

Es separa des d'ara perquè **el control de pagaments per número de llista penjarà d'aquí**, i així no caldrà migrar-ho després.

**Previstos i finals** perquè entre el setembre i la sortida el nombre canvia. L'Excel ja ho tenia (`N Al` i `Alum.F`) i en la primera versió d'aquest document se'm va escapar. El preu es calcula amb els previstos; els finals serveixen per al control d'aforo i, més endavant, per al tancament.

**Els alumnes s'escriuen a mà i no es guarden per grup a Configuració.** Al setembre les llistes encara no estan tancades i qui proposa ja sap quants en té; pre-omplir-ho amb un número desat seria donar per bo un valor que encara no existeix.

### `public.excursio_acompanyants`

`excursio_id`, `email` (ha d'existir a `usuaris`). Els externs es compten a `acompanyants_externs`.

**No són obligatoris per proposar.** Al setembre sovint encara no se sap qui anirà, i exigir-ho seria fricció en el pitjor moment: s'omplen quan es sàpiga.

### `public.excursio_finances` — **accés restringit**

`excursio_id` (PK), `preu_activitat`, `preu_activitat_tipus` (`per_alumne` | `total`),
`ampa_import`, `ampa_cobreix_activitat boolean`, `cost_acompanyants`,
`previsio_usada`, `marge_pct_usat`, `iva_pct_usat`.

### `public.excursio_autocars` — **accés restringit**

`excursio_id`, `places`, `preu` (sense IVA). **Una fila per autocar**: s'acaba el text `406+406` i el seu error amb tres autocars.

> **Per què taules separades i no columnes amagades:** les polítiques de PostgreSQL són per fila, no per columna, i tothom entra amb el mateix tipus de sessió. Amagar els costos només a la pantalla els deixaria a l'abast de qualsevol que demanés les dades directament a l'API. Amb taules separades, el servidor senzillament no els envia.

Els paràmetres usats (`previsio_usada`, `marge_pct_usat`, `iva_pct_usat`) es desen en confirmar el preu perquè **el càlcul sigui reproduïble** encara que després es canviï la configuració.

## 5. Estats

```
esborrany ──enviar──▶ proposada ──aprovar──▶ aprovada ──reservar──▶ reservada ──▶ circular enviada
    ▲                            │
    └────── rebutjar (amb motiu) ┘

qualsevol estat ──▶ cancel·lada
```

**No hi ha estat "rebutjada" ni acció de "retirar".** Rebutjar desa el motiu i torna la proposta a esborrany, que és on el tutor l'ha de corregir igualment; i si s'equivoca abans que ningú la miri, Direcció la rebutja. Eren un estat i una transició de més per a una cosa que passa dues vegades l'any.

**Demanar pressupost no és un estat**, és una dada: una excursió aprovada surt a la llista de "pendents de pressupost" mentre no tingui costos. Així els costos poden arribar abans o després de reservar, com passa de veritat.

Es pot cancel·lar **també després d'haver enviat la circular**: és el cas més real de tots (mal temps, el proveïdor falla) i el més delicat, perquè ja s'han demanat diners a les famílies. En aquesta entrega la cancel·lació registra el motiu i avisa qui la va proposar i els acompanyants; **la devolució dels diners queda per a la peça de tancament econòmic**, i la fitxa ho ha de dir clarament en lloc de fer veure que està resolt.

- D'`esborrany` a `proposada` **es validen els camps obligatoris**: data, lloc, activitat, etapa, almenys un grup amb alumnes previstos, hores i transport. Això resol el problema 2. Els acompanyants no hi entren.
- **Es comprova que la data sigui lectiva** contra `centre.dies-no-lectius` i els caps de setmana. Avui aquesta llista només es fa servir per moure el termini de pagament, i no per avisar que la sortida mateixa cau en festiu.
- Per passar a `circular enviada` cal que el preu estigui confirmat.
- Els canvis d'estat van per funcions del servidor (`security definer`) que comproven permís i que la transició sigui vàlida, com ja fan les absències: `proposar_excursio`, `resoldre_excursio`, `marcar_reservada`, `confirmar_preu`, `enviar_circular`, `cancellar_excursio`. L'edició d'esborranys va per CRUD normal sota RLS.

### Avisos per correu

Amb la cua de notificacions que ja existeix (`app_private.enqueue`), però **amb compte**: com que el pla es fa tot en una setmana de setembre, un avís per cada proposta serien unes 50 notificacions als aprovadors en pocs dies. **La gent aprendria a ignorar-les i l'avís deixaria de servir.**

| Fet | Qui rep l'avís | Com |
|---|---|---|
| Propostes noves | Aprovadors | **Un resum diari** ("tens 12 propostes pendents"), no un correu per proposta |
| La teva excursió aprovada o rebutjada | Qui la va proposar | Individual |
| Circular enviada | Qui la va proposar i els acompanyants | Individual |
| Excursió cancel·lada | Qui la va proposar i els acompanyants | Individual |

Els individuals afecten una persona concreta i són accionables; els massius van al resum. I al pla del curs hi ha **aprovació en bloc**, per no haver de clicar cinquanta vegades al setembre.

## 6. Càlcul del preu

```
esperats      = alumnes × previsió[etapa]
costos fixos  = Σ autocars × (1 + IVA) + activitat (si és total) + cost acompanyants
cost alumne   = costos fixos ÷ esperats + activitat (si és per alumne)
base          = cost alumne − aportació AMPA per alumne
preu          = base × (1 + marge%)
preu final    = arrodoniment cap amunt al pas configurat
```

- Si `ampa_cobreix_activitat`, la part d'activitat val 0 i no es resta res més.
- L'aportació de l'AMPA **subvenciona l'excursió sencera**: si supera el preu de l'activitat, l'excés rebaixa la part de l'autocar.
- El preu **mai és negatiu**.
- El marge s'aplica sempre. (A l'Excel no s'aplicava si s'anava en metro; amb un marge percentual això deixa de caler, perquè ja escala sol.)

### Valors per defecte

| Paràmetre | Valor |
|---|---|
| Previsió d'assistència | 0,80 a EI i EP · 0,75 a la resta |
| Marge | **12 %** |
| IVA del transport | 10 % |
| Arrodoniment | 0,50 € cap amunt |
| Dies abans per a la circular | 15 |
| Dies abans per al termini de pagament | 8 |

Tots configurables. El marge és per etapa.

### Per què el 12 %

Simulació sobre **31 excursions reals** del curs 2022-23 (apartades 4 amb dades mal registrades), suposant que paga la previsió:

| Mètode | Per sota de cost | Global | Quartils |
|---|---|---|---|
| Actual (Excel) | 2 de 31 | +23,5 % | 5 % · 11 % · 24 % |
| Nou, marge 0 % | 12 de 31 | +14,9 % | −4 % · 3 % · 17 % |
| Nou, marge 8 % | 1 de 31 | +20,5 % | 3 % · 8 % · 21 % |
| **Nou, marge 12 %** | **1 de 31** | **+23,1 %** | 6 % · 11 % · 24 % |

Amb el 12 %, les famílies paguen pràcticament el mateix que avui i queda una excursió menys per sota de cost. **El mètode actual no estava trencat**: el que aporta el nou és fer explícit el que era implícit i incloure el cost dels acompanyants, que abans no es repercutia.

### Dates de la circular

- `data_circular` = data − 15 dies.
- `data_limit_pagament` = data − 8 dies, i **si cau en cap de setmana o en un dia de `centre.dies-no-lectius`, es mou al dia lectiu anterior**. Amb la regla actual, 4 de 48 terminis queien en diumenge.
- Totes dues es desen en confirmar el preu i Gestió les pot ajustar a mà.

## 7. Petició de pressupost als autocars

Entre aprovar una sortida i conèixer-ne el cost hi ha un pas que la primera versió d'aquest document es va saltar: **demanar pressupost a les empreses d'autocars i comparar**. Com que el pla es fa tot al setembre, el natural és enviar **la llista del curs sencer** i rebre una taula de preus; per això els costos arriben tard, i no per deixadesa.

També es demana preu de **l'activitat**, perquè per volum de vegades fan preu especial. Així que en exportar es tria **què s'està demanant**: autocar, activitat o totes dues coses; d'això depenen les columnes de preu que surten. No té sentit enviar a una empresa d'autocars un full amb una columna d'entrades.

**Anada.** Al pla del curs es filtra per "pendents de pressupost", se'n seleccionen i es genera un **Excel** amb una fila per sortida: codi, data, dia de la setmana, destinació, població, grups, **passatgers (alumnes previstos + acompanyants)**, hora de sortida, hora de tornada i la **columna o columnes de preu, buides**.

**Tornada.** L'empresa retorna el mateix fitxer amb els preus i **es torna a importar**: cada fila s'identifica pel codi `EXC-0001` de la primera columna i els preus entren com a autocars de l'excursió. Es reaprofita el patró d'importació que ja es fa servir dues vegades (Material Infantil i Usuaris): previsualització fila a fila i res no s'escriu fins que es confirma.

**Qui:** **exportar** és de Gestió (`excursions_gestio()`), perquè el fitxer no conté cap preu. **Importar** és de Costos (`excursions_costos()`), perquè sí que en porta.

**L'empresa** es tria d'una llista editable a Configuració (`excursions.empreses-autocar`), com els espais de Reserves. Avui només se'n fa servir una, però canviar-la o demanar a dues ha de ser possible sense tocar codi. No cal una taula de proveïdors com la de Material Infantil: amb una llista n'hi ha prou.

> El fitxer que surt del centre porta dates, destinacions i nombre d'alumnes per grup. **No porta cap nom d'alumne ni de docent**, i així ha de continuar.

## 8. La circular

**Es genera per codi**, no omplint una plantilla. El disseny és el del boceto validat el 2026-09-17 (`Circular excursió - boceto.docx`, amb el generador a `Circular excursió - generador.js`).

Motiu: una plantilla editable és una plantilla que es pot trencar —a l'actual ja hi ha 4 marcadors partits sense que ningú se n'adonés— i qui l'hauria d'arreglar seria sempre la mateixa persona. El disseny d'aquesta circular no ha canviat en anys; el que canvia és el text.

**Textos configurables:** introducció al pagament, passos del pagament (llista), frase de l'AMPA, política de devolucions, frase del resguard. Més una **nota lliure per excursió**.

**Regles de contingut:** el dia de la setmana es calcula de la data real; la frase de l'AMPA només surt si hi ha aportació; l'any surt sempre del camp `data`.

**Les tres dates es poden triar.** Es proposen soles (circular 15 dies abans; termini de pagament 8 dies abans, mogut fora de caps de setmana i dies no lectius; resguard l'endemà del termini) i **Gestió les pot canviar una a una**. La plantilla actual feia servir la mateixa data per al pagament i per al resguard, anomenant-la "dimarts" en un lloc i "dimecres" en un altre.

**La devolució del 75 %** és per a qui avisa a última hora que no ve. El text per defecte ho dirà així en comptes de lligar-ho als pagaments fora de termini, que és el que deia fins ara i no s'entenia:

> *Si un alumne no assisteix i s'avisa fora de termini, es retornarà el 75 % de l'import; el 25 % restant cobreix despeses ja compromeses.*

És text configurable: si la intenció era una altra, es canvia sense tocar codi.

**El pagament continua sent** amb codi de barres al caixer, i alguna família encara paga en efectiu. Un mètode de pagament en línia és una possibilitat de futur, no d'aquesta entrega.

En enviar-la: es congela el preu, es genera el `.docx` editable, es descarrega, l'excursió passa a *circular enviada* i s'avisa per correu. Secretaria la retoca i l'envia.

## 9. Pantalles

1. **Pla del curs** (principal). Una fila per excursió amb l'estat ben visible i, a dalt, un resum del que reclama atenció ("3 pendents d'aprovar · 2 circulars per enviar aquesta setmana"). Filtres per etapa, mes i estat. (A la primera versió hi deia "trimestre", però **el concepte de trimestre no existeix enlloc de l'aplicació**: caldria definir-lo a Configuració i no compensa.)

Accions en bloc sobre les seleccionades: **aprovar**, i **exportar per a pressupost**.

**Copiar del curs anterior no és un botó secundari: és la porta d'entrada del setembre.** Si el pla es fa tot de cop i les sortides es repeteixen, el primer que ha de veure qui obre el mòdul al setembre és **el pla de l'any passat per revisar-lo**, amb caselles per triar què es repeteix, i no una pantalla buida amb un botó de "nova excursió".
2. **Fitxa de l'excursió**. Dades, grups i alumnes, acompanyants, circular i historial. **El bloc econòmic només apareix per a Finances** — i no s'amaga a la pantalla: el servidor no l'envia.
3. **Formulari de proposta**. Només el que un tutor sap: data, lloc, activitat, grups, alumnes, acompanyants, hores i observacions. **Cap camp de diners.** Es desa com a esborrany i, en enviar, avisa del que falta.
4. **Configuració → Excursions**. Els paràmetres i els textos.

## 10. Claus de configuració

`excursions.previsio.<ETAPA>` · `excursions.marge-pct.<ETAPA>` · `excursions.iva-pct` ·
`excursions.arrodoniment` · `excursions.dies-abans-circular` · `excursions.dies-abans-termini` ·
`excursions.empreses-autocar` ·
`excursions.text-pagament-intro` · `excursions.passos-pagament` · `excursions.text-ampa` ·
`excursions.text-devolucions` · `excursions.text-resguard` · `visibilitat.excursions`

## 11. Proves

- **Les 43 excursions reals de l'Excel són els tests del càlcul.** La part `base` (cost per alumne abans del marge) ja s'ha verificat contra els valors que va calcular l'Excel: **coincideix al cèntim en 43 de 43**. El marge i l'arrodoniment tenen proves pròpies.
- Regles de dates: dia de la setmana correcte, termini mogut fora del cap de setmana i dels dies no lectius, i el cas de canvi d'any.
- RLS a `tests/database.test.ts`: un tutor i un docent amb **només** `pot_gestionar_excursions` no poden llegir `excursio_finances` ni `excursio_autocars`; un compte amb `pot_gestionar_costos_excursions` (Secretaria) i Direcció sí. Transicions invàlides rebutjades. No es pot reservar sense aprovar ni enviar circular sense preu confirmat.
- Exportació i importació de pressupostos: el fitxer surt sense preus, torna amb preus, i cada fila es lliga pel codi. Una fila amb un codi desconegut es marca i no s'importa.
- Les taules noves s'afegeixen al disparador d'auditoria.

## 12. Per a més endavant

**Peces pendents:** control de pagaments — que ja té el seu disseny a `2026-09-22-pagaments-excursions-design.md`, i que **descarta el número de llista**: el que el centre vol saber és la xifra recaptada, no qui deu diners, i un recompte per grup ja la dona sense cap dada d'alumnat; bestretes i tancament econòmic (la vista que Direcció tenia a la fulla "JAV"); informes del curs (AMPA, autocars per trimestre, comparació amb el curs anterior); i que marcar els acompanyants generi les seves substitucions.

**Quan hi hagi dades de pagaments**, la previsió d'assistència es podrà **proposar a partir de l'històric real de cada nivell** en lloc d'un número fix. Aquell control haurà de permetre marcar com a pagat **sigui quin sigui el mètode**: encara hi ha famílies que paguen en efectiu al tutor.

**Altres possibilitats que el centre ja ha esmentat:** sortides de més d'un dia i un mètode de pagament en línia.

**Decisions ja preses** (2026-09-18), que abans eren preguntes obertes: el pagament continua sent amb codi de barres al caixer i alguna família en efectiu; les dates de la circular es podran triar una a una; la devolució del 75 % és per a qui avisa a última hora; i no hi haurà autorització retallable.

## 13. Nota de protecció de dades

**No hi ha autorització retallable ni es demanen alèrgies ni dades mèdiques**, confirmat amb el centre el 2026-09-18: avui la circular no en demana i no es vol començar a demanar-ne. Per tant **no entren dades de salut** a l'aplicació, i el que diu el dossier sobre protecció de dades es manté tal com està.

Aquesta entrega **no introdueix cap dada d'alumnat**: les excursions es gestionen per grup i per nombre d'alumnes. Quan arribi el control de pagaments, es farà **per número de llista i sense noms**. Això és **pseudonimització**, no anonimització: com que el centre té la llista a Alexia, continua sent dada personal, i així s'ha de descriure al dossier ("dades pseudonimitzades", no "sense dades d'alumnes").
