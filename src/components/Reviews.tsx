import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PRODUCTS } from './Apps'

type Review = {
  id: string
  name: string
  app: string
  rating: number
  body: string
  createdAt: number
}

const STORAGE_KEY = 'censorislabs-reviews'
const MAX_BODY = 600

function readReviews(): Review[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is Review =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.app === 'string' &&
        typeof item.rating === 'number' &&
        typeof item.body === 'string' &&
        typeof item.createdAt === 'number',
      )
      .slice(0, 200)
  } catch {
    return []
  }
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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
  const [reviews, setReviews] = useState<Review[]>(readReviews)
  const [name, setName] = useState('')
  const [app, setApp] = useState('General')
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
    } catch {
      /* Private browsing can refuse writes; the page still renders. */
    }
  }, [reviews])

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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedBody = body.trim()

    if (trimmedName.length < 2) return setError('Add a name of at least two characters.')
    if (!rating) return setError('Choose a star rating.')
    if (trimmedBody.length < 10) return setError('Write at least ten characters so the note is useful.')
    if (trimmedBody.length > MAX_BODY) return setError(`Keep the comment under ${MAX_BODY} characters.`)

    const review: Review = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName.slice(0, 40),
      app,
      rating,
      body: trimmedBody,
      createdAt: Date.now(),
    }

    setReviews((current) => [review, ...current])
    setName('')
    setRating(0)
    setBody('')
    setError('')
    setSent(true)
    window.setTimeout(() => setSent(false), 4000)
  }

  const remove = (id: string) => setReviews((current) => current.filter((review) => review.id !== id))

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
              confusing, and what should change next — every entry is stored on your own device.
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
              {reviews.length} {reviews.length === 1 ? 'entry' : 'entries'} on this device
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

            <div className="review-form__foot">
              <span className="review-form__count">{body.length}/{MAX_BODY}</span>
              <button className="btn btn--primary" type="submit">Post review</button>
            </div>

            <p className="review-form__status" role="status" aria-live="polite">
              {error || (sent ? 'Saved on this device. Thank you.' : '')}
            </p>
          </form>

          <div className="reviews-list" aria-live="polite">
            <div className="reviews-list__head">
              <h2>{reviews.length ? 'Recent notes' : 'No notes yet'}</h2>
              <span className="reviews-list__meta">Local-only · no account</span>
            </div>

            {!reviews.length && (
              <div className="reviews-empty">
                <p>
                  Nothing has been posted here yet. Your review is written to this browser's
                  storage only — it is not uploaded anywhere, so treat this as a private notebook
                  until a review service is connected.
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
                <button className="review-card__delete" type="button" onClick={() => remove(review.id)}>
                  Remove
                </button>
              </article>
            ))}
          </div>
        </div>

        <p className="reviews-note">
          Reviews are kept in this browser only and never leave your device. Clearing site data
          removes them. A shared review service is not connected yet, so nothing here is public.
        </p>
      </div>
    </section>
  )
}
