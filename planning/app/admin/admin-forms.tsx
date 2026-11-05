'use client'
import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { courseLevels, type CourseLevel } from '@/lib/course-levels'

function useCreateForm(
    endpoint: string,
    success: string,
    method = 'POST',
    onSuccess?: () => void,
    onBusyChange?: (busy: boolean) => void,
    onNotify?: (message: string) => void,
) {
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState(false)
    async function submit(event: React.FormEvent<HTMLFormElement>, payload: Record<string, unknown>) {
        event.preventDefault()
        if (busy) return
        const form = event.currentTarget
        setBusy(true)
        onBusyChange?.(true)
        setMessage('')
        setError(false)
        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Enregistrement impossible.')
            if (method === 'POST') form.reset()
            onSuccess?.()
            router.refresh()
            if (onNotify) onNotify(success)
            else setMessage(success)
        } catch (e) {
            setError(true)
            setMessage(e instanceof Error ? e.message : 'Enregistrement impossible.')
        } finally {
            setBusy(false)
            onBusyChange?.(false)
        }
    }
    return {
        busy,
        submit,
        feedback: message ? (
            <p className={error ? 'error' : 'muted'} role={error ? 'alert' : 'status'}>
                {message}
            </p>
        ) : null,
    }
}

export function TeacherForm({
    teacher,
    onSaved,
    onCancel,
    onNotify,
    onBusyChange,
}: {
    teacher?: { id: string; firstName: string; lastName: string; email: string }
    onSaved?: () => void
    onCancel?: () => void
    onBusyChange?: (busy: boolean) => void
    onNotify?: (message: string) => void
}) {
    const { busy, submit, feedback } = useCreateForm(
        '/api/admin/teachers',
        teacher ? 'Professeur modifié.' : 'Professeur ajouté.',
        teacher ? 'PATCH' : 'POST',
        onSaved,
        onBusyChange,
        onNotify,
    )
    return (
        <form
            onSubmit={(event) => {
                const data = new FormData(event.currentTarget)
                void submit(event, { ...Object.fromEntries(data), ...(teacher ? { id: teacher.id } : {}) })
            }}
        >
            {!teacher && <h2>Ajouter un professeur</h2>}
            <label htmlFor="teacher-last-name">Nom</label>
            <input
                id="teacher-last-name"
                name="lastName"
                defaultValue={teacher?.lastName}
                autoComplete="family-name"
                required
                maxLength={100}
            />
            <label htmlFor="teacher-first-name">Prénom</label>
            <input
                id="teacher-first-name"
                name="firstName"
                defaultValue={teacher?.firstName}
                autoComplete="given-name"
                required
                maxLength={100}
            />
            <label htmlFor="teacher-email">Email</label>
            <input
                id="teacher-email"
                name="email"
                defaultValue={teacher?.email}
                type="email"
                autoComplete="email"
                required
                maxLength={254}
            />
            <div className="form_actions">
                <button className="btn btn-medium" disabled={busy}>
                    {busy ? 'Enregistrement…' : teacher ? 'Enregistrer les modifications' : 'Ajouter le professeur'}
                </button>
                {onCancel && (
                    <button type="button" className="btn btn-medium secondary" disabled={busy} onClick={onCancel}>
                        Annuler
                    </button>
                )}
            </div>
            {feedback}
        </form>
    )
}

