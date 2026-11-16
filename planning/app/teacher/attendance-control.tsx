'use client'
import { useId, useState } from 'react'
import Toast from '@/components/toast'

type Attendance = 'UNMARKED' | 'PRESENT' | 'ABSENT'
export default function AttendanceControl({
    bookingId,
    initialAttendance,
    studentName,
    canEdit,
    variant = 'checkbox',
    onUpdated,
    onBusyChange,
}: {
    bookingId: string
    initialAttendance: Attendance
    studentName: string
    canEdit: boolean
    variant?: 'checkbox' | 'rollcall'
    onUpdated?: (attendance: Attendance) => void
    onBusyChange?: (busy: boolean) => void
}) {
    const id = useId()
    const [attendance, setAttendance] = useState(initialAttendance)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [toastVersion, setToastVersion] = useState(0)
    async function mark(value: Attendance) {
        if (busy || !canEdit) return
        setBusy(true)
        onBusyChange?.(true)
        setMessage('')
        try {
            const response = await fetch('/api/teacher/attendance', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, attendance: value }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Enregistrement impossible.')
            setAttendance(data.attendance)
            onUpdated?.(data.attendance)
            setToastVersion((version) => version + 1)
        } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Enregistrement impossible.')
        } finally {
            setBusy(false)
            onBusyChange?.(false)
        }
    }
    return (
        <div className={`attendance_control${variant === 'rollcall' ? ' attendance_control_rollcall' : ''}`}>
            {variant === 'rollcall' ? (
                <>
                    <strong id={`${id}-name`}>{studentName}</strong>
                    <span className="muted" role="status">
                        {attendance === 'UNMARKED' ? 'Non pointé' : attendance === 'PRESENT' ? 'Présent' : 'Absent'}
                    </span>
                    <div className="attendance_rollcall_actions" role="group" aria-labelledby={`${id}-name`}>
                        <button
                            type="button"
                            className="btn secondary"
                            aria-pressed={attendance === 'PRESENT'}
                            disabled={busy || !canEdit}
                            onClick={() => void mark('PRESENT')}
                        >
                            Présent
                        </button>
                        <button
                            type="button"
                            className="btn secondary"
                            aria-pressed={attendance === 'ABSENT'}
                            disabled={busy || !canEdit}
                            onClick={() => void mark('ABSENT')}
                        >
                            Absent
                        </button>
                        {attendance !== 'UNMARKED' && (
                            <button
                                type="button"
                                className="btn secondary"
                                disabled={busy || !canEdit}
                                onClick={() => void mark('UNMARKED')}
                            >
                                Effacer le pointage
                            </button>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <label className="attendance_checkbox" htmlFor={id}>
                        <input
                            id={id}
                            type="checkbox"
                            checked={attendance === 'PRESENT'}
                            disabled={busy || !canEdit}
                            onChange={(e) => void mark(e.target.checked ? 'PRESENT' : 'ABSENT')}
                            aria-describedby={attendance === 'UNMARKED' ? undefined : `${id}-status`}
                        />
                        <span>{studentName}</span>
                    </label>
                    {attendance !== 'UNMARKED' && (
                        <span className="muted attendance_status" id={`${id}-status`}>
                            {attendance === 'PRESENT' ? 'Présent' : 'Absent'}
                        </span>
                    )}
                </>
            )}
            {toastVersion > 0 && <Toast key={toastVersion} message="Pointage enregistré." variant="success" />}
            {busy && <p role="status">Enregistrement…</p>}
            {message && (
                <p className="error" role="alert">
                    {message}
                </p>
            )}
        </div>
    )
}
