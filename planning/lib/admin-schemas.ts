import { z } from 'zod'

export const teacherSchema = z.object({
    firstName: z.string().trim().min(1, 'Le prénom est obligatoire.').max(100),
    lastName: z.string().trim().min(1, 'Le nom est obligatoire.').max(100),
    email: z.string().trim().toLowerCase().email('Adresse email invalide.').max(254),
})
export const courseTemplateSchema = z.object({
    level: z.enum(['INITIATION', 'PERFECTIONNEMENT', 'SPECIALISATION']).default('INITIATION'),
    name: z.string().trim().min(1, 'Le nom du cours est obligatoire.').max(200),
    totalDurationMinutes: z.number().int().min(15).max(600000).multipleOf(15).nullable().default(null),
    durationMinutes: z.number().int().min(15).max(720).multipleOf(15),
    capacity: z.number().int().min(1).max(100),
    reminderDays: z.number().int().min(0).max(365).nullable().default(1),
    cancellationHours: z.number().int().min(0).max(8760).default(48),
    defaultTeacherId: z.string().min(1).nullable(),
    bookingDelayHours: z.number().int().min(0).max(8760).default(72),
    minGapHours: z.number().int().min(0).max(8760).default(48),
})

export const studentSchema = teacherSchema.extend({
    language: z.enum(['fr', 'en', 'ja']).default('fr'),
    phone: z.string().trim().max(40, 'Le téléphone ne peut pas dépasser 40 caractères.').nullable(),
})

export const entitlementAdjustmentSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('add-course'),
        userId: z.string().min(1),
        courseId: z.string().min(1),
        sessions: z.number().int().min(1).max(1000),
        expiresAt: z.string().datetime(),
    }),
    z.object({
        action: z.literal('add-sessions'),
        userId: z.string().min(1),
        entitlementId: z.string().min(1),
        sessions: z.number().int().min(1).max(1000),
    }),
])
