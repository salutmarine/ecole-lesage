export const adminSections = [
    { id: 'planning', label: 'Planning', href: '/admin/planning', slug: 'planning' },
    { id: 'slots', label: 'Gestion des créneaux', href: '/admin/creneaux', slug: 'creneaux' },
    { id: 'settings', label: 'Gestion des cours', href: '/admin/cours', slug: 'cours' },
    { id: 'students', label: 'Liste des étudiants', href: '/admin/etudiants', slug: 'etudiants' },
    { id: 'teachers', label: 'Liste des professeurs', href: '/admin/professeurs', slug: 'professeurs' },
] as const
export type AdminSection = (typeof adminSections)[number]['id']
