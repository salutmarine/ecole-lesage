import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const courses = JSON.parse(readFileSync(new URL('../data/lesage/catalogue.json', import.meta.url), 'utf8')) as {
    name: string
    sourceUrl: string
    level: string
    wooProductIds: number[]
    totalDurationMinutes: number
    durationMinutes: number
    sessionsCount: number
    description: string
    techniques: string
    informations: string
    priceCents: number
}[]
test('le catalogue contient les 25 offres distinctes des trois catégories', () => {
    assert.equal(courses.length, 25)
    assert.equal(new Set(courses.map((c) => c.sourceUrl)).size, 25)
    assert.equal(new Set(courses.flatMap((c) => c.wooProductIds)).size, 25)
    assert.deepEqual(
        ['INITIATION', 'PERFECTIONNEMENT', 'SPECIALISATION'].map(
            (level) => courses.filter((c) => c.level === level).length,
        ),
        [13, 9, 3],
    )
})
test('les fiches ont leurs informations détaillées et des durées cohérentes', () => {
    for (const course of courses) {
        assert.equal(course.sessionsCount * course.durationMinutes, course.totalDurationMinutes, course.name)
        assert.ok(course.description && course.techniques && course.informations, course.name)
        assert.ok(course.priceCents > 0, course.name)
        assert.match(course.sourceUrl, /^https:\/\/ecolelesage\.com\/fr\/courses\//)
    }
})
