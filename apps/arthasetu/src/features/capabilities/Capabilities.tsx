import { CAPABILITIES, CAPABILITY_AREAS, HEADLINE_CAPABILITIES } from '../../domain/capabilities.ts'

/**
 * Rendered from the same catalogue that generates the website's feature card,
 * so this screen and the site cannot drift apart.
 */
export function CapabilitiesPage() {
  return <div className="advanced-stack">
    <section className="budget-banner">
      <div>
        <div className="eyebrow">WHAT THIS DOES</div>
        <h2>{CAPABILITIES.length} working capabilities, counted from the code.</h2>
        <p>Every line below is read from one catalogue. Each entry points at the function or screen that implements it, and a test fails the build if that code disappears.</p>
      </div>
      <div className="budget-rule">{CAPABILITY_AREAS.length} areas <span>·</span> {HEADLINE_CAPABILITIES.length} shown on the site <span>·</span> no Pro tier</div>
    </section>
    <div className="capability-grid">
      {CAPABILITY_AREAS.map(area => {
        const items = CAPABILITIES.filter(capability => capability.area === area)
        return <section className="survival-card" key={area}>
          <div className="card-title"><span>{area.toUpperCase()}</span><small>{items.length}</small></div>
          <ul className="capability-list">{items.map(item => <li key={item.id}>{item.label}</li>)}</ul>
        </section>
      })}
    </div>
    <p className="tax-note">Not counted on purpose: CSV column mapping, import rollback and the statement balance check that live in <code>features/imports</code> are not wired into this build yet.</p>
  </div>
}
