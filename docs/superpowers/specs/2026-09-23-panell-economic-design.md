# Panell econòmic de les sortides — disseny

> És la peça per la qual es va fer el control de pagaments (`2026-09-22-pagaments-excursions-design.md` §8) i la que l'spec d'excursions (§12) llistava com a pendent. Ara ja hi ha les tres xifres que calien: què costa, què s'ha decidit cobrar i què ha entrat.

## 1. Per a què serveix

Direcció vol saber tres coses, i les tres surten dels mateixos números:

1. **Com va el curs.** Quant s'ha gastat en sortides, quant ha entrat, i si el saldo cobreix.
2. **Quina sortida ha anat malament.** Per corregir el preu de la següent.
3. **Quant costa cada etapa.** Per repartir.

No és un mòdul nou: és una pantalla més dins d'Excursions.

## 2. El coixí, no el benefici

El preu porta un marge, així que una sortida on paga tothom acaba sobrant diners. **Això no és un benefici del centre: és el coixí que absorbeix els qui no hi van.** Decidit el 2026-09-23.

Conseqüències, i són de redacció tant com de càlcul:

- La xifra es diu **coixí**, mai «benefici» ni «guany».
- En verd quan cobreix, en vermell quan no. **Un coixí gran no es celebra**: no hi ha ni fletxes amunt ni percentatges de creixement.
- El que es vigila és quan **no** arriba, que és l'únic cas que demana fer res.

## 3. Què compta i què no

Una sortida de maig encara no té pagaments apuntats. Si entrés al total del curs, el panell diria que hi ha un forat que no existeix. Per això el curs es parteix en dos:

- **Fetes** — les que ja han passat. Diners reals. **D'aquí surt el coixí del curs**, que és la xifra gran.
- **Per venir** — les que queden. Hi surt què costaran i què hauria d'entrar, i quant se n'ha cobrat ja. **No toquen el coixí.**

El tall és la **data de la sortida** contra avui, no l'estat. Una sortida del novembre passat que segueix en estat `Aprovada` ja ha passat, i l'estat només diu que ningú no l'ha tocada des de llavors.

### Les cancel·lades no hi surten

Una sortida cancel·lada no ha costat res ni ha ingressat res. Si algun dia una cancel·lació deixa una penyora pagada a l'autocar, això serà una decisió conscient i tindrà la seva columna; avui el model no ho sap i fingir-ho seria pitjor que no dir-ho.

### Una sortida feta sense pagaments apuntats queda fora del coixí

Si el tutor no ha apuntat cap resguard, el recompte és zero, i comptar-la diria que s'hi ha perdut tot el cost. **Queda fora del total** i surt en un avís que la nomena amb la seva data: «1 sortida feta no té pagaments apuntats (Platja de Muro, 3 de març)». Així la xifra no menteix i el tutor té el recordatori.

El criteri és **zero pagaments a totes les files de grup**, no «menys pagaments que previsions»: apuntar-ne 18 de 22 és una dada bona i ha de comptar sencera.

**Una sortida feta sense preu confirmat queda fora pel mateix motiu**: té cost real i cap ingrés possible, i comptar-la diria que s'hi ha perdut tot quan el que passa és que ningú no li ha posat preu. Surt al mateix avís, amb el seu motiu. Per això el que es desa no és un sí/no sinó **quin dels dos motius** l'ha deixada fora.

## 4. Els números

Per sortida, amb els paràmetres que es van congelar en confirmar el preu (`previsio_usada`, `marge_pct_usat`, `iva_pct_usat`), no amb els de la configuració d'avui:

```
assistents   = Σ excursio_grups.alumnes_pagats
ha costat    = Σ autocars.preu × (1 + iva_pct_usat/100)
             + activitat                       (si preu_activitat_tipus = 'total')
             + activitat × assistents          (si és 'per_alumne')
             + cost_acompanyants
ha entrat    = assistents × preu_alumne
             + ampa_import × assistents        (si l'AMPA hi col·labora)
coixí        = ha entrat − ha costat
```

**Quan l'AMPA paga l'activitat sencera** (`ampa_cobreix_activitat`), l'activitat no compta ni com a cost ni com a ingrés: no passa pel compte del centre. És exactament el que ja fa `calculaPreu`, i les dues peces han de dir el mateix o una de les dues menteix.

**Els assistents són els qui han pagat.** En aquest centre o pagues o no hi vas (`2026-09-22-pagaments-excursions-design.md` §3), així que el recompte de resguards és el millor comptador d'assistència que hi ha. `alumnes_finals` existeix a la taula però **no l'escriu ningú** —zero files de tres a producció, i cap pantalla que hi entri—, i un panell que depengués d'una columna buida no ensenyaria res.

**Per a les que estan per venir**, on encara no hi ha assistents, els números es fan amb `alumnes_previstos × previsio_usada` i es diuen en futur: «costarà», «hauria d'entrar». Mai «ha costat».

### Els totals del curs

`ha entrat`, `ha costat` i `coixí` són sumes de les sortides fetes que compten. **`pendent de cobrar`** és, de les que queden, el que hauria d'entrar menys el que ja s'ha cobrat.

### Per etapa

Les etapes són les de la taula: `EI`, `EP`, `ESO 1r-2n`, `ESO 3r-4t`, `BATX`, `GM`. Tres mesures, amb un interruptor a sobre del gràfic:

- **Total gastat** — on van els diners. La més gran sempre serà la que té més alumnes; això no vol dir que sigui la més cara, i per això no va sola.
- **Per alumne** — `ha costat ÷ assistents`. L'única comparable entre etapes: ensenya que a Infantil costa més perquè són pocs repartint-se un autocar sencer.
- **Coixí** — quina etapa es queda curta. L'única que assenyala un problema.

