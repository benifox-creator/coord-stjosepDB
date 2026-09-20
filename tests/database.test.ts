import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest'

let db: PGlite
async function asUser(email: string, verified = true) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ email, email_verified: verified })])
  await db.exec('set role authenticated')
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
    $$; grant usage on schema auth to authenticated, anon;`)
  // Supabase concedeix tots els privilegis a anon i authenticated a cada taula
  // nova de public. Sense replicar-ho aquí, les proves de privilegis passarien
  // encara que les migracions s'oblidessin de revocar-los.
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;`)
  const schema = (await readFile('supabase/schema.sql', 'utf8')).replace('create extension if not exists "pgcrypto";', '')
  await db.exec(schema)
  for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'))
  }
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec(`begin;
    insert into public.usuaris(email,nom,rol) values
    ('admin@stjosep.org','Admin','coordinador'),('director@stjosep.org','Director','direccio'),
    ('teacher@stjosep.org','Teacher','professorat'),('other@stjosep.org','Other','professorat'),
    ('guest@stjosep.org','Guest','convidat');
    insert into public.material(codi,nom,quantitat_total,quantitat_disponible) values('TEST-001','Cable',3,3);`)
})
afterEach(async () => { await db.exec('rollback; reset role;') })

describe('database authorization', () => {
  it('blocks anonymous access', async () => {
    await db.exec('set role anon')
    await expect(db.query('select * from public.usuaris')).rejects.toThrow()
  })
  it('rejects unregistered, external and unverified identities', async () => {
    for (const [email, verified] of [['new@stjosep.org',true],['admin@external.org',true],['admin@stjosep.org',false]] as const) {
      await asUser(email, verified)
      expect((await db.query('select * from public.usuaris')).rows).toHaveLength(0)
    }
  })
  it('does not let teachers change their role', async () => {
    await asUser('teacher@stjosep.org')
    expect((await db.query("update public.usuaris set rol='coordinador' where email='teacher@stjosep.org' returning id")).rows).toHaveLength(0)
  })
  it('respects an explicitly empty visibility list', async () => {
    await db.exec(`insert into public.config values('visibilitat.material','[]')`)
    await asUser('teacher@stjosep.org')
    expect((await db.query('select * from public.material')).rows).toHaveLength(0)
  })
  it('keeps configuration administration with the coordinator', async () => {
    await asUser('director@stjosep.org')
    await expect(db.query("insert into public.config values('forbidden','[]')")).rejects.toThrow()
  })
  it('denies convidat any write access', async () => {
    await asUser('guest@stjosep.org')
    await expect(db.exec("insert into public.reserves(espai,data,hora_inici,hora_fi) values('Biblioteca','2026-09-14','09:00','10:00')")).rejects.toThrow()
  })
})

describe('privilegis', () => {
  it('cap taula de public dona TRUNCATE ni REFERENCES a authenticated o anon', async () => {
    // TRUNCATE se salta l'RLS i no dispara els triggers de fila: buidaria una
    // taula sencera sense deixar rastre a l'auditoria. Ningú l'ha de tenir.
    const sobrants = (await db.query<{taula:string;qui:string;permis:string}>(`
      select table_name as taula, grantee as qui, privilege_type as permis
      from information_schema.role_table_grants
      where table_schema='public' and grantee in ('authenticated','anon')
        and privilege_type in ('TRUNCATE','REFERENCES')`)).rows
    expect(sobrants.map(r => `${r.qui} ${r.permis} on ${r.taula}`)).toEqual([])
  })

  it('anon no té cap privilegi sobre cap taula', async () => {
    const seus = (await db.query(`
      select 1 from information_schema.role_table_grants
      where table_schema='public' and grantee='anon'`)).rows
    expect(seus).toHaveLength(0)
  })

  it('conserva el permís per columna de prestecs', async () => {
    // authenticated només pot actualitzar `notes`: revocar en bloc ho hauria
    // pogut esborrar sense que es notés.
    const cols = (await db.query<{column_name:string}>(`
      select column_name from information_schema.column_privileges
      where table_schema='public' and table_name='prestecs'
        and grantee='authenticated' and privilege_type='UPDATE'`)).rows
    expect(cols.map(c => c.column_name)).toEqual(['notes'])
  })
})

