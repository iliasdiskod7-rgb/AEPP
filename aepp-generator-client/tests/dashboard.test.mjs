import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const { dashboardFeatures } = await server.ssrLoadModule('/src/components/dashboard/dashboardFeatures.ts')
const { default: GuideCard } = await server.ssrLoadModule('/src/components/dashboard/DashboardGuideCard.tsx')
const { default: Tour } = await server.ssrLoadModule('/src/components/dashboard/DashboardOnboardingTour.tsx')
const { default: HeroScrollShowcase } = await server.ssrLoadModule('/src/components/dashboard/HeroScrollShowcase.tsx')
const { dashboardTourStorageKey, hasSeenDashboardTour, markDashboardTourSeen } =
  await server.ssrLoadModule('/src/components/dashboard/dashboardTourStorage.ts')

after(() => server.close())

test('dashboard guide renders six feature cards with educational benefits and working destinations', () => {
  const html = renderToStaticMarkup(createElement('div', null,
    dashboardFeatures.map(feature => createElement(GuideCard, {
      key: feature.id,
      feature,
      onOpen: () => {},
    })),
  ))

  assert.equal((html.match(/data-dashboard-feature=/g) ?? []).length, 6)
  assert.equal((html.match(/ΓΙΑΤΙ ΝΑ ΤΟ ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ/g) ?? []).length, 6)
  assert.equal((html.match(/Άνοιγμα εργαλείου/g) ?? []).length, 6)
  assert.deepEqual(dashboardFeatures.map(feature => feature.destination), [
    'interpreter', 'interpreter', 'assessment', 'daily', 'notes', 'whiteboard',
  ])
})

test('onboarding tour presents its first accessible step and navigation controls', () => {
  const html = renderToStaticMarkup(createElement(Tour, {
    active: true,
    step: 0,
    onStepChange: () => {},
    onClose: () => {},
  }))

  assert.ok(html.includes('role="dialog"'))
  assert.ok(html.includes('aria-modal="true"'))
  assert.ok(html.includes('ΒΗΜΑ 1 ΑΠΟ 6'))
  assert.ok(html.includes('Διερμηνευτής ΓΛΩΣΣΑΣ'))
  assert.ok(html.includes('Παράλειψη'))
  assert.ok(html.includes('Επόμενο'))
})

test('home hero renders both accessible product previews and its two calls to action', () => {
  const html = renderToStaticMarkup(createElement(HeroScrollShowcase, {
    onStartNow: () => {},
    onOpenGuide: () => {},
  }))

  assert.ok(html.includes('Το Πλήρες Ψηφιακό Εργαστήριο'))
  assert.ok(html.includes('Γράψε κώδικα'))
  assert.ok(html.includes('Ξεκίνα Τώρα'))
  assert.ok(html.includes('Οδηγός Χρήσης'))
  assert.ok(html.includes('role="img" aria-label="Προεπισκόπηση του διερμηνευτή'))
  assert.ok(html.includes('ΠΙΝΑΚΑΣ ΤΙΜΩΝ'))
  assert.ok(html.includes('2.480'))
  assert.ok(html.includes('12'))
})

test('tour completion is isolated by user and supports encoded user IDs', () => {
  const values = new Map()
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }

  assert.equal(dashboardTourStorageKey('student / 1'), 'hasSeenDashboardTour:student%20%2F%201')
  assert.equal(hasSeenDashboardTour('student / 1', storage), false)
  markDashboardTourSeen('student / 1', storage)
  assert.equal(hasSeenDashboardTour('student / 1', storage), true)
  assert.equal(hasSeenDashboardTour('student-2', storage), false)
})