Només compten les sortides **fetes**: una previsió no s'ha gastat encara.

## 5. La comparació entre cursos

Un selector de curs escolar, i al costat **«＋ Compara amb…»**, que **queda apagat mentre només hi hagi un curs**, amb el motiu escrit a sobre i no amagat.

Avui a producció hi ha **un curs i una sortida**. La comparació no tindrà res a comparar fins que passi un curs sencer. Preguntat el 2026-09-23: **no és un problema, ja compararan més endavant.** Les dades de 2022-23 viuen a l'Excel i importar-les és feina a part i possible; no entra aquí.

Quan n'hi hagi dos, comparar vol dir **les mateixes quatre xifres i el mateix gràfic, un al costat de l'altre**. Ni índexs, ni variacions percentuals, ni res que necessiti explicació: dos cursos amb un nombre diferent de sortides no es divideixen l'un per l'altre.

## 6. Com es veu

Una pantalla, de dalt a baix:

1. **Capçalera** — títol, selector de curs, i «＋ Compara amb…».
2. **Quatre xifres en fila** — ha entrat, ha costat, coixí, pendent de cobrar. Cadascuna amb una línia petita a sota que diu de què surt («de 8 sortides fetes»), perquè una xifra sense denominador no es pot jutjar.
3. **El gràfic per etapa**, amb l'interruptor de les tres mesures.
4. **Taula de les fetes** — sortida, etapa, paguen (`24 / 26`), ha costat, ha entrat, coixí.
5. **Taula de les que vénen** — sortida, etapa, data, costarà, hauria d'entrar, cobrat.
6. **L'avís** de les que no tenen pagaments apuntats, si n'hi ha.

### Amb poques dades

És el cas real d'avui i ha de tenir sentit igual:

- Sense cap sortida feta, les tres primeres xifres surten en gris amb un guionet i el motiu («cap sortida feta encara»), **no un 0 € que es llegiria com que s'ha perdut tot**.
- **El gràfic per etapa no surt fins que hi hagi almenys una sortida feta.** Amb una sola barra no compara res.
- Les taules buides diuen què falta perquè s'omplin, no «cap resultat».

## 7. On viu i qui el veu

Una ruta nova dins del mòdul, `/excursions/economia`, i un enllaç des de la pantalla d'excursions **visible només per a qui pot veure els costos**.

Accés: **`excursions_costos()`**, el permís estricte de diners, tant a la ruta com a l'enllaç. El panell és tot costos, i els costos ja són l'única cosa reservada del mòdul. No cal cap permís nou.

> Es llegeixen `excursio_finances` i `excursio_autocars`, que l'RLS ja restringeix a `excursions_costos()`. Si la pantalla arribés a mans de qui no ho és, el servidor tornaria files buides i no dades de més — però l'enllaç i la ruta s'hi tanquen igualment, perquè una pantalla en blanc no és una resposta.

## 8. Com es construeix

**El càlcul va a un mòdul pur nou, `src/modules/excursions/balanc.ts`**, germà de `preu.ts` i pel mateix motiu que aquell: és on un error costa diners de debò, i així es prova amb sortides reals sense muntar ni base de dades ni React.

```ts
export type MotiuFora = 'sense-pagaments' | 'sense-preu'

export interface BalancSortida {
  assistents: number
  haCostat: number
  haEntrat: number
  coixi: number
  foraDelCoixi: MotiuFora | null
}
export function balancSortida(...): BalancSortida
export function previsioSortida(...): Previsio
export function resumCurs(sortides, avui): ResumCurs
export function perEtapa(fetes, mesura): FilaEtapa[]
```

**Cap funció mira el rellotge.** La data d'avui entra com a argument, perquè les proves puguin situar-se on vulguin; qui la calcula és la pantalla, al límit de l'aplicació.

**Sense vista SQL ni migració nova.** Són desenes de files l'any i es calculen al client a partir del que ja se sap llegir. A més, cada superfície nova a la base de dades ha costat un forat en aquest mòdul —el privilegi d'`insert` per taula n'és l'últim—, i una vista que no calgui és una superfície que no cal revisar.

Les dades: una càrrega per curs de `excursions` + `excursio_grups` + `excursio_finances` + `excursio_autocars`, filtrant per `curs_escolar`. Avui `useExcursions` ja llegeix les tres primeres; les finances i els autocars es llegeixen sortida a sortida i caldrà una lectura per curs.

## 9. Proves

Al mòdul pur, que és on es poden fer de debò:

- Les quatre combinacions d'AMPA: sense AMPA, amb aportació per alumne, cobrint l'activitat, i col·laborant sense cobrir-la.
- Activitat `per_alumne` contra activitat `total` — el cas que ja va enganyar una vegada amb l'Excel.
- Una sortida amb zero pagaments queda marcada i **no entra als totals**.
- Una sortida amb menys pagaments que previsions **sí que hi entra**, sencera.
- El tall fet/per venir per data, amb una sortida d'avui mateix (compta com a feta).
- Les cancel·lades no surten enlloc.
- Una etapa sense cap sortida feta no surt al gràfic, i no divideix per zero.
- **El coixí d'una sortida on paguen exactament els esperats ha de sortir igual que el marge que `calculaPreu` hi va posar.** És la prova que lliga les dues peces: si divergeixen, una de les dues menteix.

## 10. Què no entra

Pressupostos ni previsions de despesa per etapa; exportar a Excel; importar 2022-23; penyores de cancel·lació; qualsevol import per alumne; i tocar `calculaPreu`, que ja està verificat contra 44 sortides reals i aquí només es llegeix.