describe('fre als esborrats massius', () => {
  it('deixa esborrar un registre, com fa l’aplicació', async () => {
    await asUser('admin@stjosep.org')
    const id = (await db.query<{id:string}>("insert into public.reserves(espai,data,hora_inici,hora_fi) values('Biblioteca','2026-09-14','09:00','10:00') returning id")).rows[0].id
    expect((await db.query('delete from public.reserves where id=$1 returning id',[id])).rows).toHaveLength(1)
  })

  it('atura un esborrat que s’emporti més d’una fila', async () => {
    await asUser('admin@stjosep.org')
    await db.exec(`insert into public.reserves(espai,data,hora_inici,hora_fi) values
      ('Biblioteca','2026-09-14','09:00','10:00'),('Biblioteca','2026-09-14','11:00','12:00')`)
    // Això és el que faria un error de programació que oblidés el filtre.
    await expect(db.query('delete from public.reserves')).rejects.toThrow('Esborrat massiu aturat')
  })

  it('no trenca les cascades: esborrar una excursió s’emporta els seus grups', async () => {
    await asUser('teacher@stjosep.org')
    const id = (await db.query<{id:string}>(`insert into public.excursions(etapa,lloc,activitat)
      values('EP','Can Montcau','Castanyada') returning id`)).rows[0].id
    await db.exec(`insert into public.excursio_grups(excursio_id,grup,alumnes_previstos) values
      ('${id}','EP-1 A',25),('${id}','EP-1 B',24),('${id}','EP-1 C',23)`)
    expect((await db.query('delete from public.excursions where id=$1 returning id',[id])).rows).toHaveLength(1)
    expect((await db.query('select * from public.excursio_grups')).rows).toHaveLength(0)
  })

  it('el rastre d’auditoria té dues barreres, i la primera és el permís', async () => {
    await asUser('admin@stjosep.org')
    await db.exec(`insert into public.reserves(espai,data,hora_inici,hora_fi) values
      ('Biblioteca','2026-09-14','09:00','10:00'),('Biblioteca','2026-09-14','11:00','12:00')`)
    // Des de l'aplicació ni tan sols s'hi arriba: authenticated només hi pot llegir.
    await db.exec('savepoint sense_permis')
    await expect(db.query('delete from public.audit_events')).rejects.toThrow('permission denied')
    await db.exec('rollback to savepoint sense_permis')
    // I amb una connexió privilegiada, que sí hi té permís, hi ha el fre.
    await db.exec('reset role')
    await expect(db.query('delete from public.audit_events')).rejects.toThrow('Esborrat massiu aturat')
  })
})

describe('operational integrity', () => {
  it('keeps four-digit codes unique', async () => {
    expect((await db.query<{code:string}>("select public.format_code('SUB',1000) as code")).rows[0].code).toBe('SUB-1000')
  })
  it('rejects malformed times', async () => {
    await asUser('admin@stjosep.org')
    for (const value of ['25:00', '9:60', 'abc']) {
      await db.exec('savepoint minutes_check')
      await expect(db.query('select app_private.minutes($1)', [value])).rejects.toThrow('Hora invàlida')
      await db.exec('rollback to savepoint minutes_check')
    }
  })
  it('creates a loan once and restores stock once on repeated return', async () => {
    await asUser('admin@stjosep.org')
    const args = [JSON.stringify({usuari:'Teacher',data_inici:'2026-09-14'}),JSON.stringify([{codi:'TEST-001',quantitat:2}]),'11111111-1111-4111-8111-111111111111']
    const first = (await db.query<{id:string}>('select id from public.create_loan($1,$2,$3)',args)).rows[0]
    const again = (await db.query<{id:string}>('select id from public.create_loan($1,$2,$3)',args)).rows[0]
    expect(again.id).toBe(first.id)
    expect((await db.query<{quantitat_disponible:number}>("select quantitat_disponible from public.material where codi='TEST-001'")).rows[0].quantitat_disponible).toBe(1)
    await db.query("select public.change_loan_state($1,'Retornat')",[first.id])
    await db.query("select public.change_loan_state($1,'Retornat')",[first.id])
    expect((await db.query<{quantitat_disponible:number}>("select quantitat_disponible from public.material where codi='TEST-001'")).rows[0].quantitat_disponible).toBe(3)
  })
  it('rolls back the whole loan when stock is insufficient', async () => {
    await asUser('admin@stjosep.org')
    await db.exec('savepoint failed_loan')
    await expect(db.query('select public.create_loan($1,$2,$3)',[
      JSON.stringify({usuari:'Teacher',data_inici:'2026-09-14'}),JSON.stringify([{codi:'TEST-001',quantitat:4}]),'11111111-1111-4111-8111-111111111111',
    ])).rejects.toThrow('Estoc insuficient')
    await db.exec('rollback to savepoint failed_loan')
    expect((await db.query('select * from public.prestecs')).rows).toHaveLength(0)
  })
  it('rejects overlapping reservations but permits adjacent ones', async () => {
    await asUser('admin@stjosep.org')
    await db.exec("insert into public.reserves(espai,data,hora_inici,hora_fi) values('Biblioteca','2026-09-14','09:00','10:00'),('Biblioteca','2026-09-14','10:00','11:00')")
    await expect(db.exec("insert into public.reserves(espai,data,hora_inici,hora_fi) values('Biblioteca','2026-09-14','09:30','10:30')")).rejects.toThrow('ja té una reserva')
  })
})

