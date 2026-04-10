<svelte:head>
  <title>Nuit One — Your Instruments. Real Scores. One Stage.</title>
  <meta name="description" content="Nuit One transforms any song into an interactive performance. AI splits the stems — you play along with your real instrument and get scored in real-time." />
  <meta property="og:title" content="Nuit One — Your Instruments. Real Scores. One Stage." />
  <meta property="og:description" content="AI-powered stem separation meets real-time instrument scoring. Upload any song, pick your instrument, and perform." />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Nuit One" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Nuit One — Your Instruments. Real Scores. One Stage." />
  <meta name="twitter:description" content="AI-powered stem separation meets real-time instrument scoring. Upload any song, pick your instrument, and perform." />
</svelte:head>

<div class="landing-page">
  <!-- ============================================================ -->
  <!-- HERO                                                         -->
  <!-- ============================================================ -->
  <header class="hero" id="hero">
    <div class="hero-orbs" aria-hidden="true">
      <div class="orb orb-cyan"></div>
      <div class="orb orb-magenta"></div>
      <div class="orb orb-violet"></div>
    </div>

    <div class="hero-content">
      <h1 class="hero-headline">
        Your Instruments.<br />
        Real Scores.<br />
        <span class="hero-headline-accent">One Stage.</span>
      </h1>

      <p class="hero-sub">
        Nuit One transforms any song into an interactive performance.
        AI splits the stems&nbsp;&mdash; you play along with your real instrument
        and get scored in real-time.
      </p>

      <div class="hero-ctas">
        <a href="/auth/login" class="btn btn-primary">Get Started</a>
        <a href="#how-it-works" class="btn btn-ghost">Learn More</a>
      </div>
    </div>

    <div class="scroll-indicator" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>
  </header>

  <main>
    <!-- ============================================================ -->
    <!-- HOW IT WORKS                                                 -->
    <!-- ============================================================ -->
    <section class="section" id="how-it-works">
      <h2 class="section-heading">How It Works</h2>

      <div class="steps">
        <div class="step glass-card">
          <span class="step-number">1</span>
          <div class="step-icon" aria-hidden="true">
            <!-- Upload icon -->
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3 class="step-title">Upload</h3>
          <p class="step-desc">Drop in any song or paste a YouTube link.</p>
        </div>

        <div class="step-connector" aria-hidden="true"></div>

        <div class="step glass-card">
          <span class="step-number">2</span>
          <div class="step-icon" aria-hidden="true">
            <!-- Wand / magic icon -->
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
              <path d="M17.8 11.8 19 13" /><path d="M15 9h0" />
              <path d="M17.8 6.2 19 5" /><path d="M11 6.2 9.7 5" /><path d="M11 11.8 9.7 13" />
              <path d="m8 21 8-8" /><path d="M3 16l2 2" />
            </svg>
          </div>
          <h3 class="step-title">AI Splits</h3>
          <p class="step-desc">Demucs AI separates vocals, bass, drums, and guitar.</p>
        </div>

        <div class="step-connector" aria-hidden="true"></div>

        <div class="step glass-card">
          <span class="step-number">3</span>
          <div class="step-icon" aria-hidden="true">
            <!-- Music / guitar icon -->
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <h3 class="step-title">Play Along</h3>
          <p class="step-desc">Pick your instrument and perform with the backing track.</p>
        </div>

        <div class="step-connector" aria-hidden="true"></div>

        <div class="step glass-card">
          <span class="step-number">4</span>
          <div class="step-icon" aria-hidden="true">
            <!-- Trophy icon -->
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>
          <h3 class="step-title">Get Scored</h3>
          <p class="step-desc">Real-time pitch and timing scoring with grades.</p>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- FEATURES                                                     -->
    <!-- ============================================================ -->
    <section class="section" id="features">
      <h2 class="section-heading">Everything You Need</h2>

      <div class="features-grid">
        <div class="feature-card feature-card--cyan">
          <div class="feature-icon" aria-hidden="true">
            <!-- Multi-instrument icon (users/people) -->
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 class="feature-title">Multi-Instrument</h3>
          <p class="feature-desc">
            Bass, vocals, drums, guitar&nbsp;&mdash; any instrument with a mic.
            Up to 4 players simultaneously.
          </p>
        </div>

        <div class="feature-card feature-card--magenta">
          <div class="feature-icon" aria-hidden="true">
            <!-- AI / brain icon -->
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a4 4 0 0 0-4 4v1H6a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h.5" />
              <path d="M12 2a4 4 0 0 1 4 4v1h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-.5" />
              <path d="M6.5 14.5A5.5 5.5 0 0 0 12 20a5.5 5.5 0 0 0 5.5-5.5" />
              <path d="M12 20v2" />
              <path d="M10 9h4" /><path d="M12 7v4" />
            </svg>
          </div>
          <h3 class="feature-title">AI-Powered</h3>
          <p class="feature-desc">
            State-of-the-art Demucs v4 stem separation.
            Automatic chord, key, and BPM detection.
          </p>
        </div>

        <div class="feature-card feature-card--violet">
          <div class="feature-icon" aria-hidden="true">
            <!-- Sliders / studio icon -->
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </div>
          <h3 class="feature-title">Studio &amp; Stage</h3>
          <p class="feature-desc">
            Full DAW workspace for mixing. Setlist mode for live shows.
            Score tracking and performance stats.
          </p>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- CTA                                                          -->
    <!-- ============================================================ -->
    <section class="section cta-section">
      <div class="cta-orbs" aria-hidden="true">
        <div class="orb orb-cyan orb-small"></div>
        <div class="orb orb-magenta orb-small"></div>
      </div>

      <h2 class="cta-heading">Ready to Play?</h2>
      <p class="cta-sub">
        Join musicians using Nuit One to practice, perform, and push their skills.
      </p>
      <a href="/auth/login" class="btn btn-primary btn-lg">Get Started &mdash; It's Free</a>
    </section>
  </main>

  <!-- ============================================================ -->
  <!-- FOOTER                                                       -->
  <!-- ============================================================ -->
  <footer class="site-footer">
    <div class="footer-inner">
      <span class="footer-brand">
        <span class="footer-brand-accent">Nuit</span> One
      </span>
      <span class="footer-copy">&copy; {new Date().getFullYear()} Nuit One. All rights reserved.</span>
    </div>
  </footer>
