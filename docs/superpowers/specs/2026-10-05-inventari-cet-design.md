# Inventari ampliat i importació del CET

**Data:** 2026-10-05 · **Estat:** pendent de revisió de l'Andrés

## 1. Per què

El centre porta l'inventari TIC en un full de càlcul, el CET (*Control Equipamiento TIC*). Té dues pestanyes:
- **Dispositivos**: l'inventari real, amb 153 aparells;
- **Baremos**: les llistes que alimenten els desplegables del full.

L'Andrés vol que tot això visqui a SJO Hub. El mòdul d'Inventari actual no ho pot guardar: només té 4 estats, una ubicació de text lliure, i no té acció pendent ni sistema operatiu. Primer s'amplia el mòdul i després s'importa el full.

## 2. Decisions preses

- **S'amplia el mòdul abans d'importar.** No es força el full dins dels camps actuals.
- **Tot en català**: estats, tipus i accions es tradueixen. Els codis d'ubicació (`A21-ESO-2A`, `PTA1`...), els noms d'equip i els sistemes operatius es queden com són.
- **Cap contrasenya entra a la base de dades.** Al full n'hi ha a 104 dels 153 dispositius (`Admin pass: ...`, `Pas: ...`, codis de desbloqueig de tauletes). L'Inventari el poden llegir direcció, professorat i convidats.
- **Ubicació es queda com a camp i com a nom.** Ara es tria d'un catàleg en lloc d'escriure-la lliure.
- **`mac_wan` no canvia de nom.** La MAC Wi-Fi del full (marcada `W:`) s'hi guarda.
- **Es pot perdre informació.** L'Andrés ho ha acceptat explícitament.
- **No hi ha camps d'imatge.** La columna «Imagen instalada» és buida als 153 dispositius.

## 3. Model de dades (una migració)

### 3.1 Taula nova `ubicacions`

| Columna | Tipus | Notes |
|---|---|---|
| `codi` | `text` PK | `A21-ESO-2A`, `Informàtica 1`, `Aula Portàtil`... |
| `edifici` | `text not null default ''` | `A-EscC`, `B-Pas`, `Principal`... |
| `planta` | `text not null default ''` | `SOT`, `PB`, `PTA1`, `PubillaC`... |

- **Contingut inicial**: les 66 files del catàleg dels Barems (columnes 1–3). Una ubicació pot tenir l'edifici i la planta buits (per exemple, `Aula Portàtil`).
- **RLS**:
  - lectura per a qui veu el mòdul (`app_private.module_visible('inventari')`);
  - escriptura només per a `app_private.admin()`, la mateixa regla que `inventari`.
- **Disparadors**: `audit_change` i `fre_esborrats('1')`, com la resta de taules.

### 3.2 Canvis a `inventari`

- **`ubicacio`**:
  - passa a ser `null`able;
  - els `''` es converteixen en `null`;
  - clau forana a `ubicacions(codi)` amb `on update cascade on delete restrict`. Reanomenar una ubicació arriba als seus dispositius. No es pot esborrar una ubicació que encara té dispositius.
- **`estat`**: el `CHECK` passa de 4 a **9 valors fixos**:
  - `Actiu`, `Avariat`, `En reparació`, `En préstec`, `En proves`, `No desplegat`, `Retirat temporalment`, `De baixa`, `Robat`;
  - són fixos (no editables a Configuració) perquè el Dashboard i les etiquetes de color en depenen.
- **`accio`** (nova): `text not null default ''`. Llista editable `inventari.accions`.
- **`sistema_operatiu`** (nova): `text not null default ''`. Llista editable `inventari.sistemes-operatius`.
- **`mac_wan`, `mac_lan`, `ip_lan`, `ip_wan`**: sense canvis.

### 3.3 Llistes de Configuració

Es desen a `public.config` i també a `CONFIG_DEFAULTS`, perquè «restaurar per defecte» torni aquests valors.

- **`inventari.categories`** (Tipus) — substitueix la llista actual:
  Alarma, Altaveus, Altaveus Bluetooth, Càmera de seguretat, Impressora, Mòbil, NAS, PC, Pissarra digital, Portàtil, Projector, Punt d'accés, Ràdio CD, Router, Servidor, Switch, Switch gestionable, Tauleta, Televisió, Videogravador, Webcam, i **Altre** al final: el formulari el fa servir per escriure un tipus lliure.
- **`inventari.accions`**: Reparar, Registrar, Retirar, Revisar, Substituir.
- **`inventari.sistemes-operatius`**: Android OS, ChromeOS, DSM (Synology), Linux, Windows 7, Windows 8, Windows 11, Windows Vista, Windows X, Windows X Pro Education.

## 4. Pantalles

### 4.1 Inventari

