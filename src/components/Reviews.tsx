import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PRODUCTS } from './Apps'

type Review = {
  id: string
  name: string
  app: string
  rating: number
  body: string
  createdAt: string
}

type LoadState = 'loading' | 'ready' | 'empty' | 'unconfigured' | 'error'

const MAX_BODY = 600

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Stars({ value, onSelect, label }: { value: number; onSelect?: (rating: number) => void; label: string }) {
  return (
    <div className="stars" role={onSelect ? 'radiogroup' : 'img'} aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value
        if (!onSelect) {
          return <span key={star} className={active ? 'stars__star stars__star--on' : 'stars__star'} aria-hidden="true">★</span>
        }
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} out of 5`}
            className={active ? 'stars__star stars__star--on' : 'stars__star'}
            onClick={() => onSelect(star)}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [name, setName] = useState('')
  const [app, setApp] = useState('General')
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/reviews', { signal: controller.signal, headers: { accept: 'application/json' } })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (response.status === 503) {
          setState('unconfigured')
          return
        }
        if (!response.ok || !data) throw new Error('bad response')
        const list: Review[] = Array.isArray(data.reviews) ? data.reviews : []
        setReviews(list)
        setState(list.length ? 'ready' : 'empty')
      })
      .catch((cause) => {
        if (cause?.name === 'AbortError') return
        setState('error')
      })
    return () => controller.abort()
  }, [])

  const { average, distribution } = useMemo(() => {
    if (!reviews.length) return { average: 0, distribution: [0, 0, 0, 0, 0] }
    const totals = [0, 0, 0, 0, 0]
    let sum = 0
    for (const review of reviews) {
      sum += review.rating
      totals[review.rating - 1] += 1
    }
    return { average: sum / reviews.length, distribution: totals }
  }, [reviews])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    const trimmedName = name.trim()
    const trimmedBody = body.trim()

    if (trimmedName.length < 2) return setError('Add a name of at least two characters.')
    if (!rating) return setError('Choose a star rating.')
    if (trimmedBody.length < 10) return setError('Write at least ten characters so the note is useful.')
    if (trimmedBody.length > MAX_BODY) return setError(`Keep the comment under ${MAX_BODY} characters.`)

    setError('')
    setSending(true)
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ name: trimmedName, app, rating, body: trimmedBody, website: honeypot }),
      })
      const data = await response.json().catch(() => null)
      if (response.status === 503) {
        setError('Reviews are not open yet — the review service is still being connected.')
        return
      }
      if (!response.ok) {
        setError(data?.error || 'That review could not be sent. Try again in a moment.')
        return
      }
      setName('')
      setRating(0)
      setBody('')
      setNotice('Thank you — your note is queued and appears here once it has been read.')
    } catch {
      setError('Could not reach the review service. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="section reviews-page" aria-labelledby="reviews-title">
      <div className="container">
        <div className="reviews-hero">
          <div>
            <p className="eyebrow">REVIEWS &amp; COMMENTS</p>
            <h1 className="reviews-title" id="reviews-title">
              Tell us what<br />actually works<span>.</span>
            </h1>
            <p className="reviews-lede">
              Notes from people using the CensorisLabs suite. Say what is useful, what is
              confusing, and what should change next. Every note is read before it is published,
              and nothing else about you is stored.
            </p>
          </div>

          <aside className="reviews-score" aria-label="Rating summary">
            <p className="eyebrow">CURRENT AVERAGE</p>
            <div className="reviews-score__value">
              {reviews.length ? average.toFixed(1) : '—'}
              <span>/ 5</span>
            </div>
            <Stars value={Math.round(average)} label={`${reviews.length} reviews`} />
            <p className="reviews-score__count">
              {reviews.length} published {reviews.length === 1 ? 'note' : 'notes'}
            </p>
            <div className="reviews-bars">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = distribution[star - 1]
                const percent = reviews.length ? (count / reviews.length) * 100 : 0
                return (
                  <div className="reviews-bar" key={star}>
                    <span>{star}★</span>
                    <span className="reviews-bar__track">
                      <span className="reviews-bar__fill" style={{ width: `${percent}%` }} />
                    </span>
                    <span>{count}</span>
                  </div>
                )
              })}
            </div>
          </aside>
        </div>

        <div className="reviews-layout">
          <form className="review-form" onSubmit={submit} noValidate data-tilt>
            <p className="eyebrow">WRITE A REVIEW</p>
            <h2>Leave a note</h2>

            <label className="field">
              <span>Name</span>
              <input
                type="text"
                value={name}
                maxLength={40}
                autoComplete="name"
                placeholder="How should we credit you?"
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Which app?</span>
              <select value={app} onChange={(event) => setApp(event.target.value)}>
                <option>General</option>
                {PRODUCTS.map((product) => (
                  <option key={product.id} value={product.name}>{product.name}</option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>Rating</span>
              <Stars value={rating} onSelect={setRating} label="Choose a rating from one to five stars" />
            </div>

            <label className="field">
              <span>Comment</span>
              <textarea
                value={body}
                maxLength={MAX_BODY}
                rows={5}
                placeholder="What worked, what did not, what should come next?"
                onChange={(event) => setBody(event.target.value)}
              />
            </label>

            <div className="review-form__honeypot" aria-hidden="true">
              <label>
                Website
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(event) => setHoneypot(event.target.value)}
                />
              </label>
            </div>

            <div className="review-form__foot">
              <span className="review-form__count">{body.length}/{MAX_BODY}</span>
              <button className="btn btn--primary" type="submit" disabled={sending}>
                {sending ? 'Sending…' : 'Post review'}
              </button>
            </div>

            <p className="review-form__status" role="status" aria-live="polite">
              {error || notice}
            </p>

            <p className="review-form__privacy">
              Your name, the app, the stars and the words are sent to CensorisLabs and read
              before publishing. No account, no email, no IP address is kept.
            </p>
          </form>

          <div className="reviews-list" aria-live="polite">
            <div className="reviews-list__head">
              <h2>{reviews.length ? 'Recent notes' : 'No notes yet'}</h2>
              <span className="reviews-list__meta">Public · moderated</span>
            </div>

            {state === 'loading' && (
              <div className="reviews-empty">
                <p>Loading published notes…</p>
              </div>
            )}

            {state === 'unconfigured' && (
              <div className="reviews-empty">
                <p>
                  Reviews are not open yet — the archive is still being connected. Once the review
                  service is live, notes written here are queued for a read before they appear.
                </p>
              </div>
            )}

            {state === 'error' && (
              <div className="reviews-empty">
                <p>
                  The review service could not be reached just now. The form still works when the
                  connection comes back; nothing you have typed is lost.
                </p>
              </div>
            )}

            {(state === 'empty' || state === 'ready') && !reviews.length && (
              <div className="reviews-empty">
                <p>
                  No published notes yet. If you have used any CensorisLabs app, the first note is
                  yours — it appears here once it has been read.
                </p>
                <span className="reviews-empty__mark" aria-hidden="true">◆</span>
              </div>
            )}

            {reviews.map((review) => (
              <article className="review-card" key={review.id} data-tilt>
                <header>
                  <div>
                    <h3>{review.name}</h3>
                    <p className="review-card__meta">
                      {review.app} · {formatDate(review.createdAt)}
                    </p>
                  </div>
                  <Stars value={review.rating} label={`${review.rating} out of 5`} />
                </header>
                <p className="review-card__body">{review.body}</p>
              </article>
            ))}
          </div>
        </div>

        <p className="reviews-note">
          Reviews are stored on CensorisLabs servers only after approval, with no account and no
          tracking. To have a note removed, write to hello@censorislabs.online.
        </p>
      </div>
    </section>
  )
}
