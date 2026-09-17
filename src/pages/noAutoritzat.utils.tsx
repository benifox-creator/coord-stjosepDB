import type { ReactNode } from 'react'

/** Per què algú ha acabat a la pàgina de sense accés. */
export type MotiuSenseAcces = 'domini-no-autoritzat' | 'correu-no-disponible' | 'sense-acces'

export interface Explicacio {
  titol: string
  text: ReactNode
  detall?: ReactNode
}

/**
 * Tres situacions ben diferents acaben a la mateixa pantalla, i abans totes
 * es explicaven amb el missatge del domini. A qui entrava per primer cop amb
 * un compte del centre donat d'alta per avançat se li deia que el seu correu
 * @stjosep.org no era del domini @stjosep.org, cosa que envia a investigar
 * un problema de Google Workspace que no existeix.
 */
export function explicacio(motiu: string, email: string): Explicacio {
  switch (motiu) {
    case 'correu-no-disponible':
      return {
        titol: 'No s’ha pogut completar l’entrada',
        text: <>No s’ha pogut llegir el correu del teu compte de Google.</>,
        detall: <>Torna-ho a provar. Si és el teu primer accés, sovint funciona al segon intent.</>,
      }
    case 'sense-acces':
      return {
        titol: 'Sense accés',
        text: email
          ? <>El compte <strong>{email}</strong> encara no té l’accés activat a SJO Hub.</>
          : <>El teu compte encara no té l’accés activat a SJO Hub.</>,
        detall: <>El compte és correcte; només falta que la coordinació TIC l’activi. Demana-l’hi.</>,
      }
    default:
      return {
        titol: 'Accés no autoritzat',
        text: <>Aquest portal és exclusiu per a comptes <strong>@stjosep.org</strong>. El teu compte de Google no pertany a aquest domini.</>,
      }
  }
}
