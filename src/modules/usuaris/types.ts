export type Rol = 'coordinador' | 'direccio' | 'cap_estudis' | 'professorat' | 'convidat'

export interface Usuari {
  id: string
  Email: string
  Nom: string
  Rol: Rol
  Data_alta: string
}

export const ROL_LABELS: Record<Rol, string> = {
  coordinador: 'Coordinador TIC',
  direccio: 'Direcció',
  cap_estudis: "Cap d'Estudis",
  professorat: 'Professorat',
  convidat: 'Convidat',
}

export const ROL_COLORS: Record<Rol, string> = {
  coordinador: 'bg-red-100 text-red-700 border-red-200',
  direccio: 'bg-purple-100 text-purple-700 border-purple-200',
  cap_estudis: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  professorat: 'bg-blue-100 text-blue-700 border-blue-200',
  convidat: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const ROL_DESCRIPCIONS: Record<Rol, string> = {
  coordinador: 'Accés total: crear, editar, eliminar i configurar',
  direccio: 'Pot crear i editar registres, però no eliminar',
  cap_estudis: 'Pot crear i editar registres, però no eliminar',
  professorat: 'Pot crear registres nous (incidències, reserves…)',
  convidat: 'Sols lectura: pot veure però no modificar res',
}

export const ROLS: Rol[] = ['coordinador', 'direccio', 'cap_estudis', 'professorat', 'convidat']
