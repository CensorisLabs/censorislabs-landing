const ROWS = [
  {
    label: 'Storage',
    censoris: 'Encrypted SQLite, app-private',
    vesper: 'Encrypted local database files',
  },
  {
    label: 'Network requirement',
    censoris: 'None — fully offline',
    vesper: 'None — Git remotes optional',
  },
  {
    label: 'Telemetry',
    censoris: 'Zero. No SDKs, no pings.',
    vesper: 'Zero.',
  },
  {
    label: 'Accounts',
    censoris: 'Not required',
    vesper: 'Not required',
  },
  {
    label: 'Sync model',
    censoris: 'Encrypted file export / personal backup',
    vesper: 'Git-native, user-controlled remotes',
  },
  {
    label: 'Platforms',
    censoris: 'Android (primary), desktop later',
    vesper: 'Windows, macOS, Linux',
  },
  {
    label: 'Languages',
    censoris: 'English, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada',
    vesper: 'English',
  },
  {
    label: 'License posture',
    censoris: 'Permissive dependencies, no trackers',
    vesper: 'Permissive dependencies, no trackers',
  },
]

export default function TechnicalLedger() {
  return (
    <section className="section" id="products" aria-labelledby="products-title">
      <div className="container">
        <p className="eyebrow">Product matrix</p>
        <h2 className="section-title" id="products-title">
          The technical ledger
        </h2>
        <p className="section-lede">
          Plain specifications, no marketing arithmetic. Both products are
          engineered to run with the network unplugged and the data on your own
          silicon.
        </p>

        <div className="ledger-wrap">
          <table className="ledger">
            <caption>CensorisLabs · specification ledger</caption>
            <thead>
              <tr>
                <th scope="col">Attribute</th>
                <th scope="col">Censoris</th>
                <th scope="col">Vesper</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.censoris}</td>
                  <td>{row.vesper}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
