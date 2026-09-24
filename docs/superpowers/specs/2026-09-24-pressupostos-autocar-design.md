# Petició de pressupostos als autocars — disseny

> Fase B2b del mòdul d'excursions, l'última peça que li queda. L'spec d'excursions (`2026-09-18-excursions-design.md` §7) ja en va fixar la forma general; aquí es tanquen les quatre decisions que aquell document deixava obertes i que són les que fan que el fitxer funcioni o no.

## 1. Per què existeix

Entre aprovar una sortida i saber què costa hi ha un pas que el circuit actual no cobreix: **demanar preu a les empreses d'autocars**. Com que el pla es fa tot al setembre, el natural és enviar la llista del curs sencer i rebre una taula de preus. Per això els costos arriben tard, i no per deixadesa.

Avui això es fa amb l'Excel `Excursió Curs.xlsm`. **És l'última cosa que el manté viu.**

## 2. El fitxer que surt

Una fila per sortida, amb el que l'empresa necessita per posar-hi preu: **codi, data, dia de la setmana, destinació, població, grups, passatgers** (alumnes previstos + acompanyants), **hora de sortida i hora de tornada**.

En exportar es tria **què s'està demanant** —autocar, activitat o totes dues—, i d'això depenen les columnes buides:

| Es demana | Columnes buides |
|---|---|
| Autocar | `Places`, `Preu autocar` |
| Activitat | `Preu per alumne`, `Preu total del grup` |
| Totes dues | les quatre |

No té sentit enviar a una empresa d'autocars un full amb una columna d'entrades.

**D'on surten les files:** un filtre nou al pla del curs, **«pendents de pressupost»** — sortides aprovades o més amunt, amb transport d'autocar, i **sense cap autocar amb preu**. D'aquestes se'n seleccionen les que es volen i es genera el fitxer.

> El fitxer porta dates, destinacions i nombre d'alumnes per grup. **No porta cap nom d'alumne ni de docent**, i així ha de continuar.

## 3. El fitxer que torna

**L'empresa pot partir una fila en diverses, una per autocar**, repetint el codi. Decidit el 2026-09-24, i és la manera fidel: una sortida de 89 passatgers en necessita dos, i quants en calen ho sap l'empresa, no el centre. Un pressupost real diu «2 autocars de 55 places a 610 € cadascun», no «1.220 €».

Això encaixa amb el model que ja hi ha: `excursio_autocars` **ja és una fila per vehicle** amb les seves places i el seu preu. En importar, les files s'agrupen pel codi i cadascuna es converteix en un autocar de la sortida.

### Els autocars que ja hi havia se substitueixen

No se sumen. Decidit el 2026-09-24. Amb això:

- **Importar dues vegades el mateix fitxer no canvia res.** Sumar-los doblaria el cost en silenci, que és la classe d'error que ningú no troba fins que el preu ja és a casa de les famílies.
- **Comparar dues empreses és importar i mirar.** S'importa la primera, es mira el preu per alumne, s'importa la segona, es torna a mirar.

La previsualització ho ha de dir abans de fer-ho: «substitueix 2 autocars (1.100 €) per 2 (1.220 €)».

> El que això no permet és una sortida amb autocars de **dues empreses diferents**. No ha passat mai i el dia que passi s'entren a mà, que és el que es fa ara.

### L'activitat: dues columnes, no una

`Preu per alumne` i `Preu total del grup`, i l'empresa omple la que correspongui.

Això no és zel: **l'Excel actual ja va enganyar per això**. La xifra d'activitat del full `Final` unes vegades és per alumne i unes altres un total de grup —16 de 44— i el full no ho marca enlloc; es dedueix creuant-lo amb un altre full. Amb dues columnes no hi ha res a deduir.

**Omplir-les totes dues és un error** i la previsualització atura aquella fila. No es tria una per defecte: si l'empresa ha escrit dos números, no sabem quin val.

El que s'importa va a `excursio_finances.preu_activitat` amb el seu `preu_activitat_tipus`, que és exactament la distinció que aquelles dues columnes fan explícita.

### L'IVA es declara una vegada, no per fila

Una casella a sobre de la previsualització: **«els preus d'aquest fitxer porten IVA»**. El pressupost d'una empresa el porta sencer o no el porta; no fila a fila.

Si es marca, es divideix pel `iva_pct` configurat abans de desar, perquè **el que es guarda sempre és el net**: és el que el càlcul espera, i `calculaPreu` ja hi aplica l'IVA quan toca. La previsualització ensenya **les dues columnes**, net i amb IVA, perquè es vegi què entrarà.

