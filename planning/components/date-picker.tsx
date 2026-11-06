'use client'

import { useId, useRef, useState } from 'react'

function dateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type Props = {
    id?: string
    name?: string
    value?: string
    defaultValue?: string
    onChange?: (value: string) => void
    min?: string
    required?: boolean
    withTime?: boolean
}

export default function DatePicker({ id, name, value, defaultValue = '', onChange, min, required, withTime }: Props) {
    const uid = useId()
    const [internal, setInternal] = useState(defaultValue)
    const current = value ?? internal
    const selected = current.slice(0, 10)
    const time = current.slice(11) || '09:00'
    const [month, setMonth] = useState(() => new Date(`${selected || dateKey(new Date())}T12:00:00`))
    const trigger = useRef<HTMLButtonElement>(null)
    const popover = useRef<HTMLDivElement>(null)
    const timeTrigger = useRef<HTMLButtonElement>(null)
    const timePopover = useRef<HTMLDivElement>(null)
    const today = dateKey(new Date())
    const popoverId = `date-picker-${uid}`
    const timePopoverId = `time-picker-${uid}`
    const [hour, minute] = time.split(':')
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const count = Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7

    function update(next: string) {
        setInternal(next)
        onChange?.(next)
    }
    function position(isTime = false) {
        const rect = (isTime ? timeTrigger : trigger).current!.getBoundingClientRect()
        const element = (isTime ? timePopover : popover).current!
        const width = Math.min(isTime ? 260 : 320, window.innerWidth - 24)
        element.style.width = `${width}px`
        element.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`
        element.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - element.offsetHeight - 12))}px`
    }
    return (
        <div className="date_picker">
            <input
                className="date_picker_value"
                aria-label="Date sélectionnée"
                type={withTime ? 'datetime-local' : 'date'}
                name={name}
                value={current}
                min={min}
                required={required}
                tabIndex={-1}
                onChange={(event) => update(event.target.value)}
                onInvalid={(event) => {
                    event.preventDefault()
                    trigger.current?.focus()
                    popover.current?.showPopover()
                    position()
                }}
            />
            <div className="date_picker_fields">
                <button
                    id={id}
                    ref={trigger}
                    type="button"
                    className="date_picker_trigger"
                    popoverTarget={popoverId}
                    aria-haspopup="dialog"
                    onClick={() => {
                        setMonth(new Date(`${selected || today}T12:00:00`))
                    }}
                >
                    <span>
                        {selected ? new Date(`${selected}T12:00:00`).toLocaleDateString('fr-FR') : 'Choisir une date'}
                    </span>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                    >
                        <rect x="3" y="5" width="18" height="16" rx="3" />
                        <path d="M3 11h18M8 3v4M16 3v4" />
                    </svg>
                </button>
                {withTime && (
                    <button
                        ref={timeTrigger}
                        type="button"
                        className="date_picker_trigger time_picker_trigger"
                        popoverTarget={timePopoverId}
                        aria-label={`Heure de début : ${hour} h ${minute}`}
                        aria-haspopup="dialog"
                    >
                        <span>{time}</span>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3 2" />
                        </svg>
                    </button>
                )}
            </div>
            <div
                id={popoverId}
                ref={popover}
                popover="auto"
                className="date_picker_calendar"
                role="dialog"
                aria-label="Choisir une date"
                onToggle={(event) => {
                    if (event.newState === 'open') position()
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') trigger.current?.focus()
                }}
            >
                <div className="date_picker_header">
                    <button
                        type="button"
                        aria-label="Mois précédent"
                        onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                    >
                        ‹
                    </button>
                    <span aria-live="polite">
                        {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        type="button"
                        aria-label="Mois suivant"
                        onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                    >
                        ›
                    </button>
                </div>
                <div className="date_picker_grid">
                    {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((day) => (
                        <span className="date_picker_weekday" key={day}>
                            {day}
                        </span>
                    ))}
                    {Array.from({ length: count }, (_, index) => {
                        const date = new Date(month.getFullYear(), month.getMonth(), index - offset + 1)
                        const key = dateKey(date)
                        return (
                            <button
                                type="button"
                                key={key}
                                className={`date_picker_day${date.getMonth() !== month.getMonth() ? ' outside' : ''}${key === selected ? ' selected' : ''}`}
                                aria-label={date.toLocaleDateString('fr-FR', { dateStyle: 'full' })}
                                aria-pressed={key === selected}
                                aria-current={key === today ? 'date' : undefined}
                                disabled={Boolean(min && key < min.slice(0, 10))}
                                onClick={() => {
                                    update(withTime ? `${key}T${time}` : key)
                                    popover.current?.hidePopover()
                                    trigger.current?.focus()
                                }}
                            >
                                {date.getDate()}
                                {(key === selected || key === today) && <span className="date_picker_dot" />}
                            </button>
                        )
                    })}
                </div>
            </div>
            {withTime && (
                <div
                    id={timePopoverId}
                    ref={timePopover}
                    popover="auto"
                    className="date_picker_calendar time_picker_panel"
                    role="dialog"
                    aria-label="Choisir l’heure de début"
                    onToggle={(event) => {
                        if (event.newState !== 'open') return
                        position(true)
                        timePopover.current
                            ?.querySelectorAll<HTMLButtonElement>('[aria-pressed="true"]')
                            .forEach((button) => {
                                const column = button.parentElement!
                                column.scrollTop =
                                    button.offsetTop -
                                    column.offsetTop -
                                    column.clientHeight / 2 +
                                    button.offsetHeight / 2
                            })
                        timePopover.current
                            ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
                            ?.focus({ preventScroll: true })
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') timeTrigger.current?.focus()
                    }}
                >
                    <div className="time_picker_title">Choisir l’heure</div>
                    <div className="time_picker_headings" aria-hidden="true">
                        <span>Heures</span>
                        <span>Minutes</span>
                    </div>
                    <div className="time_picker_columns">
                        {(['hour', 'minute'] as const).map((part) => (
                            <div
                                className="time_picker_column"
                                role="group"
                                aria-label={part === 'hour' ? 'Heures' : 'Minutes'}
                                key={part}
                            >
                                {Array.from({ length: part === 'hour' ? 24 : 60 }, (_, index) => {
                                    const number = String(index).padStart(2, '0')
                                    const active = number === (part === 'hour' ? hour : minute)
                                    return (
                                        <button
                                            type="button"
                                            key={number}
                                            className={`date_picker_day${active ? ' selected' : ''}`}
                                            aria-label={`${number} ${part === 'hour' ? 'heures' : 'minutes'}`}
                                            aria-pressed={active}
                                            onKeyDown={(event) => {
                                                if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
                                                event.preventDefault()
                                                const buttons = Array.from(
                                                    event.currentTarget.parentElement!.querySelectorAll('button'),
                                                )
                                                const next =
                                                    event.key === 'Home'
                                                        ? 0
                                                        : event.key === 'End'
                                                          ? buttons.length - 1
                                                          : index + (event.key === 'ArrowDown' ? 1 : -1)
                                                buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus()
                                            }}
                                            onClick={() =>
                                                update(
                                                    `${selected || today}T${part === 'hour' ? number : hour}:${part === 'minute' ? number : minute}`,
                                                )
                                            }
                                        >
                                            {number}
                                            {active && <span className="date_picker_dot" />}
                                        </button>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                    <button
                        className="time_picker_confirm"
                        type="button"
                        onClick={() => {
                            if (!selected) update(`${today}T${time}`)
                            timePopover.current?.hidePopover()
                            timeTrigger.current?.focus()
                        }}
                    >
                        Confirmer · {time}
                    </button>
                </div>
            )}
        </div>
    )
}