async function schedule(email = 'teacher@stjosep.org', slot = '09:00-10:00', type = 'Lectiva', cover = true) {
  await asUser(email)
  return (await db.query<{id:string}>(`insert into public.horaris(professor,dia_setmana,etapa,franja,tipus,grup,materia,curs_escolar,vigent_desde,vigent_fins,necessita_cobertura)
    values($1,'Dilluns','EP',$2,$3,'EP-1r A',$4,'2026-2027','2026-09-01','2027-08-31',$5) returning id`,[email,slot,type,type==='Lectiva'?'Matemàtiques':'Pati',cover])).rows[0].id
}
async function absence(ids: string[], date = '2026-09-14') {
  await asUser('teacher@stjosep.org')
  return (await db.query<{id:string;hores:string;hores_no_lectives:string}>('select * from public.create_absence($1,$2,$3)',[
    JSON.stringify({data:date,hora_inici:'09:00',hora_fi:'10:00',motiu:'Formació'}),ids,'22222222-2222-4222-8222-222222222222',
  ])).rows[0]
}

describe('schedule and absence workflow', () => {
  it('keeps other teachers schedules private', async () => {
    await schedule()
    await asUser('other@stjosep.org')
    expect((await db.query('select * from public.horaris')).rows).toHaveLength(0)
  })
  it('lets the coordinator edit and delete any schedule, but not other managers', async () => {
    const id = await schedule()
    await asUser('director@stjosep.org')
    expect((await db.query('select * from public.horaris')).rows).toHaveLength(1)
    expect((await db.query("update public.horaris set materia='Ciències' where id=$1 returning id",[id])).rows).toHaveLength(0)
    await asUser('other@stjosep.org')
    expect((await db.query("update public.horaris set materia='Ciències' where id=$1 returning id",[id])).rows).toHaveLength(0)
    await asUser('admin@stjosep.org')
    expect((await db.query("update public.horaris set materia='Ciències' where id=$1 returning id",[id])).rows).toHaveLength(1)
    await db.query(`insert into public.horaris(professor,dia_setmana,etapa,franja,grup,materia,curs_escolar,vigent_desde,vigent_fins)
      values('teacher@stjosep.org','Dimarts','EP','09:00-10:00','EP-1r A','Català','2026-2027','2026-09-01','2027-08-31')`)
    expect((await db.query("delete from public.horaris where id=$1 returning id",[id])).rows).toHaveLength(1)
  })
  it('records the coordinator as the author when creating a schedule for someone else', async () => {
    await asUser('admin@stjosep.org')
    const row = (await db.query<{creat_per:string}>(`insert into public.horaris(professor,dia_setmana,etapa,franja,grup,materia,curs_escolar,vigent_desde,vigent_fins,creat_per)
      values('teacher@stjosep.org','Dilluns','EP','09:00-10:00','EP-1r A','Català','2026-2027','2026-09-01','2027-08-31','teacher@stjosep.org') returning creat_per`)).rows[0]
    expect(row.creat_per).toBe('admin@stjosep.org')
  })
  it('refuses a schedule for somebody who is not registered', async () => {
    await asUser('admin@stjosep.org')
    await expect(db.exec(`insert into public.horaris(professor,dia_setmana,etapa,franja,grup,materia,curs_escolar,vigent_desde,vigent_fins)
      values('tipo@stjosep.org','Dilluns','EP','09:00-10:00','EP-1r A','Català','2026-2027','2026-09-01','2027-08-31')`)).rejects.toThrow('donat d’alta a Usuaris')
  })
  it('still refuses to move a schedule to another teacher', async () => {
    const id = await schedule()
    await asUser('admin@stjosep.org')
    await expect(db.query("update public.horaris set professor='other@stjosep.org' where id=$1",[id])).rejects.toThrow('canviar el titular')
  })
  it('keeps absences private between teachers but visible to managers', async () => {
    await absence([])
    await asUser('other@stjosep.org')
    expect((await db.query('select * from public.absencies')).rows).toHaveLength(0)
    await asUser('director@stjosep.org')
    expect((await db.query('select * from public.absencies')).rows).toHaveLength(1)
  })
  it('rejects cross-stage overlaps', async () => {
    await schedule()
    await expect(db.exec(`insert into public.horaris(professor,dia_setmana,etapa,franja,grup,materia,curs_escolar,vigent_desde,vigent_fins)
      values('teacher@stjosep.org','Dilluns','ESO 1r-2n','09:30-10:30','1r ESO A','Català','2026-2027','2026-09-01','2027-08-31')`)).rejects.toThrow('se solapa')
  })
  it('counts selected periods, including a gap, and generates coverage exactly once', async () => {
    const a=await schedule(), b=await schedule('teacher@stjosep.org','11:00-11:30','No lectiva',true)
    const request=await absence([a,b])
    expect(Number(request.hores)).toBe(1.5)
    expect(Number(request.hores_no_lectives)).toBe(0.5)
    // Snapshot survives later schedule edits.
    await db.query("update public.horaris set materia='Ciències' where id=$1",[a])
    await asUser('admin@stjosep.org')
    await db.query('select public.review_absence($1,true)',[request.id])
    await db.query('select public.review_absence($1,true)',[request.id])
    const substitutions=(await db.query<{materia:string}>('select * from public.substitucions')).rows
    expect(substitutions).toHaveLength(2)
    expect(substitutions.map(s=>s.materia)).toContain('Matemàtiques')
    expect((await db.query("select * from public.notifications where event_key like 'absence-reviewed:%'")).rows).toHaveLength(1)
  })
  it('does not generate substitutions for the manual fallback', async () => {
    const request=await absence([])
    await asUser('director@stjosep.org')
    await db.query('select public.review_absence($1,true)',[request.id])
    expect((await db.query('select * from public.substitucions')).rows).toHaveLength(0)
  })
  it('does not let a teacher approve an absence', async () => {
    const request=await absence([])
    await expect(db.query('select public.review_absence($1,true)',[request.id])).rejects.toThrow('No autoritzat')
  })
  it('rejects a period outside its validity or on the wrong weekday', async () => {
    const id=await schedule()
    await expect(absence([id],'2026-09-15')).rejects.toThrow('no corresponen')
  })
  it('rejects a period belonging to another teacher', async () => {
    const id=await schedule('other@stjosep.org')
    await expect(absence([id])).rejects.toThrow('no corresponen')
  })
  it('does not assign a substitute who already has class', async () => {
    const own=await schedule()
    await schedule('other@stjosep.org')
    const request=await absence([own])
    await asUser('admin@stjosep.org')
    await db.query('select public.review_absence($1,true)',[request.id])
    const s=(await db.query<{id:string}>('select id from public.substitucions')).rows[0]
    await expect(db.query("select public.update_substitution($1,'other@stjosep.org','Pendent','','Pendent')",[s.id])).rejects.toThrow('té classe')
  })
  it('keeps substitutions visible only to those involved and to managers', async () => {
    const request=await absence([await schedule()])
    await asUser('admin@stjosep.org')
    await db.query('select public.review_absence($1,true)',[request.id])
    const s=(await db.query<{id:string}>('select id from public.substitucions')).rows[0]
    await db.query("select public.update_substitution($1,'other@stjosep.org','Pendent','','Pendent')",[s.id])
    await asUser('guest@stjosep.org')
    expect((await db.query('select * from public.substitucions')).rows).toHaveLength(0)
    await asUser('other@stjosep.org')
    expect((await db.query('select * from public.substitucions')).rows).toHaveLength(1)
    await asUser('teacher@stjosep.org')
    expect((await db.query('select * from public.substitucions')).rows).toHaveLength(1)
  })
})

