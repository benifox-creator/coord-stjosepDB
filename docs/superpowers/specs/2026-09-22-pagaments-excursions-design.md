# Control de pagaments de les excursions — disseny

> Peça pendent llistada a `2026-09-18-excursions-design.md` §12. Aquí es tanca amb un abast molt més petit del que aquell document preveia, i el perquè és la part que val la pena llegir.

## 1. Per a què serveix

El panell econòmic que Direcció demana —costos, ingressos, comparació entre cursos— **no pot existir sense saber quants diners han entrat**. Avui l'aplicació sap què costa una sortida i quant s'ha decidit cobrar, però no si algú ha pagat. Aquesta peça hi posa l'única dada que falta.

**El que es vol saber és la xifra, no qui deu diners.** Preguntat expressament el 2026-09-22: perseguir les famílies que no han pagat el segueix fent el tutor, amb la seva llista, com fins ara. L'aplicació no hi ha d'entrar.

## 2. El canvi respecte del que es preveia

L'spec d'excursions deia «control de pagaments **per número de llista**, amb la llista **congelada** el dia que es crea l'excursió, perquè els números es desplacen quan entra alumnat a mig curs».

Això es descarta, i per dues raons que s'han vist en preguntar:

1. **No resolia el problema que deia resoldre.** L'aplicació no té cap llista d'alumnes: el número 7 d'una classe viu a Alexia. Congelar «la llista» aquí només congelaria un recompte, no el vincle entre el número i cada infant — que és justament el que es desplaça.
2. **No cal per al que es vol.** Si el que es busca és la xifra, un recompte per grup ja la dona.

**Conseqüència directa:** aquesta peça **no introdueix cap dada d'alumnat**, ni tan sols pseudonimitzada. La nota de protecció de dades de l'spec d'excursions (§13) es manté tal com està, i el que hi deia sobre «dades pseudonimitzades» quan arribés el control de pagaments ja no aplica.

## 3. El model de dades

Una columna a `public.excursio_grups`:

```
alumnes_pagats integer not null default 0 check (alumnes_pagats >= 0)
```

Res més. Els diners recaptats d'una excursió són `sum(alumnes_pagats) × preu_alumne`, amb el preu que ja està congelat des que es va confirmar.

**No es limita a `alumnes_previstos`.** Un grup pot acabar amb més pagaments que previsions —els previstos s'escriuen al setembre i el nombre es mou— i un límit dur convertiria una dada correcta en un error que no deixa desar. La pantalla ho pot assenyalar; la base de dades no ho ha d'impedir.

**No es guarda cap import.** Preguntat el 2026-09-22: tothom paga el mateix o no paga. Les devolucions del 75 % són prou rares com perquè modelar-les costi més del que val. Si algun dia deixa de ser cert, caldrà una columna d'ajust amb el seu motiu, i això serà una decisió conscient i no un afegit.

## 4. Qui ho apunta

**El tutor, a mesura que rep els resguards.** És qui els té a la mà. Va actualitzant el número del seu grup fins a la data límit.

Això xoca amb dues coses del sistema actual:

- La política d'`excursio_grups` només deixa escriure a qui gestiona excursions o a l'autor mentre és esborrany. Un tutor corrent no hi entra.
- Les polítiques de PostgreSQL són **per fila, no per columna**: no es pot dir «aquest pot tocar `alumnes_pagats` però no `alumnes_previstos`».

La sortida és la que el mòdul ja fa servir dues vegades (`confirmar_preu`, `enviar_circular`): **una funció de servidor**, `public.registra_pagaments(p_grup uuid, p_pagats integer)`, `security definer`, que és l'únic camí per escriure aquella columna. Comprova qui crida i què escriu; la política de la taula no s'obre.

> Cal recordar el que ja ha passat dues vegades en aquest mòdul: la política d'`excursions` és per fila i concedeix `update` sencer, i el disparador surt d'hora quan l'estat no canvia. **Tota regla que hagi de ser inviolable va al disparador, abans d'aquell curt-circuit**, no només dins l'RPC.

### Qui pot cridar-la

**Qualsevol que vegi el mòdul** (`app_private.module_visible('excursions')` i `app_private.creator()`), sobre qualsevol grup.

Decidit el 2026-09-22, sabent què es descarta. `usuaris` no sap qui és tutor de quin grup: només guarda una etapa. Les alternatives eren restringir-ho a qui va proposar l'excursió —però les sortides es proposen per nivell, i llavors el tutor de B no podria apuntar el seu— o afegir un mapa de tutors a `usuaris`, que és el correcte de debò però és una llista més per mantenir cada setembre.

Es tria la porta oberta perquè el centre és petit, perquè tot el claustre ja veu el pla sencer a propòsit, i perquè **queda rastre**: la taula té el disparador d'auditoria des de la Fase A, així que es veu qui ha canviat què.

## 5. On es veu

A la fitxa de l'excursió, al bloc de grups que ja hi ha, al costat de previstos i finals: un camp per grup.

El recompte el veu **tothom qui veu el mòdul**, i amb ell l'import —que no es desa enlloc: es calcula multiplicant pel `preu_alumne`, que és públic perquè va a la circular; amagar-lo seria fingir que és un secret quan les famílies el tenen imprès a casa. El que continua reservat són els **costos**, que és una altra cosa.

## 6. Proves

- Un docent corrent pot registrar pagaments d'un grup qualsevol, i **no** pot tocar `alumnes_previstos` amb un `update` directe.
- Un convidat no pot registrar-ne.
- Un número negatiu es rebutja.
- Es pot registrar més pagaments que previsions (no és un error).
- `registra_pagaments` és l'únic camí: un `update` directe sobre `alumnes_pagats` es rebutja encara que el faci qui gestiona excursions.
- La columna entra al disparador d'auditoria (hi entra sola: el disparador és per taula).

## 7. Què no entra

Ajustos i devolucions; imports per alumne; qualsevol dada d'alumnat; i **el panell econòmic**, que és la peça següent i el motiu de fer aquesta.

## 8. Què desbloqueja

Amb això, el panell pot ensenyar per fi ingressos reals contra costos reals. Queden fora del seu abast, i cal dir-ho quan es dissenyi:

- **La comparació entre cursos escolars no tindrà res a comparar** fins que passi un curs sencer. Les dades de 2022-23 són a l'Excel, no a la base de dades; importar-les és feina a part i possible.
- L'spec d'excursions §12 deia que, amb dades de pagaments, la previsió d'assistència es podria proposar a partir de l'històric real de cada nivell en lloc d'un número fix. Això continua sent cert i continua sent futur.
