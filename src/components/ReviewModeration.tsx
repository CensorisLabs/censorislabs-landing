import { useCallback, useEffect, useState } from 'react'

type Review = {
  id: string
  name: string
  app: string
  rating: number
  body: string
  createdAt: string
}

type State = 'idle' | 'loading' | 'ready' | 'unauthorised' | 'unconfigured' | 'error'

const TOKEN_KEY = 'censorislabs-review-token'

function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ReviewModeration() {
  const [token, setToken] = useState(readToken)
  const [pending, setPending] = useState<Review[]>([])
  const [approved, setApproved] = useState<Review[]>([])
  const [state, setState] = useState<State>(readToken() ? 'loading' : 'idle')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async (secret: string) => {
    if (!secret) {
      setState('idle')
      return
    }
    setState('loading')
    setMessage('')
    try {
      const response = await fetch('/api/reviews-moderation', {
        headers: { authorization: `Bearer ${secret}`, accept: 'application/json' },
      })
      const data = await response.json().catch(() => null)
      if (response.status === 401) {
        setState('unauthorised')
        setMessage('That token was rejected.')
        return
      }
      if (response.status === 503) {
        setState('unconfigured')
        setMessage(data?.error || 'Moderation is not configured yet.')
        return
      }
      if (!response.ok || !data) throw new Error('bad response')
      setPending(Array.isArray(data.pending) ? data.pending : [])
      setApproved(Array.isArray(data.approved) ? data.approved : [])
      setState('ready')
    } catch {
      setState('error')
      setMessage('The moderation service could not be reached.')
    }
  }, [])

  useEffect(() => {
    if (readToken()) load(readToken())
  }, [load])

  const connect = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const secret = token.trim()
    try {
      sessionStorage.setItem(TOKEN_KEY, secret)
    } catch {
      /* Private browsing can refuse writes; the session still works. */
    }
    load(secret)
  }

  const disconnect = () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
    setToken('')
    setPending([])
    setApproved([])
    setMessage('')
    setState('idle')
  }

  const act = async (id: string, action: 'approve' | 'reject' | 'delete') => {
    setBusy(id)
    setMessage('')
    try {
      const response = await fetch('/api/reviews-moderation', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${readToken()}`,
          accept: 'application/json',
        },
        body: JSON.stringify({ id, action }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setMessage(data?.error || 'That action failed.')
        return
      }
      const labels = { approve: 'published', reject: 'deleted', delete: 'removed' } as const
      setMessage(`Review ${labels[action]}.`)
      await load(readToken())
    } catch {
      setMessage('Could not reach the moderation service.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="section moderation-page" aria-labelledby="moderation-title">
      <div className="container">
        <p className="eyebrow">OWNER TOOL · NOT LINKED</p>
        <h1 className="reviews-title" id="moderation-title">
          Review<br />moderation<span>.</span>
        </h1>
        <p className="reviews-lede">
          Notes submitted from the reviews page wait here until you publish or delete them.
          Nothing appears publicly without a click on this page. The token is kept in this tab only.
        </p>

        <form className="moderation-token" onSubmit={connect}>
          <label className="field">
            <span>Moderation token</span>
            <input
              type="password"
              value={token}
              autoComplete="off"
              placeholder="Paste REVIEWS_ADMIN_TOKEN"
              onChange={(event) => setToken(event.target.value)}
            />
          </label>
          <div className="moderation-token__actions">
            <button className="btn btn--primary" type="submit" disabled={!token.trim()}>
              {state === 'idle' ? 'Unlock queue' : 'Reload queue'}
            </button>
            {state !== 'idle' && (
              <button className="btn btn--outline" type="button" onClick={disconnect}>
                Forget token
              </button>
            )}
          </div>
        </form>

        <p className="review-form__status" role="status" aria-live="polite">{message}</p>

        {state === 'ready' && (
          <div className="moderation-columns">
            <div className="reviews-list">
              <div className="reviews-list__head">
                <h2>Waiting for review</h2>
                <span className="reviews-list__meta">{pending.length} pending</span>
              </div>

              {!pending.length && (
                <div className="reviews-empty">
                  <p>The queue is empty. New notes land here as they arrive.</p>
                </div>
              )}

              {pending.map((review) => (
                <article className="review-card" key={review.id}>
                  <header>
                    <div>
                      <h3>{review.name}</h3>
                      <p className="review-card__meta">
                        {review.app} · {formatDate(review.createdAt)} · {review.rating}/5
                      </p>
                    </div>
                  </header>
                  <p className="review-card__body">{review.body}</p>
                  <div className="review-card__actions">
                    <button
                      className="btn btn--primary btn--small"
                      type="button"
                      disabled={busy === review.id}
                      onClick={() => act(review.id, 'approve')}
                    >
                      Publish
                    </button>
                    <button
                      className="btn btn--outline btn--small"
                      type="button"
                      disabled={busy === review.id}
                      onClick={() => act(review.id, 'reject')}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="reviews-list">
              <div className="reviews-list__head">
                <h2>Published</h2>
                <span className="reviews-list__meta">{approved.length} live</span>
              </div>

              {!approved.length && (
                <div className="reviews-empty">
                  <p>Nothing is published yet.</p>
                </div>
              )}

              {approved.map((review) => (
                <article className="review-card" key={review.id}>
                  <header>
                    <div>
                      <h3>{review.name}</h3>
                      <p className="review-card__meta">
                        {review.app} · {formatDate(review.createdAt)} · {review.rating}/5
                      </p>
                    </div>
                  </header>
                  <p className="review-card__body">{review.body}</p>
                  <div className="review-card__actions">
                    <button
                      className="btn btn--outline btn--small"
                      type="button"
                      disabled={busy === review.id}
                      onClick={() => act(review.id, 'delete')}
                    >
                      Unpublish
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
