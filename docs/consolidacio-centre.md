# Consolidació de SJO Hub

Abast autoritzat el 13/09/2026: corregir l'auditoria i completar Horaris. Es mantenen les competències dels càrrecs actuals. El desplegament i les dades de producció es revisen separadament.

## Fases i criteris d'acceptació

1. Identitat Firebase a Supabase, RLS per operació, permisos tancats durant la càrrega i configuració buida respectada. Cap accés anònim ni autoalta de coordinador.
2. Codis sense truncament, lectures paginades, reserves sense solapaments i préstecs transaccionals amb devolucions idempotents.
3. Horaris amb vigència, cobertura explícita, absència amb fotografia de períodes, aprovació atòmica i assignació de substitut.
4. Comandes confirmades amb quantitats/preus congelats; notificacions amb estat i reintents; tauler orientat a tasques i càrrecs.
5. TypeScript estricte, lint, tests de regressió i SQL en PostgreSQL local de proves; documentació d'operació i desplegament.

## Producció

Abans de desplegar: còpia de seguretat verificable, integració Third-party Auth de Firebase en Supabase, claim `role: authenticated` dels usuaris, migracions en ordre i prova de permisos amb comptes de cada rol. Les migracions s'han d'assajar sobre una còpia; no s'executa l'esquema inicial sobre una base existent.

Les polítiques locals no acrediten la configuració actual del servei remot. Les còpies, regió, retenció i restauració s'han de comprovar al servei.

## Resultat local

Implementació preparada a `feat-horaris` (worktree `.worktrees/feat-horaris`), sense modificar `main` ni els serveis remots. S’han completat les cinc fases de codi; l’activació remota es regeix per la [guia d’operació](operacio-i-migracio.md).

Validació: 53 proves en 8 fitxers, TypeScript estricte, lint sense incidències i build amb càrrega diferida per mòdul. La suite inclou permisos i transaccions PostgreSQL, migració de l’esquema anterior, paginació, visibilitat buida, canvi de curs i reclamacions d’avisos. El servei de correu té també comprovació de tipus pròpia, inclosa al build.

Interfície comprovada amb dades fictícies en escriptori i mòbil: horari, vigència i cobertura del període, selecció d’absència amb un buit entre períodes i recompte correcte d’hores. La taula es desplaça horitzontalment en pantalles petites.

Pendent d’operació, no executat: assaig sobre còpia de dades reals, integració i claims Firebase–Supabase, aplicació remota de migracions, autorització del remitent i programació de correus, proves amb comptes de cada rol i desplegament. Les comandes històriques sense fotografia i la verificació de còpies/retenció tenen les limitacions descrites a la guia.