</div>

<style>
  /* ================================================================
     ROOT / PAGE WRAPPER
     ================================================================ */
  .landing-page {
    --cyan: #00f5ff;
    --magenta: #ff00e5;
    --violet: #8b5cf6;
    --amber: #f59e0b;
    --green: #00ff88;
    --base: #0a0a0f;
    --surface: #12121a;
    --elevated: #1a1a2e;
    --text-primary: #f0f0f5;
    --text-secondary: #a0a0b0;
    --text-muted: #606070;

    min-height: 100vh;
    overflow-x: hidden;
    scroll-behavior: smooth;
  }

  /* ================================================================
     SHARED
     ================================================================ */
  .section {
    position: relative;
    max-width: 1200px;
    margin: 0 auto;
    padding: 6rem 1.5rem;
  }

  .section-heading {
    font-size: 2rem;
    font-weight: 700;
    text-align: center;
    margin-bottom: 3.5rem;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .glass-card {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
  }

  /* ================================================================
     BUTTONS
     ================================================================ */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1rem;
    border-radius: 0.75rem;
    padding: 0.75rem 1.75rem;
    text-decoration: none;
    transition: all 0.25s ease;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-primary {
    background: linear-gradient(135deg, rgba(0, 245, 255, 0.15), rgba(0, 245, 255, 0.08));
    color: var(--cyan);
    border: 1px solid rgba(0, 245, 255, 0.25);
  }
  .btn-primary:hover {
    background: linear-gradient(135deg, rgba(0, 245, 255, 0.25), rgba(0, 245, 255, 0.14));
    box-shadow: 0 0 30px rgba(0, 245, 255, 0.2), 0 0 60px rgba(0, 245, 255, 0.08);
    border-color: rgba(0, 245, 255, 0.4);
    transform: translateY(-1px);
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .btn-ghost:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-primary);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  .btn-lg {
    padding: 1rem 2.5rem;
    font-size: 1.125rem;
  }

  /* ================================================================
     HERO
     ================================================================ */
  .hero {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 2rem 1.5rem 4rem;
    text-align: center;
    overflow: hidden;
  }

  /* Decorative gradient orbs */
  .hero-orbs {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    will-change: transform;
  }

  .orb-cyan {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(0, 245, 255, 0.35) 0%, transparent 70%);
    top: -10%;
    right: -5%;
    animation: drift-1 18s ease-in-out infinite;
  }

  .orb-magenta {
    width: 450px;
    height: 450px;
    background: radial-gradient(circle, rgba(255, 0, 229, 0.3) 0%, transparent 70%);
    bottom: 5%;
    left: -8%;
    animation: drift-2 22s ease-in-out infinite;
  }

  .orb-violet {
    width: 380px;
    height: 380px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%);
    top: 40%;
    left: 50%;
    transform: translateX(-50%);
    animation: drift-3 20s ease-in-out infinite;
  }

  .orb-small {
    width: 300px;
    height: 300px;
  }

  .orb-small.orb-cyan {
    top: auto;
    right: auto;
    left: 20%;
    bottom: auto;
    top: 50%;
    transform: translateY(-50%);
    animation: drift-1 16s ease-in-out infinite;
  }

  .orb-small.orb-magenta {
    bottom: auto;
    left: auto;
    right: 15%;
    top: 50%;
    transform: translateY(-50%);
    animation: drift-2 19s ease-in-out infinite;
  }

  @keyframes drift-1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -20px) scale(1.05); }
    66% { transform: translate(-20px, 15px) scale(0.97); }
  }

  @keyframes drift-2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-25px, 25px) scale(1.03); }
    66% { transform: translate(20px, -10px) scale(0.96); }
  }

  @keyframes drift-3 {
    0%, 100% { transform: translateX(-50%) scale(1); }
    33% { transform: translateX(-45%) translateY(15px) scale(1.04); }
    66% { transform: translateX(-55%) translateY(-10px) scale(0.98); }
  }

  .hero-content {
    position: relative;
    z-index: 1;
    max-width: 800px;
  }

  .hero-headline {
    font-size: clamp(2.5rem, 7vw, 4.5rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin-bottom: 1.5rem;
  }

  .hero-headline-accent {
    background: linear-gradient(135deg, var(--cyan), var(--violet));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-sub {
    font-size: clamp(1rem, 2.2vw, 1.25rem);
    line-height: 1.7;
    color: var(--text-secondary);
    max-width: 600px;
    margin: 0 auto 2.5rem;
  }

  .hero-ctas {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  /* Scroll indicator */
  .scroll-indicator {
    position: absolute;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    color: var(--text-muted);
    animation: bounce 2s ease-in-out infinite;
    z-index: 1;
  }

  @keyframes bounce {
    0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.5; }
    50% { transform: translateX(-50%) translateY(8px); opacity: 1; }
  }

  /* ================================================================
     HOW IT WORKS — STEPS
     ================================================================ */
  .steps {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 0;
  }

  .step {
    flex: 1;
    max-width: 260px;
    padding: 2rem 1.5rem;
    text-align: center;
    position: relative;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .step:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 40px rgba(0, 245, 255, 0.06);
  }

  .step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    font-size: 0.8rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: var(--cyan);
    background: rgba(0, 245, 255, 0.1);
    border: 1px solid rgba(0, 245, 255, 0.2);
    margin-bottom: 1rem;
  }

  .step-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
    color: var(--text-secondary);
  }

  .step-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .step-desc {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .step-connector {
    width: 48px;
    min-width: 48px;
    height: 1px;
    margin-top: 4.5rem;
    border-top: 2px dashed rgba(255, 255, 255, 0.1);
  }

  /* Mobile steps — vertical stack */
  @media (max-width: 767px) {
    .steps {
      flex-direction: column;
      align-items: center;
      gap: 0;
    }
    .step {
      max-width: 100%;
      width: 100%;
    }
    .step-connector {
      width: 1px;
      min-width: 1px;
      height: 32px;
      margin-top: 0;
      border-top: none;
      border-left: 2px dashed rgba(255, 255, 255, 0.1);
    }
  }

  /* ================================================================
     FEATURES GRID
     ================================================================ */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .feature-card {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 1rem;
    padding: 2rem 1.5rem;
    border-top: 3px solid transparent;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .feature-card:hover {
    transform: translateY(-4px);
  }

  .feature-card--cyan {
    border-top-color: var(--cyan);
  }
  .feature-card--cyan:hover {
    box-shadow: 0 8px 40px rgba(0, 245, 255, 0.08);
  }
  .feature-card--cyan .feature-icon {
    color: var(--cyan);
  }

  .feature-card--magenta {
    border-top-color: var(--magenta);
  }
  .feature-card--magenta:hover {
    box-shadow: 0 8px 40px rgba(255, 0, 229, 0.08);
  }
  .feature-card--magenta .feature-icon {
    color: var(--magenta);
  }

  .feature-card--violet {
    border-top-color: var(--violet);
  }
  .feature-card--violet:hover {
    box-shadow: 0 8px 40px rgba(139, 92, 246, 0.08);
  }
  .feature-card--violet .feature-icon {
    color: var(--violet);
  }

  .feature-icon {
    margin-bottom: 1rem;
    display: flex;
  }

  .feature-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }

  .feature-desc {
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  @media (max-width: 767px) {
    .features-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    .features-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    /* Let the third card span full width centered under the first two */
    .features-grid .feature-card:last-child {
      grid-column: 1 / -1;
      max-width: 400px;
      justify-self: center;
    }
  }

  /* ================================================================
     CTA SECTION
     ================================================================ */
  .cta-section {
    text-align: center;
    padding-top: 4rem;
    padding-bottom: 6rem;
    overflow: hidden;
  }

  .cta-orbs {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .cta-heading {
    font-size: 2.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin-bottom: 1rem;
    position: relative;
    z-index: 1;
  }

  .cta-sub {
    font-size: 1.125rem;
    color: var(--text-secondary);
    max-width: 500px;
    margin: 0 auto 2.5rem;
    line-height: 1.7;
    position: relative;
    z-index: 1;
  }

  .cta-section .btn {
    position: relative;
    z-index: 1;
  }

  /* ================================================================
     FOOTER
     ================================================================ */
  .site-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding: 2rem 1.5rem;
  }

  .footer-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .footer-brand {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .footer-brand-accent {
    color: var(--cyan);
  }

  .footer-copy {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  @media (max-width: 480px) {
    .footer-inner {
      flex-direction: column;
      text-align: center;
    }
  }

  /* ================================================================
     RESPONSIVE TWEAKS
     ================================================================ */
  @media (min-width: 768px) {
    .section-heading {
      font-size: 2.5rem;
    }
    .cta-heading {
      font-size: 3rem;
    }
  }

  /* Reduce motion for accessibility */
  @media (prefers-reduced-motion: reduce) {
    .orb {
      animation: none !important;
    }
    .scroll-indicator {
      animation: none !important;
      opacity: 0.5;
    }
    .step, .feature-card, .btn {
      transition: none !important;
    }
  }
</style>
