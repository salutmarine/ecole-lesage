export default function StudentLanguage({ language }: { language?: string | null }) {
    if (!language) return null
    const label = ({ fr: 'Français', en: 'Anglais', ja: 'Japonais' } as Record<string, string>)[language.toLowerCase()] || language
    return <span className="muted student_language">{label}</span>
}