describe('confirmed orders', () => {
  it('freezes quantities and prices when ordering', async () => {
    await asUser('admin@stjosep.org')
    await db.exec(`insert into public.config values('material-infantil.alumnes-i3','["10"]');`)
    const m=(await db.query<{id:string}>("insert into public.materials_infantil(nom,preu_unitari,unitats_per_alumne) values('Paper',2,1) returning id")).rows[0]
    const order=(await db.query<{id:string}>("insert into public.comandes_infantil(curs_escolar,etapa,material_id,estat) values('2026-2027','I3',$1,'Demanat') returning id",[m.id])).rows[0]
    await db.query('update public.materials_infantil set preu_unitari=9 where id=$1',[m.id])
    const snap=(await db.query<{fotografia:{quantitat:number;cost:number}}>('select fotografia from public.comandes_infantil where id=$1',[order.id])).rows[0].fotografia
    expect(snap.quantitat).toBe(10)
    expect(snap.cost).toBe(20)
  })
})

describe('permission and transaction regressions', () => {
  it('limits knowledge drafts and publishing to the coordinator', async () => {
    await asUser('admin@stjosep.org')
    await db.exec("insert into public.coneixement(titol,publicat) values('Draft',false),('Published',true)")
    await asUser('director@stjosep.org')
    expect((await db.query('select * from public.coneixement')).rows).toHaveLength(1)
    expect((await db.query("update public.coneixement set publicat=true returning id")).rows).toHaveLength(0)
  })
  it('retains departmental configuration without granting user administration', async () => {
    await asUser('director@stjosep.org')
    await db.exec(`insert into public.config values('material-infantil.alumnes-i3','["20"]')`)
    expect((await db.query("update public.usuaris set rol='coordinador' returning id")).rows).toHaveLength(0)
  })
  it('does not bypass an empty infant module list for direction', async () => {
    await db.exec(`insert into public.config values('visibilitat.material-infantil','[]')`)
    await asUser('director@stjosep.org')
    expect((await db.query<{allowed:boolean}>("select app_private.module_visible('material-infantil') as allowed")).rows[0].allowed).toBe(false)
  })
  it('rolls back approval and its notification if coverage insertion fails', async () => {
    const id=await schedule(), request=await absence([id])
    await db.exec(`reset role; create function public.fail_coverage() returns trigger language plpgsql as $$ begin raise exception 'simulated failure'; end; $$;
      create trigger fail_coverage before insert on public.substitucions for each row execute function public.fail_coverage();`)
    await asUser('admin@stjosep.org')
    await db.exec('savepoint approval')
    await expect(db.query('select public.review_absence($1,true)',[request.id])).rejects.toThrow('simulated failure')
    await db.exec('rollback to savepoint approval')
    expect((await db.query<{estat:string}>('select estat from public.absencies where id=$1',[request.id])).rows[0].estat).toBe('Pendent revisió')
    expect((await db.query("select * from public.notifications where event_key like 'absence-reviewed:%'")).rows).toHaveLength(0)
  })
  it('rejects a stale assignment and allows only the assigned teacher to complete it', async () => {
    const request=await absence([await schedule()])
    await asUser('admin@stjosep.org')
    await db.query('select public.review_absence($1,true)',[request.id])
    const s=(await db.query<{id:string}>('select id from public.substitucions')).rows[0]
    await db.query("select public.update_substitution($1,'other@stjosep.org','Pendent','','Pendent')",[s.id])
    await db.exec('savepoint stale')
    await expect(db.query("select public.update_substitution($1,'director@stjosep.org','Pendent','','Pendent')",[s.id])).rejects.toThrow('ha canviat')
    await db.exec('rollback to savepoint stale')
    await asUser('other@stjosep.org')
    await db.query("select public.update_substitution($1,'other@stjosep.org','Realitzada','other@stjosep.org','Pendent')",[s.id])
  })
  it('respects non-teaching days', async () => {
    const id=await schedule()
    await asUser('admin@stjosep.org')
    await db.exec(`insert into public.config values('centre.dies-no-lectius','["2026-09-14"]')`)
    await expect(absence([id])).rejects.toThrow('dia no lectiu')
  })
  it('persists incident notification with the change and never claims it was delivered', async () => {
    await asUser('admin@stjosep.org')
    const incident=(await db.query<{id:string}>("insert into public.incidencies(marca_temps,tipus_problema,reporter) values('2026-09-14 09:00','Xarxa','spoof@stjosep.org') returning id")).rows[0]
    await db.query("update public.incidencies set estat='Tancada' where id=$1",[incident.id])
    expect((await db.query<{notificat:string;reporter:string}>('select notificat,reporter from public.incidencies')).rows[0]).toEqual({notificat:'queued',reporter:'admin@stjosep.org'})
    expect((await db.query("select * from public.notifications where status='pending'")).rows).toHaveLength(1)
  })
  it('does not let closing an incident redirect its notification to an arbitrary reporter', async () => {
    await asUser('teacher@stjosep.org')
    const incident=(await db.query<{id:string}>("insert into public.incidencies(marca_temps,tipus_problema) values('2026-09-14 09:00','Xarxa') returning id")).rows[0]
    await asUser('admin@stjosep.org')
    await db.query("update public.incidencies set estat='Tancada',reporter='attacker@evil.com' where id=$1",[incident.id])
    expect((await db.query<{reporter:string}>('select reporter from public.incidencies where id=$1',[incident.id])).rows[0].reporter).toBe('teacher@stjosep.org')
    expect((await db.query<{recipient:string}>("select recipient from public.notifications where status='pending'")).rows[0].recipient).toBe('teacher@stjosep.org')
  })
})

