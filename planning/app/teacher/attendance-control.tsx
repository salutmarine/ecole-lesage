'use client'
import { useId, useState } from 'react'
import Toast from '@/components/toast'

type Attendance = 'UNMARKED' | 'PRESENT' | 'ABSENT'
export default function AttendanceControl({
    bookingId,
    initialAttendance,
    studentName,
    canEdit,
}: {
    bookingId: string
    initialAttendance: Attendance
    studentName: string
    canEdit: boolean
}) {
    const id = useId()
    const [attendance, setAttendance] = useState(initialAttendance)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [toastVersion, setToastVersion] = useState(0)
    async function mark(value: Attendance) {
        if (busy || !canEdit) return
        setBusy(true)
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
            setToastVersion((version) => version + 1)
        } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Enregistrement impossible.')
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="attendance_control">
            <label className="attendance_checkbox" htmlFor={id}>
                <input
                    id={id}
                    type="checkbox"
                    checked={attendance === 'PRESENT'}
                    disabled={busy || !canEdit}
                    onChange={(e) => void mark(e.target.checked ? 'PRESENT' : 'ABSENT')}
                    aria-describedby={`${id}-status`}
                />
                <span>{studentName}</span>
            </label>
            <span className="muted attendance_status" id={`${id}-status`}>
                {attendance === 'PRESENT' ? 'Présent' : attendance === 'ABSENT' ? 'Absent' : 'Non pointé'}
            </span>
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
