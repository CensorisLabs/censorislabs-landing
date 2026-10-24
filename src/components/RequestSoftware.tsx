import { useState, type FormEvent } from 'react'

const CONTACT = 'hello@censorislabs.online'
const MAX_MESSAGE = 1200
// Some mail clients and operating systems drop mailto links much longer than this.
const MAILTO_LIMIT = 1900
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Kind = 'software' | 'comment'
type Status = { tone: 'error' | 'ok'; text: string } | null

const PLATFORMS = ['Windows app', 'Android app', 'Website or web app', 'Script or command-line tool', 'Not sure yet']

const isControl = (char: string) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
/** Collapses a value to one line so a visitor cannot inject extra mail headers or fields. */
const oneLine = (value: string) => Array.from(value, (char) => (isControl(char) ? ' ' : char)).join('').trim()

export default function RequestSoftware() {
  const [kind, setKind] = useState<Kind>('software')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [platform, setPlatform] = useState(PLATFORMS[0])
  const [timeline, setTimeline] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>(null)

  const isSoftware = kind === 'software'

  const validate = () => {
    if (oneLine(name).length < 2) return 'Add a name of at least two characters.'
    if (!EMAIL_PATTERN.test(oneLine(email))) return 'Add a valid email address so the reply can reach you.'
    if (isSoftware && message.trim().length < 20) return 'Describe what the software should do in at least twenty characters.'
    if (!isSoftware && message.trim().length < 10) return 'Write at least ten characters so the comment is useful.'
    return ''
  }

  const build = () => {
    const cleanName = oneLine(name).slice(0, 60)
    const lines = [
      `Name: ${cleanName}`,
      `Email: ${oneLine(email)}`,
      `Type: ${isSoftware ? 'Software request' : 'Comment or suggestion'}`,
    ]
    if (isSoftware) lines.push(`Platform: ${platform}`)
    if (isSoftware && oneLine(timeline)) lines.push(`Budget or timeline: ${oneLine(timeline).slice(0, 120)}`)
    lines.push('', 'Message:', message.trim())

    const subject = `[CensorisLabs site] ${isSoftware ? 'Software request' : 'Comment'} from ${cleanName}`
    const body = lines.join('\n')
    const href = `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`
    return { subject, body, href }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const problem = validate()
    if (problem) return setStatus({ tone: 'error', text: problem })

    const { href } = build()
    if (href.length > MAILTO_LIMIT) {
      return setStatus({ tone: 'error', text: 'This request is too long for an email link. Use Copy request and paste it into an email.' })
    }

    window.location.href = href
    setStatus({ tone: 'ok', text: 'Your email app should open with the request ready. Press send there. Nothing leaves your device until you do.' })
  }

  const copy = async () => {
    const problem = validate()
    if (problem) return setStatus({ tone: 'error', text: problem })

    const { subject, body } = build()
    try {
      await navigator.clipboard.writeText(`To: ${CONTACT}\nSubject: ${subject}\n\n${body}`)
      setStatus({ tone: 'ok', text: `Copied. Paste it into an email to ${CONTACT}.` })
    } catch {
      setStatus({ tone: 'error', text: `Copying was blocked by your browser. Email your request to ${CONTACT} instead.` })
    }
  }

  return (
    <section className="section reviews-page" aria-labelledby="request-title">
      <div className="container">
        <div className="reviews-hero">
          <div>
            <p className="eyebrow">REQUEST SOFTWARE</p>
            <h1 className="reviews-title" id="request-title">
              Tell us what<br />to build next<span>.</span>
            </h1>
            <p className="reviews-lede">
              Need a tool, app or script that does not exist yet? Describe it here and send it to
              CensorisLabs. You can also just leave a comment or suggestion.
            </p>
          </div>

          <aside className="request-panel" aria-label="How requests work">
            <p className="eyebrow">HOW IT WORKS</p>
            <ol className="request-steps">
              <li>Describe what you need and how you would use it.</li>
              <li>Press the button and your email app opens with the message already written.</li>
              <li>Send it. Replies come to the address you enter, and no payment is taken on this site.</li>
            </ol>
          </aside>
        </div>

        <div className="request-layout">
          <form className="review-form request-form" onSubmit={submit} noValidate data-tilt>
            <p className="eyebrow">NEW REQUEST</p>
            <h2>Send a request or comment</h2>

            <label className="field">
              <span>What is this about?</span>
              <select value={kind} onChange={(event) => { setKind(event.target.value as Kind); setStatus(null) }}>
                <option value="software">Build me a piece of software</option>
                <option value="comment">Leave a comment or suggestion</option>
              </select>
            </label>

            <div className="request-form__row">
              <label className="field">
                <span>Name</span>
                <input
                  type="text"
                  value={name}
                  maxLength={60}
                  autoComplete="name"
                  placeholder="How should we address you?"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  maxLength={120}
                  autoComplete="email"
                  placeholder="Where should we reply?"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            </div>

            {isSoftware && (
              <div className="request-form__row">
                <label className="field">
                  <span>Where should it run?</span>
                  <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
                    {PLATFORMS.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Budget or deadline (optional)</span>
                  <input
                    type="text"
                    value={timeline}
                    maxLength={120}
                    placeholder="Anything we should know"
                    onChange={(event) => setTimeline(event.target.value)}
                  />
                </label>
              </div>
            )}

            <label className="field">
              <span>{isSoftware ? 'What should it do?' : 'Your comment'}</span>
              <textarea
                value={message}
                maxLength={MAX_MESSAGE}
                rows={7}
                placeholder={isSoftware
                  ? 'Describe the problem, who will use it, and what a good result looks like.'
                  : 'What is working, what is confusing, what should change?'}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>

            <div className="request-actions">
              <span className="review-form__count">{message.length}/{MAX_MESSAGE}</span>
              <button className="btn btn--outline" type="button" onClick={copy}>Copy request</button>
              <button className="btn btn--primary" type="submit">Open email to send</button>
            </div>

            <p className={status?.tone === 'ok' ? 'review-form__status review-form__status--ok' : 'review-form__status'} role="status" aria-live="polite">
              {status?.text ?? ''}
            </p>
          </form>

          <aside className="request-panel" aria-label="What to include">
            <p className="eyebrow">WHAT TO INCLUDE</p>
            <h2>A good request is specific</h2>
            <ul className="request-tips">
              <li><b>The problem.</b> What should the software do, and who will use it?</li>
              <li><b>The device.</b> Windows, Android, the web, or a command-line script.</li>
              <li><b>Examples.</b> Name any app or site that does something similar.</li>
              <li><b>Constraints.</b> Data that must stay offline, languages it needs, or a deadline.</li>
            </ul>
          </aside>
        </div>

        <p className="reviews-note">
          This page has no server and stores nothing. The button only opens your own email app with
          the message written out, so nothing leaves your device until you press send there. If no
          email app opens, use Copy request and send it to {CONTACT}. Sending a request is not a
          commitment from either side.
        </p>
      </div>
    </section>
  )
}
