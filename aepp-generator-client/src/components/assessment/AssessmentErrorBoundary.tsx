import { Component, type ReactNode } from 'react'
export default class AssessmentErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <section className="assessment-local-notice" role="alert">
        <h1>Αποτυχία φόρτωσης διαγωνίσματος</h1>
        <p>Οι αποθηκευμένες απαντήσεις σου διατηρούνται. Πατήστε για δοκιμή ξανά.</p>
        <button
          type="button"
          onClick={() => {
            this.setState({ failed: false })
            this.props.onRetry()
          }}
        >
          Δοκιμή ξανά
        </button>
      </section>
    ) : (
      this.props.children
    )
  }
}
