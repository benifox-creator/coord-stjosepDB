# SJO Hub · gestió del centre

Aplicació interna del Col·legi Sant Josep Obrer: horaris, absències i substitucions, reserves, inventari i préstecs, incidències, manteniment, planificació i material d’Infantil.

React + TypeScript + Vite; identitat Firebase; dades i permisos PostgreSQL/Supabase. El frontend es publica a **GitHub Pages**. Firebase Hosting i el projecte antic basat en Sheets no descriuen aquest desplegament.

## Desenvolupament

Node 24 i npm. Copiar `.env.example` a `.env.local` i completar les variables públiques del projecte de proves.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

`tests/preview.html` és una prova visual local amb dades fictícies i operacions desactivades. No s’inclou en el build de producció. Per verificar els fluxos complets cal una base de proves i comptes reals de cada rol.

## Estructura

- `src/App.tsx`: sessió, protecció i rutes amb càrrega diferida.
- `src/app/routes`: composició de cada mòdul i els seus formularis.
- `src/modules`: vistes, models, càlculs i stores del domini escolar.
- `src/services/db.ts`: credencial Firebase i lectures paginades; mai una clau de servei al navegador.
- `supabase/migrations`: permisos, integritat, transaccions, fotografies històriques i cua d’avisos.
- `supabase/functions/send-notifications`: enviament de la cua des d’un servei autoritzat.
- `tests`: proves de clients i de PostgreSQL amb PGlite, inclosa la migració de l’esquema anterior.

Les funcions del client ajuden a mostrar la interfície; **la base de dades imposa els permisos**. Les competències dels càrrecs no s’han ampliat.

## Posada en servei

Seguir [la guia d’operació i migració](docs/operacio-i-migracio.md). El frontend nou requereix les migracions i la integració Firebase–Supabase. No publicar-lo abans de preparar-les. Les proves locals no acrediten la configuració del servei remot.

[Abast i estat de la consolidació](docs/consolidacio-centre.md).