> És el mateix forat que el 2026-09-23 es va tapar a mà al bloc de costos, on ara el camp ensenya «→ 550,00 € amb IVA» al costat. Aquí la porta és més ampla —entren desenes de files de cop— i per això es declara en comptes d'avisar-ne.

## 4. La previsualització

Es reaprofita el patró que el projecte ja fa servir dues vegades, a Material Infantil i a Usuaris: **fila a fila, i no s'escriu res fins que es confirma**.

El que ha de caçar, i cada cas amb el seu missatge:

| Cas | Què passa |
|---|---|
| Un codi que no existeix | La fila s'atura |
| Un codi d'una sortida cancel·lada | La fila s'atura |
| Un preu que no és un número | La fila s'atura |
| Una fila d'autocar sense places | La fila s'atura |
| Les dues columnes d'activitat plenes | La fila s'atura |
| Un codi repetit | **No és error**: són els autocars d'una mateixa sortida |
| Una sortida que ja tenia autocars | **Avís**, no error: es dirà quants perd i quants guanya |
| Una fila amb el preu buit | Se salta en silenci: l'empresa no ha pressupostat aquella sortida |

Les files que s'aturen no impedeixen importar les altres, com als altres dos importadors.

## 5. Les empreses

Una llista editable a Configuració, `excursions.empreses-autocar`, com els espais de Reserves. Avui se'n fa servir una; canviar-la o demanar a dues ha de ser possible sense tocar codi.

**No cal una taula de proveïdors** com la de Material Infantil. El nom de l'empresa serveix per titular el fitxer que s'envia i prou: no es desa a cap fila, perquè el preu que entra és el que s'ha acceptat i d'on venia consta al fitxer que Secretaria té a la bústia.

## 6. Qui

- **Exportar: Gestió** (`excursions_gestio()`). El fitxer que surt no conté cap preu.
- **Importar: Costos** (`excursions_costos()`). El que torna sí.

És el repartiment que l'spec d'excursions §7 ja fixava, i coincideix amb el de la resta del mòdul.

## 7. L'enviament no és de l'aplicació

Es descarrega l'Excel i s'envia com s'envia avui. Adjuntar fitxers al correu és una peça a part, i **l'aplicació ja assumeix exactament això amb la circular**: la genera, la descarrega, i Secretaria la retoca i l'envia.

## 8. Com es construeix

Segueix el que el projecte ja fa:

- **Escriure i llegir l'Excel**: `xlsx` (SheetJS), carregat mandrosament, com fa `generarPlantillaExcel` a `src/modules/usuaris/excelImport.utils.ts`. El projecte té també `write-excel-file`, que Material Infantil fa servir per a la comanda al proveïdor, però allò és un document amb estil per a llegir i això és una graella per a omplir: amb una sola llibreria per a les dues direccions n'hi ha prou, i és la mateixa que després l'ha de tornar a llegir.
- **La lògica en mòduls purs**, fora dels components: analitzar el fitxer i decidir què és vàlid ha de poder-se provar sense DOM, perquè Vitest corre amb `environment: 'node'`. Els dos importadors existents ja ho fan així (`excelImport.utils.ts` + el seu `.test.ts`).
- **Cap migració.** `excursio_autocars` i `excursio_finances` ja tenen tot el que cal, i escriure-hi ja està cobert per les polítiques d'ara.

## 9. Proves

Al mòdul pur, amb fulls construïts a mà:

- Un codi repetit dona dos autocars a la mateixa sortida.
- Els autocars que ja hi havia se substitueixen, i importar dues vegades el mateix fitxer deixa el mateix resultat que importar-lo una.
- Cada cas de la taula de §4, un per un.
- Amb la casella d'IVA marcada, el que es desa és el net; sense marcar, el que es desa és el que hi havia escrit.
- Les dues columnes d'activitat: cadascuna per separat dona el `preu_activitat_tipus` que toca, i totes dues alhora aturen la fila.
- Les capçaleres es reconeixen amb accents, sense, i amb l'apòstrof que Excel converteix sol — el patró `clau()` d'`excelImport.utils.ts` ja ho fa i s'ha de reaprofitar, no reescriure.
- El filtre «pendents de pressupost» no agafa les que ja tenen un autocar amb preu, ni les cancel·lades, ni les que no van amb autocar.

## 10. Què no entra

Enviar el fitxer per correu des de l'aplicació; una taula de proveïdors; guardar l'històric de pressupostos rebuts o comparar-los dins l'aplicació; autocars de dues empreses a la mateixa sortida; i qualsevol dada d'alumnat.

## 11. Què tanca

Amb això **l'Excel `Excursió Curs.xlsm` es pot jubilar**: el circuit sencer —proposta, aprovació, pressupost, costos, preu, circular, pagaments i panell econòmic— viu a l'aplicació.
