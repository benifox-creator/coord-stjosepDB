import type { ReactNode } from 'react'
import {
  HelpCircle,
  LogIn,
  ShieldCheck,
  Compass,
  Mail,
  Info,
  AlertTriangle,
  LayoutDashboard,
  Package,
  Archive,
  Smartphone,
  CalendarDays,
  UserCheck,
  BookOpen,
  Target,
  Wrench,
  Settings,
} from 'lucide-react'

function Term({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.8em] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
      {children}
    </span>
  )
}

function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn'
  title?: string
  children: ReactNode
}) {
  const styles =
    tone === 'warn'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-secondary/5 border-secondary/20 text-text-main'
  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed ${styles}`}>
      {title && (
        <p className="font-mono text-[0.7rem] uppercase tracking-wide mb-1 text-gray-500">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

function PermBox({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid gap-2 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[1fr,1.6fr] sm:grid-cols-[9rem,1fr] gap-2">
          <span className="font-semibold text-text-main">{r.label}</span>
          <span className="text-gray-500">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function FieldList({ rows }: { rows: { term: string; desc: ReactNode }[] }) {
  return (
    <dl className="bg-white border border-gray-200 rounded-xl p-4 grid gap-2.5">
      {rows.map((r) => (
        <div key={r.term} className="grid grid-cols-1 sm:grid-cols-[9rem,1fr] gap-1 sm:gap-3">
          <dt className="font-mono text-xs text-primary">{r.term}</dt>
          <dd className="text-sm text-gray-500 m-0">{r.desc}</dd>
        </div>
      ))}
    </dl>
  )
}

function ModuleSection({
  id,
  icon: Icon,
  title,
  purpose,
  children,
}: {
  id: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  purpose: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6 pt-10 border-t border-gray-200 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={18} className="text-primary" />
        </div>
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-wide text-gray-400">Mòdul</p>
          <h2 className="text-lg font-semibold text-text-main">{title}</h2>
        </div>
      </div>
      <p className="text-gray-500 max-w-2xl">{purpose}</p>
      {children}
    </section>
  )
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-primary mt-5 mb-2">{children}</h3>
}

function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group bg-white border border-gray-200 rounded-xl px-4 py-3 open:pb-4">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-medium text-sm text-text-main">
        {q}
        <span className="text-gray-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
      </summary>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed">{children}</p>
    </details>
  )
}

const TOC = [
  { id: 'primers-passos', label: 'Primers passos' },
  { id: 'acces', label: 'Com accedir-hi' },
  { id: 'rols', label: 'Rols i permisos' },
  { id: 'navegacio', label: 'Navegació' },
  { id: 'mod-dashboard', label: 'Dashboard' },
  { id: 'mod-incidencies', label: 'Incidències' },
  { id: 'mod-inventari', label: 'Inventari' },
  { id: 'mod-material', label: 'Material i Stock' },
  { id: 'mod-prestecs', label: 'Préstecs' },
  { id: 'mod-reserves', label: 'Reserves' },
  { id: 'mod-substitucions', label: 'Substitucions' },
  { id: 'mod-coneixement', label: 'Base Coneixement' },
  { id: 'mod-pla-accio', label: "Pla d'Acció" },
  { id: 'mod-manteniment', label: 'Manteniment' },
  { id: 'configuracio', label: 'Configuració' },
  { id: 'notificacions', label: 'Correus automàtics' },
  { id: 'faq', label: 'Preguntes freqüents' },
]

export function AjudaPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-14">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Compass size={20} className="text-white" />
          </div>
          <p className="font-mono text-xs uppercase tracking-wide text-gray-400">
            Guia per a un usuari nou
          </p>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main">Benvinguda a SJO Hub</h1>
        <p className="text-gray-500 mt-2 max-w-2xl">
          Aquesta guia explica, pas a pas, tot el que pots fer avui dins l'aplicació interna de
          coordinació TIC del Col·legi Sant Josep Obrer: des d'iniciar sessió fins a fer servir
          cadascun dels mòduls segons el teu rol.
        </p>

        {/* Índex ràpid */}
        <div className="mt-6 flex flex-wrap gap-1.5">
          {TOC.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>

      {/* Primers passos */}
      <section id="primers-passos" className="scroll-mt-6 space-y-3">
        <h2 className="text-lg font-semibold text-text-main">Primers passos</h2>
        <p className="text-gray-500">Si és el primer cop que obres l'aplicació, aquest és el camí recomanat:</p>
        <ol className="space-y-2">
          {[
            <>Inicia sessió amb el teu compte de Google del centre (<Term>@stjosep.org</Term>). Si algú del centre ja t'ha donat d'alta, entraràs directament amb el rol que et correspon.</>,
            <>Mira el <a className="text-secondary underline" href="#mod-dashboard">Dashboard</a>: t'hi trobaràs un resum de l'estat actual (incidències obertes, préstecs vençuts, reserves d'avui...).</>,
            <>Explora el menú lateral: només hi veuràs els mòduls que el coordinador TIC ha fet visibles per al teu rol.</>,
            <>Prova a crear el teu primer registre — per exemple, una incidència des del mòdul <a className="text-secondary underline" href="#mod-incidencies">Incidències</a> — per veure com funciona un formulari típic.</>,
            <>Si et falta accés a algun mòdul o vols un rol diferent, contacta amb el coordinador TIC del centre: ell és qui gestiona els usuaris.</>,
          ].map((text, i) => (
            <li key={i} className="flex gap-3 bg-white border border-gray-200 rounded-xl p-3.5">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-mono font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-gray-600 leading-relaxed">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Accés */}
      <section id="acces" className="scroll-mt-6 pt-10 border-t border-gray-200 space-y-3">
        <div className="flex items-center gap-2">
          <LogIn size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-main">Com accedir-hi</h2>
        </div>
        <p className="text-gray-500">
          L'accés es fa amb un únic botó: <Term>Accedeix amb Google</Term>. No hi ha usuari i
          contrasenya propis de l'aplicació — s'utilitza el teu compte de Google del centre.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>Només es poden fer servir comptes del domini <Term>@stjosep.org</Term>. Si intentes entrar amb un altre compte, la sessió es tanca automàticament i et porta a una pantalla d'"accés no autoritzat".</li>
          <li>Si el teu correu encara no ha estat donat d'alta pel coordinador TIC, veuràs una pantalla de <em>Sense accés</em>. És normal: cal que et registrin abans amb un rol.</li>
          <li>Si el token de Google caduca, apareix l'avís "Cal reconnectar per accedir a les dades" amb un botó <Term>Reconnecta amb Google</Term>.</li>
          <li>Per tancar sessió, utilitza la icona de sortida sota el teu nom, a la part inferior del menú lateral.</li>
        </ul>
        <Callout title="Detall tècnic útil">
          En iniciar sessió també es demana permís per enviar correus en el teu nom (Gmail). Aquest
          permís és el que fa possible els avisos automàtics que envia l'aplicació — es tracten a la
          secció <a className="text-secondary underline" href="#notificacions">Correus automàtics</a>.
        </Callout>
      </section>

      {/* Rols */}
      <section id="rols" className="scroll-mt-6 pt-10 border-t border-gray-200 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-main">Rols i permisos</h2>
        </div>
        <p className="text-gray-500">
          Cada persona té assignat un únic rol, que determina què pot veure i què pot fer a cada
          mòdul. El coordinador TIC és qui assigna i canvia rols des de{' '}
          <a className="text-secondary underline" href="#configuracio">Configuració</a>.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            ['Coordinador TIC', 'Accés total: pot crear, editar, eliminar i configurar qualsevol cosa de l’aplicació, a tots els mòduls. És l’únic rol que pot entrar a Configuració.'],
            ['Direcció', 'Pot crear i editar registres a la majoria de mòduls (canviar estats, assignar, gestionar), però no pot eliminar-ne cap ni entrar a Configuració.'],
            ["Cap d'Estudis", 'Mateix nivell que Direcció: crear i editar, sense permís d’eliminació ni accés a Configuració.'],
            ['Professorat', 'Pot crear registres nous (incidències, reserves, avisos de manteniment...) i consultar la informació dels mòduls visibles per a aquest rol.'],
            ['Convidat', 'Pensat per a accés de només lectura. A la pràctica actual, encara pot crear incidències, reserves i avisos de manteniment, però mai pot editar, canviar estats ni eliminar res.'],
          ].map(([title, desc]) => (
            <div key={title} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="font-semibold text-primary text-sm">{title}</p>
              <p className="text-sm text-gray-500 mt-1">{desc}</p>
            </div>
          ))}
        </div>
        <Callout tone="warn" title="Bo de saber">
          El que pots fer a cada mòdul concret (crear, gestionar, eliminar) es detalla al final de
          cada secció de mòdul d'aquesta guia, amb el requadre "Qui ho pot fer". El coordinador TIC
          també decideix, des de Configuració → Visibilitat de mòduls, quins mòduls veu cada rol —
          per això és normal que dues persones vegin menús diferents.
        </Callout>
      </section>

      {/* Navegació */}
      <section id="navegacio" className="scroll-mt-6 pt-10 border-t border-gray-200 space-y-3">
        <h2 className="text-lg font-semibold text-text-main">Navegació general</h2>
        <p className="text-gray-500">
          El menú lateral esquerre és el punt de partida per moure't per l'aplicació: <Term>Dashboard</Term>,{' '}
          <Term>Incidències</Term>, <Term>Inventari</Term>, <Term>Material i Stock</Term>, <Term>Préstecs</Term>,{' '}
          <Term>Reserves</Term>, <Term>Substitucions</Term>, <Term>Base Coneixement</Term>, <Term>Pla d'Acció</Term> i{' '}
          <Term>Manteniment</Term>. Al final apareix <Term>Configuració</Term>, només si el teu rol és Coordinador TIC.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li>El Dashboard és sempre visible per a tothom; la resta de mòduls es mostren o s'amaguen segons la visibilitat configurada per rol.</li>
          <li>A mòbil, el menú es converteix en un panell que s'obre amb el botó de tres ratlles de la part superior.</li>
          <li>El teu nom i avatar apareixen a la part inferior del menú, amb el botó de tancar sessió al costat.</li>
        </ul>
      </section>

      {/* DASHBOARD */}
      <ModuleSection id="mod-dashboard" icon={LayoutDashboard} title="Dashboard" purpose="La primera pantalla que veus en entrar. Dona un cop d'ull ràpid a l'estat general de la part TIC del centre, amb accessos directes a la resta de mòduls.">
        <SubHeading>Què hi trobaràs</SubHeading>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>Salutació personalitzada amb la data d'avui.</li>
          <li>Un avís destacat si hi ha préstecs vençuts o incidències de prioritat alta pendents.</li>
          <li>Targetes numèriques clicables: incidències obertes, alta prioritat, préstecs actius, préstecs vençuts, reserves d'avui i dispositius en reparació.</li>
          <li>Accessos ràpids a Incidències, Inventari, Préstecs, Material i Reserves.</li>
          <li>Taules amb les incidències obertes i els préstecs actius/vençuts més recents.</li>
          <li>Reserves dels propers 7 dies, amb el dia d'avui ressaltat.</li>
        </ul>
        <Callout>Només veuràs les targetes i taules dels mòduls als quals tens accés.</Callout>
      </ModuleSection>

      {/* INCIDENCIES */}
      <ModuleSection id="mod-incidencies" icon={AlertTriangle} title="Incidències" purpose="Per reportar i fer seguiment d'avaries o problemes tècnics: ordinadors, xarxa, projectors, impressores, etc.">
        <SubHeading>Què pots fer</SubHeading>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>Crear un nou tiquet amb el botó <Term>Nova incidència</Term>.</li>
          <li>Cercar per número de tiquet, ubicació o descripció, i filtrar per estat, prioritat o tipus.</li>
          <li>Obrir el detall d'una incidència per veure tot l'historial.</li>
          <li>Si tens permís de gestió: canviar l'estat, assignar-la a algú i afegir-hi comentaris interns.</li>
        </ul>
        <SubHeading>En crear una incidència, se't demanarà:</SubHeading>
        <FieldList rows={[
          { term: 'Tipus de problema', desc: "Llista configurada pel centre, amb l'opció \"Altre\"." },
          { term: 'Localització', desc: 'Text lliure amb suggeriments.' },
          { term: 'Dispositiu', desc: "De l'inventari existent, o text lliure si no hi és." },
          { term: 'Prioritat', desc: 'Alta, Mitjana o Baixa.' },
          { term: 'Descripció detallada', desc: 'Mínim 20 caràcters, amb comptador en viu.' },
        ]} />
        <PermBox rows={[
          { label: 'Crear', value: 'Qualsevol persona amb accés al mòdul' },
          { label: 'Gestionar', value: 'Coordinador TIC, Direcció, Cap d’Estudis' },
          { label: 'Eliminar', value: 'Només Coordinador TIC' },
        ]} />
        <Callout title="Automatisme">
          Quan una incidència es marca com a <Term>Tancada</Term>, s'envia automàticament un correu de
          resolució a qui la va reportar. Si l'enviament falla, apareix un avís per reintentar-ho manualment.
        </Callout>
      </ModuleSection>

      {/* INVENTARI */}
      <ModuleSection id="mod-inventari" icon={Package} title="Inventari" purpose="El catàleg de tots els dispositius TIC del centre: portàtils, ordinadors, tauletes, projectors, impressores, switches, monitors, servidors...">
        <SubHeading>Què pots fer</SubHeading>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>Cercar per nom, marca, ubicació o número de sèrie, i filtrar per estat o categoria.</li>
          <li>Consultar la fitxa completa de cada dispositiu.</li>
          <li>Si ets Coordinador TIC: donar d'alta nous dispositius, editar-ne les dades i eliminar-los.</li>
        </ul>
        <SubHeading>Fitxa d'un dispositiu</SubHeading>
        <FieldList rows={[
          { term: 'Nom / Categoria / Marca / Model', desc: 'Dades bàsiques d’identificació.' },
          { term: 'Núm. sèrie / Ubicació', desc: 'Per localitzar-lo físicament.' },
          { term: 'Estat', desc: 'Actiu, En reparació, En préstec o De baixa.' },
          { term: 'Compra / Garantia', desc: 'L’aplicació calcula sola si la garantia és vigent.' },
          { term: 'MAC / IP', desc: 'Dades de xarxa opcionals.' },
        ]} />
        <PermBox rows={[
          { label: 'Crear', value: 'Només Coordinador TIC' },
          { label: 'Editar', value: 'Només Coordinador TIC' },
          { label: 'Eliminar', value: 'Només Coordinador TIC' },
        ]} />
        <Callout>La resta de rols amb accés a aquest mòdul poden consultar-lo, però només en mode lectura.</Callout>
      </ModuleSection>

      {/* MATERIAL */}
      <ModuleSection id="mod-material" icon={Archive} title="Material i Stock" purpose="Control d'estoc de material fungible i petits accessoris (cables, adaptadors, ratolins, teclats, llapis USB...), diferent de l'Inventari de dispositius grans.">
        <SubHeading>Què pots fer</SubHeading>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>Cercar i filtrar per categoria.</li>
          <li>Donar d'alta un nou material amb <Term>Nou material</Term> (obert a tothom amb accés al mòdul).</li>
          <li>Si tens permís de gestió: editar la fitxa i les notes.</li>
          <li>Si ets Coordinador TIC: donar de baixa un material (elimina el registre).</li>
        </ul>
        <SubHeading>En donar d'alta un material</SubHeading>
        <FieldList rows={[
          { term: 'Nom / Categoria', desc: 'Identificació i tipus de material.' },
          { term: 'Quantitat total', desc: 'Unitats disponibles al centre.' },
          { term: 'Descripció / Ubicació / Notes', desc: 'Informació addicional.' },
        ]} />
        <PermBox rows={[
          { label: 'Crear', value: 'Qualsevol persona amb accés al mòdul' },
          { label: 'Editar', value: 'Coordinador TIC, Direcció, Cap d’Estudis' },
          { label: 'Donar de baixa', value: 'Només Coordinador TIC' },
        ]} />
        <Callout tone="warn" title="Alerta d'estoc">
          Quan la quantitat disponible d'un material baixa del 20%, apareix un avís destacat a la
          llista general i a la fitxa de l'ítem afectat.
        </Callout>
      </ModuleSection>

      {/* PRESTECS */}
      <ModuleSection id="mod-prestecs" icon={Smartphone} title="Préstecs" purpose="Registre de préstecs de dispositius (i, opcionalment, material) a professorat o personal del centre, amb data de retorn prevista.">
        <SubHeading>Què pots fer</SubHeading>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>Consultar i filtrar préstecs per estat.</li>
          <li>Si ets Coordinador TIC: crear un nou préstec.</li>
          <li>Si tens permís de gestió: marcar-lo com a retornat, canviar-ne l'estat o editar notes.</li>
        </ul>
        <SubHeading>En crear un préstec</SubHeading>
        <FieldList rows={[
          { term: 'Dispositiu', desc: "ID i nom del dispositiu (text lliure permès)." },
          { term: 'Usuari / Correu', desc: 'Qui rep el préstec.' },
          { term: 'Dates', desc: "Inici i retorn previst, o casella \"Préstec de temps il·limitat\"." },
          { term: 'Material del préstec', desc: 'Es pot afegir material del stock disponible.' },
        ]} />
        <PermBox rows={[
          { label: 'Crear', value: 'Només Coordinador TIC' },
          { label: 'Gestionar', value: 'Coordinador TIC, Direcció, Cap d’Estudis' },
          { label: 'Eliminar', value: 'Només Coordinador TIC' },
        ]} />
        <Callout>
          L'estat (Actiu / Retornat / Vençut) es calcula automàticament segons la data. A 3 dies o
          menys del retorn, o si ja s'ha passat, apareix un avís de color a la llista.
        </Callout>
      </ModuleSection>

      {/* RESERVES */}
      <ModuleSection id="mod-reserves" icon={CalendarDays} title="Reserves" purpose="Per reservar espais del centre — aula d'informàtica, sala de reunions, sala d'actes, biblioteca, gimnàs, etc. — per a una activitat concreta.">
        <SubHeading>Què pots fer</SubHeading>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>Consultar un calendari mensual amb un punt de color per espai; clicar un dia filtra la taula.</li>
          <li>Crear una reserva, obert a tothom amb accés al mòdul.</li>
          <li>Si tens permís de gestió: confirmar, cancel·lar o editar una reserva.</li>
        </ul>
        <SubHeading>En crear una reserva</SubHeading>
        <FieldList rows={[
          { term: 'Espai', desc: 'Llista configurada pel centre.' },
          { term: 'Usuari / Correu', desc: 'Qui fa la reserva.' },
          { term: 'Data / Hores', desc: "Franja horària concreta (inici i fi)." },
          { term: 'Motiu', desc: 'Obligatori.' },
        ]} />
        <PermBox rows={[
          { label: 'Crear', value: 'Qualsevol persona amb accés al mòdul' },
          { label: 'Confirmar / gestionar', value: 'Coordinador TIC, Direcció, Cap d’Estudis' },
          { label: 'Eliminar', value: 'Només Coordinador TIC' },
        ]} />
        <Callout title="Important">
          Si qui crea la reserva és el Coordinador TIC, es confirma automàticament. Per a la resta
          de rols, queda com a <Term>Pendent</Term> i s'envia un correu a tots els coordinadors.
        </Callout>
      </ModuleSection>

      {/* SUBSTITUCIONS */}
      <ModuleSection id="mod-substitucions" icon={UserCheck} title="Substitucions" purpose="Gestió i estadístiques de les substitucions de professorat absent (classe o pati), organitzades per etapa educativa.">
        <SubHeading>Què pots fer</SubHeading>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>Vista <Term>Setmanal</Term>: graella de dilluns a divendres, amb una targeta per substitució.</li>
          <li>Vista <Term>Estadístiques</Term>: gràfics per professor i rànquing, filtrable per mes, trimestre o curs.</li>
          <li>Marcar una substitució com a <Term>Realitzada</Term> — qualsevol persona ho pot fer.</li>
          <li>Si tens permís de gestió: crear noves substitucions i eliminar-ne.</li>
        </ul>
        <SubHeading>En crear una substitució</SubHeading>
        <FieldList rows={[
          { term: 'Data / Tipus', desc: 'Classe o Pati.' },
          { term: 'Etapa', desc: 'Cicle educatiu afectat.' },
          { term: 'Franja horària', desc: "Text lliure, amb suggeriment segons l'etapa." },
          { term: 'Absent / Substitut', desc: "De la llista d'usuaris registrats (no poden coincidir)." },
          { term: 'Grup / Matèria', desc: 'Només si el tipus és "Classe".' },
        ]} />
        <PermBox rows={[
          { label: 'Crear / gestionar / eliminar', value: 'Coordinador TIC, Direcció, Cap d’Estudis' },
          { label: 'Marcar com a realitzada', value: 'Qualsevol persona amb accés al mòdul' },
        ]} />
        <Callout title="Automatisme">
          En crear una substitució, el professor substitut rep automàticament un correu avisant-lo.
          Les substitucions cancel·lades no compten a les estadístiques.
        </Callout>
      </ModuleSection>

      {/* CONEIXEMENT */}
      <ModuleSection id="mod-coneixement" icon={BookOpen} title="Base de Coneixement" purpose="Una petita wiki interna amb manuals, guies i procediments habituals per a consulta del personal del centre.">
        <SubHeading>Què pots fer</SubHeading>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>Cercar per títol, etiquetes o contingut, i filtrar per categoria.</li>
          <li>Obrir un article per llegir-lo sencer, amb enllaços externs si en té.</li>
          <li>Si ets Coordinador TIC: crear, editar, publicar (o tornar a esborrany) i eliminar articles.</li>
        </ul>
        <SubHeading>En crear un article</SubHeading>
        <FieldList rows={[
          { term: 'Títol / Categoria', desc: "Identificació de l'article." },
          { term: 'Contingut', desc: 'Text llarg amb l’explicació o el procediment.' },
          { term: 'Paraules clau', desc: 'Etiquetes separades per comes.' },
          { term: 'Enllaços externs', desc: 'Fins a 5, amb etiqueta i URL.' },
          { term: 'Publicat', desc: 'En esborrany, només el veu el coordinador; publicat, el veu tothom.' },
        ]} />
        <PermBox rows={[
          { label: 'Crear / editar / publicar / eliminar', value: 'Només Coordinador TIC' },
          { label: 'Consultar', value: 'Tothom — només els articles ja publicats' },
        ]} />
      </ModuleSection>

      {/* PLA D'ACCIO */}
      <ModuleSection id="mod-pla-accio" icon={Target} title="Pla d'Acció" purpose="Planificació de projectes TIC a mitjà termini, amb tasques associades i seguiment del progrés.">
        <SubHeading>Què pots fer</SubHeading>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>Veure els projectes en vista <Term>Kanban</Term> (Pendent / En curs / Completada / Bloquejada) o <Term>Llista</Term>.</li>
          <li>Clicar la targeta d'un projecte per filtrar-ne només les tasques.</li>
          <li>Si tens permís de gestió: crear projectes i tasques, editar-los, canviar-ne l'estat i eliminar-los.</li>
        </ul>
        <SubHeading>Camps principals</SubHeading>
        <FieldList rows={[
          { term: 'Projecte', desc: 'Nom, Descripció, Categoria, Estat, Responsable, dates.' },
          { term: 'Tasca', desc: 'Projecte, Títol, Descripció, Prioritat, Estat, Responsable, Data límit.' },
        ]} />
        <PermBox rows={[
          { label: 'Crear / editar / eliminar', value: 'Coordinador TIC, Direcció, Cap d’Estudis' },
          { label: 'Consultar', value: 'Tothom amb accés al mòdul' },
        ]} />
        <Callout>Cada projecte mostra una barra de progrés segons les tasques completades, i les tasques vençudes es marquen amb un avís visual.</Callout>
      </ModuleSection>

      {/* MANTENIMENT */}
      <ModuleSection id="mod-manteniment" icon={Wrench} title="Manteniment" purpose="Per reportar desperfectes d'infraestructura no estrictament TIC: persianes, portes, mobiliari, electricitat, fontaneria, pintura...">
        <SubHeading>Què pots fer</SubHeading>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>Reportar un desperfecte amb <Term>Reportar desperfecte</Term>, obert a tothom amb accés al mòdul.</li>
          <li>Cercar i filtrar per estat o categoria.</li>
          <li>Si tens permís de gestió: canviar l'estat o eliminar un report.</li>
        </ul>
        <SubHeading>En reportar un desperfecte</SubHeading>
        <FieldList rows={[
          { term: 'Descripció breu', desc: 'Títol del report, obligatori.' },
          { term: 'Categoria', desc: 'Persianes, Portes/Finestres, Mobiliari, Electricitat, Fontaneria, Pintura, Altres.' },
          { term: 'Prioritat', desc: 'Urgent, Normal o Baixa.' },
          { term: 'Localització / Descripció / Notes', desc: 'Detalls addicionals.' },
        ]} />
        <PermBox rows={[
          { label: 'Crear', value: 'Qualsevol persona amb accés al mòdul' },
          { label: 'Gestionar / eliminar', value: 'Coordinador TIC, Direcció, Cap d’Estudis' },
        ]} />
        <Callout title="Automatisme">
          Si el centre ha configurat un correu de responsable de manteniment, aquesta persona rep un
          avís automàtic cada cop que es reporta un desperfecte nou.
        </Callout>
      </ModuleSection>

      {/* CONFIGURACIO */}
      <section id="configuracio" className="scroll-mt-6 pt-10 border-t border-gray-200 space-y-3">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-main">Configuració</h2>
          <span className="text-[0.65rem] font-mono uppercase tracking-wide text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            Només Coordinador TIC
          </span>
        </div>
        <p className="text-gray-500">
          Aquest mòdul només apareix al menú, i només s'hi pot entrar, si el teu rol és Coordinador
          TIC. És des d'aquí que es personalitza tota l'aplicació per al centre.
        </p>
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Secció</th>
                <th className="px-4 py-2.5 font-medium">Per a què serveix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['Usuaris i permisos', "Donar d'alta persones abans que iniciïn sessió (Email, Nom opcional i Rol), i canviar el rol de qualsevol usuari existent."],
                ['Visibilitat de mòduls', 'Taula de caselles per marcar quins mòduls veu cada rol (Direcció, Cap d’Estudis, Professorat, Convidat). El Coordinador TIC sempre té accés a tots.'],
                ['Manteniment', 'Correu del responsable de manteniment, on arriben els avisos de desperfectes.'],
                ['Llistes editables', 'Espais de reserves, categories de material i inventari, tipus de problema i localitzacions d’incidències, categories d’articles. Cada llista es pot restaurar als valors per defecte.'],
              ].map(([title, desc]) => (
                <tr key={title}>
                  <td className="px-4 py-3 font-medium text-text-main align-top whitespace-nowrap">{title}</td>
                  <td className="px-4 py-3 text-gray-500 align-top">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="warn" title="Encara no configurable des de la pantalla">
          Les categories de Pla d'Acció i els grups/franges horàries de Substitucions tenen valors
          per defecte al sistema, però de moment no es poden editar des d'aquesta pantalla.
        </Callout>
      </section>

      {/* NOTIFICACIONS */}
      <section id="notificacions" className="scroll-mt-6 pt-10 border-t border-gray-200 space-y-3">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-main">Correus automàtics</h2>
        </div>
        <p className="text-gray-500">
          L'aplicació no té una campaneta ni un centre de notificacions dins de la pantalla — tots
          els avisos es fan per correu electrònic, enviats amb el compte de Gmail de qui fa l'acció
          (no des d'un compte del sistema). Per això, en iniciar sessió es demana permís d'enviament
          de correu.
        </p>
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Acció</th>
                <th className="px-4 py-2.5 font-medium">Qui rep el correu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['Tancar una incidència', 'La persona que la va reportar, amb el resum de la resolució.'],
                ['Crear una reserva no confirmada automàticament', 'Tots els usuaris amb rol Coordinador TIC.'],
                ['Crear una substitució', 'El professor substitut assignat.'],
                ['Reportar un desperfecte de manteniment', 'El responsable de manteniment configurat (si n’hi ha un).'],
              ].map(([title, desc]) => (
                <tr key={title}>
                  <td className="px-4 py-3 font-medium text-text-main align-top">{title}</td>
                  <td className="px-4 py-3 text-gray-500 align-top">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout>
          Si l'enviament d'un correu falla (per exemple, per sessió caducada), l'acció principal es
          completa igualment. En alguns casos veuràs un avís per reintentar-ho; en d'altres, el
          correu simplement no arribarà, sense donar cap error visible.
        </Callout>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-6 pt-10 border-t border-gray-200 space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-main">Preguntes freqüents</h2>
        </div>
        <div className="space-y-2.5">
          <FaqItem q='Veig la pantalla "Sense accés" en iniciar sessió'>
            Vol dir que el teu correu encara no ha estat donat d'alta al sistema. Contacta amb el
            coordinador TIC del centre perquè et registri amb el rol que et correspon.
          </FaqItem>
          <FaqItem q="No veig un mòdul que abans hi era, o que un company sí que veu">
            Cada mòdul es mostra o s'amaga segons el teu rol, ajustat pel coordinador TIC a
            Configuració → Visibilitat de mòduls. És normal que rols diferents vegin menús diferents.
          </FaqItem>
          <FaqItem q="No puc editar, canviar l'estat ni eliminar un registre">
            Depèn del teu rol. Consulta el requadre "Qui ho pot fer" de cada mòdul en aquesta guia —
            eliminar sol estar reservat al Coordinador TIC.
          </FaqItem>
          <FaqItem q='Apareix l’avís "Cal reconnectar per accedir a les dades"'>
            El teu token de sessió de Google ha caducat. Fes clic a "Reconnecta amb Google" i torna-ho
            a provar.
          </FaqItem>
          <FaqItem q="He fet una acció però el correu automàtic no ha arribat">
            L'enviament de correus pot fallar sense bloquejar l'acció principal. Torna-ho a intentar
            més tard o avisa el coordinador TIC si es repeteix.
          </FaqItem>
          <FaqItem q="Vull canviar el meu propi rol">
            No és possible fer-ho un mateix — ni el Coordinador TIC pot canviar-se el rol des de la
            llista d'usuaris. Cal que un altre Coordinador TIC ho faci.
          </FaqItem>
        </div>
      </section>

      <footer className="pt-8 border-t border-gray-200 text-xs text-gray-400 flex items-start gap-2">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>
          Guia d'ús de SJO Hub (Col·legi Sant Josep Obrer) — reflecteix les
          funcionalitats disponibles a data d'avui. El coordinador TIC pot ampliar-la a mesura que
          s'afegeixin mòduls nous.
        </p>
      </footer>
    </div>
  )
}