- **Formulari**:
  - **Ubicació**: es tria del catàleg i, a sota, es veu `edifici · planta`.
  - **Estat**: els 9 valors.
  - **Acció pendent** i **Sistema operatiu**: desplegables de les seves llistes, amb opció buida. Si el valor d'un dispositiu ja no és a la llista, es continua mostrant, perquè desar no l'esborri.
  - **Marca, Model i Ubicació deixen de ser obligatoris.** Els dispositius importats no sempre en tenen, i el coordinador els ha de poder editar igualment.
  - La resta de camps no canvia.
- **Fitxa**: mostra la ubicació completa (`A21-ESO-2A · A-EscC · PTA1`), l'acció pendent (destacada si n'hi ha) i el sistema operatiu.
- **Llistat**: filtres nous per ubicació i per acció pendent, al costat dels d'estat i categoria actuals.
- **Etiquetes de color**: `Badge` cobreix els 9 estats.

### 4.2 Configuració → Inventari

La categoria ja existeix i hi afegeix:
- les llistes **Accions** i **Sistemes operatius**, amb el `LlistaEditor` de sempre;
- un editor d'**Ubicacions**: taula amb codi, edifici i planta, per afegir, editar i esborrar.
  - Esborrar una ubicació amb dispositius dona un error entenedor, no el de Postgres.

### 4.3 Dashboard

La targeta «En reparació» passa a comptar `Avariat` i `En reparació`.

### 4.4 Guia d'Ajuda

La secció d'Inventari i la taula de Configuració s'actualitzen amb els estats, l'acció pendent, el sistema operatiu i el catàleg d'ubicacions.

## 5. Importació (operació única, no és part de l'aplicació)

Un script fora del repositori llegeix els dos CSV, genera SQL i s'executa amb el connector de Supabase. Els `INSERT` hi funcionen; els `DELETE`, no. Ordre:
1. inserir les 66 ubicacions;
2. desar les tres llistes de configuració;
3. inserir els 153 dispositius.

**Correspondència de camps:**

| Full (Dispositivos) | Inventari |
|---|---|
| Usuari / Nom Equip | `nom` (si és buit: el tipus) |
| Referencia SNID | `num_serie` |
| Tipo | `categoria` (traduït) |
| Estado | `estat` (traduït; vegeu més avall) |
| Acción | `accio` (el `-` es converteix en buit) |
| Classe | `ubicacio`. Edifici i planta surten del catàleg: les 61 discrepàncies del full s'ignoren i es llisten a l'Andrés |
| Primera línia de Descripción | `marca` (si comença per Acer, HP, Lenovo, Asus o Epson) i `model` (la resta fins a la primera coma) |
| MAC ADDRESS `W:` / `L:` | `mac_wan` / `mac_lan`. Un valor sense marca va a `mac_lan` |
| IP | `ip_lan` |
| Sistema operativo | `sistema_operatiu` |
| Descripción (sense contrasenyes), Periféricos, id. producto | `notes`, una línia per concepte |

**Estats:**

| Full | Inventari |
|---|---|
| Activo | Actiu |
| Averiado | Avariat |
| En pruebas | En proves |
| No desplegado | No desplegat |
| Retirado | De baixa |
| Retirado temp. | Retirat temporalment |
| Robado | Robat |

**Contrasenyes:**
- Abans d'inserir s'eliminen de les notes els fragments `Admin pass: …`, `admin: …`, `Adminstrador: …`, `Admin: …`, `Pas: …`, `codigo: …`, `patron …` i qualsevol clau enganxada al final d'una línia amb `--…Clau`.
- Després de la importació, una consulta comprova que cap nota conté `pass`, `pas:`, `clau`, `codigo` ni cap de les contrasenyes que surten al full. La llista es passa a l'script en temps d'execució i **no es desa al repositori**.

**Comprovació final:** recompte per tipus i per estat contra el full (153 en total: 50 tauletes, 41 pissarres, 38 portàtils, 14 PC, 9 projectors, 1 d'altaveus).

## 6. Proves

- **Mòduls purs amb Vitest**, sense DOM, com a la resta del projecte:
  - **`ubicacioCompleta(codi, ubicacions)`**: el format `codi · edifici · planta`, que omet les parts buides.
  - **El grup d'estats que compta el Dashboard.**
- **`npm run typecheck`, `lint`, `test` i `build`** nets.

## 7. Fora d'abast

- Lligar Préstecs amb l'Inventari: avui `prestecs.dispositiu_id` és text lliure.
- Un botó d'importació dins l'aplicació.
- Els camps d'imatge.
- Canviar les contrasenyes exposades al full. Ho ha de fer l'Andrés, sobretot la d'administrador dels portàtils, que es repeteix a gairebé tots, i la del compte d'administració de ChromeOS.
