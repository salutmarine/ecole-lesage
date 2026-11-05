export const courseLevels = {
    INITIATION: 'Initiation',
    PERFECTIONNEMENT: 'Perfectionnement',
    SPECIALISATION: 'Spécialisation',
} as const
export type CourseLevel = keyof typeof courseLevels