describe('notification worker', () => {
  it('keeps notifications visible only to their creator and to admins, not any manager', async () => {
    await db.exec("insert into public.notifications(created_by,recipient,subject,body) values('admin@stjosep.org','teacher@stjosep.org','Test','Test')")
    await asUser('teacher@stjosep.org')
    expect((await db.query('select * from public.notifications')).rows).toHaveLength(0)
    await asUser('director@stjosep.org')
    expect((await db.query('select * from public.notifications')).rows).toHaveLength(0)
    await asUser('admin@stjosep.org')
    expect((await db.query('select * from public.notifications')).rows).toHaveLength(1)
  })
  it('prevents browsers from claiming the mail queue', async () => {
    await asUser('admin@stjosep.org')
    await expect(db.query('select * from public.claim_notifications()')).rejects.toThrow('permission denied')
  })
  it('marks the exhausted lease failed and ignores an obsolete worker claim', async () => {
    await db.exec(`insert into public.notifications(created_by,recipient,subject,body,status,attempts,next_attempt_at)
      values('admin@stjosep.org','teacher@stjosep.org','Test','Test','sending',5,now()-interval '10 minutes');`)
    await db.query('select * from public.claim_notifications()')
    expect((await db.query<{status:string}>('select status from public.notifications')).rows[0].status).toBe('failed')
    await asUser('admin@stjosep.org')
    const n=(await db.query<{id:string}>('select id from public.notifications')).rows[0]
    await db.query('select public.retry_notification($1)',[n.id])
    await db.exec('reset role')
    const claim=(await db.query<{id:string;claim_token:string}>('select * from public.claim_notifications()')).rows[0]
    await db.query("select public.finish_notification($1,'00000000-0000-4000-8000-000000000000',null)",[claim.id])
    expect((await db.query<{status:string}>('select status from public.notifications')).rows[0].status).toBe('sending')
    await db.query('select public.finish_notification($1,$2,null)',[claim.id,claim.claim_token])
    expect((await db.query<{status:string}>('select status from public.notifications')).rows[0].status).toBe('sent')
  })
})

