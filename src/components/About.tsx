import { PRODUCTS } from './Apps'

export default function About() {
  return (
    <section className="section about-page" aria-labelledby="about-title">
      <div className="container">
        <div className="about-hero">
          <div className="about-hero__copy">
            <p className="eyebrow">A NOTE FROM THE BUILDER</p>
            <h1 className="about-title" id="about-title">About me<span>.</span></h1>
            <p className="about-lede">
              I’m the builder behind CensorisLabs. I care about software that feels thoughtful,
              solves a clear problem, and leaves people in control of their own information.
            </p>
            <p className="about-body">
              I’m building a small suite of useful tools for everyday life: money, health,
              technology, learning, entertainment, and the world around us. I try to keep
              personal entries on your device, make exports understandable, and make network
              features clear when an app needs outside sources. The goal is practical software
              that is calm to use and honest about what it can do.
            </p>
            <div className="about-actions">
              <a className="btn btn--primary" href="#/apps">Explore all apps <span aria-hidden="true">↗</span></a>
              <a className="btn btn--outline" href="mailto:hello@censorislabs.online">Get in touch</a>
            </div>
          </div>
          <aside className="about-snapshot" aria-label="CensorisLabs at a glance">
            <p className="eyebrow">BUILT WITH INTENTION</p>
            <div className="about-snapshot__number">{PRODUCTS.length.toString().padStart(2, '0')}</div>
            <h2>focused apps</h2>
            <p>One shared suite, with useful tools for different parts of daily life.</p>
            <ul>
              <li>Android and Windows releases</li>
              <li>Four site themes and a low-end mode</li>
              <li>Local-first features where they fit</li>
            </ul>
          </aside>
        </div>

        <section className="about-values" aria-labelledby="about-values-title">
          <div className="about-section-heading">
            <p className="eyebrow">HOW I BUILD</p>
            <h2 id="about-values-title">Useful first. Respectful by design.</h2>
          </div>
          <div className="about-values__grid">
            <article><span>01</span><h3>Your information stays yours</h3><p>Personal entries are stored on the device in apps designed for local use. Export and restore options help you keep a copy you control.</p></article>
            <article><span>02</span><h3>Clear about the connection</h3><p>Some tools search news, public archives, streaming availability, or social servers. Those features need the internet and link back to their sources.</p></article>
            <article><span>03</span><h3>Designed for real devices</h3><p>Choose from Obsidian, Ocean, Amethyst, and Ember themes. Low-end mode reduces motion, blur, and decorative effects.</p></article>
          </div>
        </section>

        <section className="about-catalog" aria-labelledby="about-catalog-title">
          <div className="about-section-heading about-section-heading--catalog">
            <div>
              <p className="eyebrow">THE FULL APP CATALOG</p>
              <h2 id="about-catalog-title">What the suite can do</h2>
            </div>
            <p>Every app below links to its page, feature list, and available downloads.</p>
          </div>
          <div className="about-app-grid">
            {PRODUCTS.map((product, index) => (
              <article className="about-app-card" key={product.id}>
                <div className="about-app-card__head">
                  <span className="about-app-card__index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="suite-card__kind">{product.kind}</span>
                </div>
                <h3>{product.name}</h3>
                <p className="about-app-card__description">{product.description}</p>
                <div className="about-app-card__features">
                  <div><h4>Free features</h4><ul>{product.free.map(feature => <li key={feature}>{feature}</li>)}</ul></div>
                  <div className="about-app-card__pro"><h4>Pro feature set</h4><ul>{product.pro.map(feature => <li key={feature}>{feature}</li>)}</ul></div>
                </div>
                <a className="about-app-card__link" href={`#/apps/${product.id}`}>View app details <span aria-hidden="true">↗</span></a>
              </article>
            ))}
          </div>
          <p className="about-note">
            Feature lists describe each app’s current free and Pro offering. Pro checkout and
            payment verification are not connected yet, so purchases and discounts cannot be
            completed on this site.
          </p>
        </section>

        <section className="about-close" aria-label="Contact CensorisLabs">
          <div><p className="eyebrow">BUILDING IN PUBLIC, ONE TOOL AT A TIME</p><h2>Have an idea or a useful bit of feedback?</h2></div>
          <a className="btn btn--outline" href="mailto:hello@censorislabs.online">Write to CensorisLabs <span aria-hidden="true">↗</span></a>
        </section>
      </div>
    </section>
  )
}