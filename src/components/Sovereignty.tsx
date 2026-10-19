const PRINCIPLES = [
  {
    numeral: 'I',
    title: 'Zero cloud lock-in',
    body: 'Your financial and developer data remains on your physical silicon. Exports are open formats, backups are encrypted by you, and no subscription gates access to your own records.',
  },
  {
    numeral: 'II',
    title: 'Zero telemetry',
    body: 'No tracking, no user profiling, no remote telemetry pings. The software does not phone home, because there is no home to phone. What you do on your device stays on your device.',
  },
  {
    numeral: 'III',
    title: 'Immutable infrastructure',
    body: 'Git-based local workflows with offline capability. Your history is auditable, your working copy is yours, and no vendor can rewrite or revoke it from a distant server.',
  },
]

export default function Sovereignty() {
  return (
    <section className="section" id="sovereignty" aria-labelledby="sovereignty-title">
      <div className="container">
        <p className="eyebrow">Sovereignty manifesto</p>
        <h2 className="section-title" id="sovereignty-title">
          Three principles, held without exception
        </h2>
        <p className="section-lede">
          These are not marketing pillars that soften under pressure. They are
          engineering constraints that shape every architectural decision we
          make.
        </p>

        <div className="sovereignty__grid">
          {PRINCIPLES.map((principle) => (
            <article className="principle" key={principle.numeral}>
              <span className="principle__numeral" aria-hidden="true">
                {principle.numeral}
              </span>
              <h3>{principle.title}</h3>
              <p>{principle.body}</p>
            </article>
          ))}
        </div>

        <div className="sovereignty__seal">
          No account · No beacon · No landlord
        </div>
      </div>
    </section>
  )
}