export type CourseTemplate = {
    id: string
    name: string
    level: CourseLevel
    durationMinutes: number
    totalDurationMinutes: number
    capacity: number
    reminderDays: number | null
    cancellationHours: number
    defaultTeacherId: string | null
    minGapHours: number
    bookingDelayHours: number
}
export function CourseTemplateForm({
    teachers,
    course,
    onSaved,
    onCancel,
    onNotify,
    onBusyChange,
}: {
    teachers: { id: string; name: string }[]
    course?: CourseTemplate
    onSaved?: () => void
    onCancel?: () => void
    onNotify?: (message: string) => void
    onBusyChange?: (busy: boolean) => void
}) {
    const { busy, submit, feedback } = useCreateForm(
        '/api/admin/courses',
        course ? 'Cours modifié.' : 'Cours créé.',
        course ? 'PATCH' : 'POST',
        onSaved,
        onBusyChange,
        onNotify,
    )
    return (
        <form
            onSubmit={(event) => {
                const data = new FormData(event.currentTarget)
                void submit(event, {
                    ...(course ? { id: course.id } : {}),
                    name: data.get('name'),
                    level: data.get('level'),
                    durationMinutes: Number(data.get('durationHours')) * 60,
                    totalDurationMinutes: Number(data.get('totalDurationHours')) * 60,
                    capacity: Number(data.get('capacity')),
                    reminderDays: data.get('reminderDays') === '' ? null : Number(data.get('reminderDays')),
                    cancellationHours: Number(data.get('cancellationHours')),
                    defaultTeacherId: data.get('defaultTeacherId') || null,
                    minGapHours: Number(data.get('minGapHours')),
                    bookingDelayHours: Number(data.get('bookingDelayHours')),
                })
            }}
        >
            {!course && <h2>Créer un cours</h2>}
            <label htmlFor="template-name">Nom du cours</label>
            <input id="template-name" name="name" defaultValue={course?.name} required maxLength={200} />
            <label htmlFor="template-level">Niveau</label>
            <select id="template-level" name="level" defaultValue={course?.level ?? 'INITIATION'} required>
                {Object.entries(courseLevels).map(([value, label]) => (
                    <option key={value} value={value}>
                        {label}
                    </option>
                ))}
            </select>
            <label htmlFor="template-duration">Durée d’une séance (en heures)</label>
            <input
                id="template-duration"
                name="durationHours"
                type="number"
                min={0.25}
                max={12}
                step={0.25}
                defaultValue={(course?.durationMinutes ?? 180) / 60}
                required
            />
            <label htmlFor="template-total-duration">Durée totale du cours (en heures)</label>
            <input
                id="template-total-duration"
                name="totalDurationHours"
                type="number"
                min={0.25}
                max={10000}
                step={0.25}
                defaultValue={(course?.totalDurationMinutes ?? 180) / 60}
                required
            />
            <label htmlFor="template-capacity">Capacité d’accueil</label>
            <input
                id="template-capacity"
                name="capacity"
                type="number"
                min={1}
                max={100}
                step={1}
                defaultValue={course?.capacity ?? 12}
                required
            />
            <label htmlFor="template-teacher">Professeur par défaut</label>
            <select id="template-teacher" name="defaultTeacherId" defaultValue={course?.defaultTeacherId ?? ''}>
                <option value="">Aucun professeur par défaut</option>
                {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                    </option>
                ))}
            </select>
            <label htmlFor="template-booking-delay">
                Délai minimum avant de prendre rendez-vous après l’achat (en heures)
            </label>
            <input
                id="template-booking-delay"
                name="bookingDelayHours"
                type="number"
                min={0}
                max={8760}
                step={1}
                defaultValue={course?.bookingDelayHours ?? 72}
                required
            />
            <label htmlFor="template-gap">Délai entre deux séances (en heures)</label>
            <input
                id="template-gap"
                name="minGapHours"
                type="number"
                min={0}
                max={8760}
                step={1}
                defaultValue={course?.minGapHours ?? 48}
                required
            />
            <label htmlFor="template-reminder">Envoyer un rappel par email à J-X</label>
            <input
                id="template-reminder"
                name="reminderDays"
                type="number"
                min={0}
                max={365}
                step={1}
                defaultValue={course ? (course.reminderDays ?? '') : 1}
                aria-describedby="template-reminder-help"
            />
            <label htmlFor="template-cancellation">Permettre l’annulation jusqu’à X h avant le cours</label>
            <input
                id="template-cancellation"
                name="cancellationHours"
                type="number"
                min={0}
                max={8760}
                step={1}
                defaultValue={course?.cancellationHours ?? 48}
                required
            />
            <button className="btn btn-medium" disabled={busy}>
                {busy ? 'Enregistrement…' : course ? 'Enregistrer les modifications' : 'Créer le cours'}
            </button>
            {onCancel && (
                <button type="button" className="btn secondary" disabled={busy} onClick={onCancel}>
                    Annuler
                </button>
            )}
            {feedback}
        </form>
    )
}

export function StudentForm({
    student,
    onSaved,
    onCancel,
    onBusyChange,
    onNotify,
}: {
    student?: { id: string; firstName: string; lastName: string; email: string; phone: string | null; language: string }
    onSaved?: () => void
    onCancel?: () => void
    onBusyChange?: (busy: boolean) => void
    onNotify: (message: string) => void
}) {
    const formId = useId()
    const { busy, submit, feedback } = useCreateForm(
        '/api/admin/students',
        student ? 'Étudiant modifié.' : 'Étudiant ajouté.',
        student ? 'PATCH' : 'POST',
        onSaved,
        onBusyChange,
        onNotify,
    )
    return (
        <form
            onSubmit={(event) => {
                const data = new FormData(event.currentTarget)
                void submit(event, {
                    ...Object.fromEntries(data),
                    ...(student ? { id: student.id } : {}),
                    phone: data.get('phone') || null,
                })
            }}
        >
            {!student && <h2>Ajouter un étudiant</h2>}
            <label htmlFor={`${formId}-last-name`}>Nom</label>
            <input
                id={`${formId}-last-name`}
                name="lastName"
                defaultValue={student?.lastName}
                maxLength={100}
                required
            />
            <label htmlFor={`${formId}-first-name`}>Prénom</label>
            <input
                id={`${formId}-first-name`}
                name="firstName"
                defaultValue={student?.firstName}
                maxLength={100}
                required
            />
            <label htmlFor={`${formId}-email`}>Email</label>
            <input
                id={`${formId}-email`}
                name="email"
                type="email"
                defaultValue={student?.email}
                maxLength={254}
                required
            />
            <label htmlFor={`${formId}-phone`}>Téléphone</label>
            <input id={`${formId}-phone`} name="phone" type="tel" defaultValue={student?.phone ?? ''} maxLength={40} />
            <label htmlFor={`${formId}-language`}>Langue</label>
            <select id={`${formId}-language`} name="language" defaultValue={student?.language ?? 'fr'} required>
                <option value="fr">Français (fr)</option>
                <option value="en">Anglais (en)</option>
                <option value="ja">Japonais (ja)</option>
            </select>
            <div className="form_actions">
                <button className="btn btn-medium" disabled={busy}>
                    {busy ? 'Enregistrement…' : student ? 'Enregistrer les modifications' : 'Ajouter l’étudiant'}
                </button>
                {onCancel && (
                    <button type="button" className="btn btn-medium secondary" disabled={busy} onClick={onCancel}>
                        Annuler
                    </button>
                )}
            </div>
            {feedback}
        </form>
    )
}