describe('excursions', () => {
  // Crea un esborrany complet: amb el disparador, les transicions han de ser
  // legítimes, i per proposar cal com a mínim un grup amb alumnes.
  async function completa(autor = 'teacher@stjosep.org', data = '2026-10-19') {
    await asUser(autor)
    const id = (await db.query<{id:string}>(`insert into public.excursions(etapa,lloc,activitat,data,hora_sortida,hora_tornada)
      values('EP','Can Montcau','La Castanyada',$1,'9:00','17:00') returning id`,[data])).rows[0].id
    await db.query(`insert into public.excursio_grups(excursio_id,grup,alumnes_previstos) values($1,'EP-1r A',25)`,[id])
    return id
  }
  async function proposada(autor = 'teacher@stjosep.org') {
    const id = await completa(autor)
    await db.query("update public.excursions set estat='Proposada' where id=$1",[id])
    return id
  }
  async function aprovada(autor = 'teacher@stjosep.org') {
    const id = await proposada(autor)
    await asUser('admin@stjosep.org')
    await db.query("update public.excursions set estat='Aprovada' where id=$1",[id])
    await asUser(autor)
    return id
  }

  it('deixa que tothom vegi el pla sencer', async () => {
    await completa()
    await asUser('other@stjosep.org')
    expect((await db.query('select * from public.excursions')).rows).toHaveLength(1)
  })

  it('no deixa que un altre docent editi una proposta que no és seva', async () => {
    const id = await completa()
    await asUser('other@stjosep.org')
    expect((await db.query("update public.excursions set lloc='Un altre' where id=$1 returning id",[id])).rows).toHaveLength(0)
  })

  it('no deixa editar la pròpia excursió quan ja no és un esborrany', async () => {
    const id = await aprovada()
    await asUser('teacher@stjosep.org')
    expect((await db.query("update public.excursions set lloc='Un altre' where id=$1 returning id",[id])).rows).toHaveLength(0)
  })

  it('dona accés de gestió amb la casella, sense canviar el rol', async () => {
    const id = await completa()
    await asUser('admin@stjosep.org')
    await db.query("update public.usuaris set pot_gestionar_excursions=true where email='other@stjosep.org'")
    await asUser('other@stjosep.org')
    expect((await db.query("update public.excursions set lloc='Corregit' where id=$1 returning id",[id])).rows).toHaveLength(1)
  })

  it('nega qualsevol accés al convidat', async () => {
    await completa()
    await asUser('guest@stjosep.org')
    expect((await db.query('select * from public.excursions')).rows).toHaveLength(0)
  })

  it('assigna un codi llegible', async () => {
    const id = await completa()
    expect((await db.query<{codi:string}>('select codi from public.excursions where id=$1',[id])).rows[0].codi).toMatch(/^EXC-\d{3,}$/)
  })

  it('no deixa proposar una excursió a mitges', async () => {
    await asUser('teacher@stjosep.org')
    const id = (await db.query<{id:string}>("insert into public.excursions(etapa) values('EP') returning id")).rows[0].id
    await expect(db.query("update public.excursions set estat='Proposada' where id=$1",[id]))
      .rejects.toThrow('Falten dades')
  })

  it('no deixa proposar una excursió en un dia no lectiu', async () => {
    await asUser('admin@stjosep.org')
    await db.query(`insert into public.config values('centre.dies-no-lectius','["2026-10-19"]')`)
    const id = await completa()
    await expect(db.query("update public.excursions set estat='Proposada' where id=$1",[id]))
      .rejects.toThrow('no és lectiu')
  })

  it('tampoc no deixa proposar-la en cap de setmana', async () => {
    const id = await completa('teacher@stjosep.org', '2026-10-17')
    await expect(db.query("update public.excursions set estat='Proposada' where id=$1",[id]))
      .rejects.toThrow('no és lectiu')
  })

  it('segella qui proposa i quan, sense fiar-se del client', async () => {
    const id = await completa()
    await db.query("update public.excursions set estat='Proposada', proposada_per='altre@stjosep.org' where id=$1",[id])
    const row = (await db.query<{proposada_per:string;proposada_el:string}>('select proposada_per,proposada_el from public.excursions where id=$1',[id])).rows[0]
    expect(row.proposada_per).toBe('teacher@stjosep.org')
    expect(row.proposada_el).not.toBeNull()
  })

  it('no deixa que un docent aprovi la seva pròpia excursió', async () => {
    const id = await proposada()
    // RLS no llança: simplement la fila deixa de ser visible per actualitzar-la,
    // així que el disparador ni tan sols s'arriba a executar.
    expect((await db.query("update public.excursions set estat='Aprovada' where id=$1 returning id",[id])).rows).toHaveLength(0)
  })

  it('avisa els aprovadors una sola vegada al dia', async () => {
    await proposada()
    await proposada('other@stjosep.org')
    await asUser('admin@stjosep.org')   // els avisos només els llegeix qui els ha creat o la coordinació
    const avisos = (await db.query<{recipient:string}>("select recipient from public.notifications where event_key like 'excursions-pendents:%'")).rows
    expect(avisos.map(x=>x.recipient).sort()).toEqual(['admin@stjosep.org','director@stjosep.org'])
  })

  it('avisa qui la va proposar quan es resol, i exigeix el motiu del rebuig', async () => {
    const id = await proposada()
    await asUser('admin@stjosep.org')
    await db.exec('savepoint sense_motiu')
    await expect(db.query("update public.excursions set estat='Esborrany' where id=$1",[id]))
      .rejects.toThrow('per què es rebutja')
    await db.exec('rollback to savepoint sense_motiu')
    await db.query("update public.excursions set estat='Esborrany', motiu_rebuig='Falta el pressupost' where id=$1",[id])
    const n = (await db.query<{recipient:string}>("select recipient from public.notifications where event_key like 'excursio-resolta:%'")).rows
    expect(n).toHaveLength(1)
    expect(n[0].recipient).toBe('teacher@stjosep.org')
  })

  it('rebutja una transició que no existeix', async () => {
    const id = await completa()
    await asUser('admin@stjosep.org')
    await expect(db.query("update public.excursions set estat='Reservada' where id=$1",[id]))
      .rejects.toThrow('Transició no vàlida')
  })

  it('deixa marcar com a reservada només a qui gestiona', async () => {
    const id = await aprovada()
    expect((await db.query("update public.excursions set estat='Reservada' where id=$1 returning id",[id])).rows).toHaveLength(0)
    await asUser('admin@stjosep.org')
    await db.query("update public.excursions set estat='Reservada' where id=$1",[id])
    expect((await db.query<{reservada_per:string}>('select reservada_per from public.excursions where id=$1',[id])).rows[0].reservada_per)
      .toBe('admin@stjosep.org')
  })

  it('no deixa deixar una excursió reservada en un dia no lectiu', async () => {
    const id = await aprovada()
    await asUser('admin@stjosep.org')
    await db.query("update public.excursions set estat='Reservada' where id=$1",[id])
    // Sense canviar d'estat: només la data. Abans això passava sense validar-se.
    await expect(db.query("update public.excursions set data='2026-10-17' where id=$1",[id]))
      .rejects.toThrow('no és lectiu')
  })

  it('tampoc en un dia marcat com a no lectiu al calendari', async () => {
    const id = await aprovada()
    await asUser('admin@stjosep.org')
    await db.query(`insert into public.config values('centre.dies-no-lectius','["2026-11-02"]')`)
    await expect(db.query("update public.excursions set data='2026-11-02' where id=$1",[id]))
      .rejects.toThrow('no és lectiu')
  })

  it('però un esborrany sí que pot tenir una data provisional dolenta', async () => {
    const id = await completa()
    expect((await db.query("update public.excursions set data='2026-10-17' where id=$1 returning id",[id])).rows).toHaveLength(1)
  })

  it('i sempre es pot cancel·lar, encara que la data fos dolenta', async () => {
    const id = await completa()
    await db.query("update public.excursions set data='2026-10-19' where id=$1",[id])
    await db.query("update public.excursions set estat='Proposada' where id=$1",[id])
    await asUser('admin@stjosep.org')
    await db.query("update public.excursions set estat='Cancel·lada', motiu_cancellacio='Pluja' where id=$1",[id])
    expect((await db.query<{estat:string}>('select estat from public.excursions where id=$1',[id])).rows[0].estat).toBe('Cancel·lada')
  })

  it('deixa cancel·lar en qualsevol moment i avisa els acompanyants', async () => {
    // Els acompanyants s'afegeixen mentre encara és un esborrany: un cop
    // proposada, l'autor ja no pot tocar-ne les filles.
    const id = await completa()
    await db.query(`insert into public.excursio_acompanyants(excursio_id,email) values($1,'other@stjosep.org')`,[id])
    await db.query("update public.excursions set estat='Proposada' where id=$1",[id])
    await asUser('admin@stjosep.org')
    await db.query("update public.excursions set estat='Cancel·lada', motiu_cancellacio='Pluja' where id=$1",[id])
    const n = (await db.query<{recipient:string}>("select recipient from public.notifications where event_key like 'excursio-cancellada:%'")).rows
    expect(n.map(x=>x.recipient).sort()).toEqual(['other@stjosep.org','teacher@stjosep.org'])
  })
})
