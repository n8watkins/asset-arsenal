// Page skins - the fixed sample landing page every skin is applied to.
//
// The page is split into two layers so a skin can restyle it without breaking it:
//   - LAYOUT_CSS owns structure (grid, spacing, sizes). Skins never touch it.
//   - The skin layer is CSS custom properties (tokens) plus component CSS limited
//     to the classes in SKINNABLE_CLASSES (see sanitize.ts).
// Imagery slots: --skin-texture on .page, and <img> tags for the hero art and emblem.

/** Classes a skin's component CSS may target, with what each one is. */
export const SKINNABLE_CLASSES: Record<string, string> = {
  "page": "the <body>-level wrapper; owns the page background and texture",
  "nav": "top navigation bar",
  "brand": "logo lockup in the nav (emblem image + product name)",
  "nav-link": "plain text links in the nav",
  "hero": "first section: headline, subhead, two buttons, hero art",
  "eyebrow": "small label above headings",
  "headline": "the big hero h1",
  "lede": "hero subhead paragraph",
  "btn": "every button and button-like link",
  "btn-primary": "main call to action (also has .btn)",
  "btn-ghost": "secondary action (also has .btn)",
  "hero-art": "frame around the generated hero illustration",
  "logos": "strip of customer names under the hero",
  "logo-word": "one customer name in the strip",
  "section": "every content section after the hero",
  "section-title": "h2 of a section",
  "card": "feature card and pricing card surface",
  "card-icon": "small square icon badge in a feature card",
  "card-title": "h3 inside a card",
  "quote": "testimonial block",
  "quote-text": "the testimonial sentence",
  "quote-by": "testimonial attribution",
  "price": "large price figure in a pricing card",
  "tier-featured": "the highlighted pricing card (also has .card)",
  "badge": "small pill label (e.g. 'Most popular')",
  "signup": "email signup panel near the bottom",
  "input": "the email text input",
  "divider": "decorative rule between sections",
  "footer": "page footer",
};

export const SAMPLE_PAGE_DESCRIPTION = `A landing page for "Fieldnote", a shared journal app for small teams.
Sections, top to bottom: nav (emblem + name, 3 links, a primary button); hero (eyebrow, headline "Write it down together.",
lede, primary + ghost buttons, a large illustration on the right); a strip of 5 customer names; "Why teams keep a Fieldnote"
with 3 feature cards (icon badge, title, sentence); a testimonial quote; 3 pricing cards (middle one featured with a
'Most popular' badge); an email signup panel; a footer.`;

const ICONS = {
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.8.3 5 2.7 5 5.8"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

/** Structural CSS. Uses only skin tokens for color, type and shape. */
export const LAYOUT_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0}
img{max-width:100%;display:block}
.page{min-height:100vh;background-color:var(--bg);background-image:linear-gradient(var(--texture-veil),var(--texture-veil)),var(--skin-texture,none);background-size:auto,var(--texture-size,512px);color:var(--text);font-family:var(--font-body);font-size:17px;line-height:1.6;overflow-x:hidden}
.wrap{max-width:1160px;margin:0 auto;padding:0 24px}
.nav{position:relative;z-index:2;border-bottom:var(--border-width) solid var(--border)}
.nav .wrap{display:flex;align-items:center;gap:28px;height:76px}
.brand{display:flex;align-items:center;gap:10px;font-family:var(--font-display);font-weight:var(--display-weight);font-size:22px;color:var(--text);text-decoration:none;margin-right:auto}
.brand img{width:40px;height:40px;object-fit:contain}
.nav-link{color:var(--muted);text-decoration:none;font-size:15px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 22px;font:600 15px/1 var(--font-body);text-decoration:none;cursor:pointer;border-radius:var(--radius);border:var(--border-width) solid transparent;white-space:nowrap}
.btn-primary{background:var(--primary);color:var(--on-primary);box-shadow:var(--shadow)}
.btn-ghost{background:transparent;color:var(--text);border-color:var(--border)}
.hero .wrap{display:grid;grid-template-columns:1.05fr 1fr;gap:56px;align-items:center;padding-top:72px;padding-bottom:72px}
.eyebrow{display:inline-block;font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 14px}
.headline{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-tracking);font-size:clamp(42px,6vw,76px);line-height:1.02;margin:0 0 20px;color:var(--text)}
.lede{font-size:19px;color:var(--muted);max-width:34em;margin:0 0 30px}
.actions{display:flex;flex-wrap:wrap;gap:12px}
.hero-art{aspect-ratio:3/2;border-radius:var(--radius);overflow:hidden;background:var(--surface);position:relative;border:var(--border-width) solid var(--border);box-shadow:var(--shadow)}
.hero-art img{width:100%;height:100%;object-fit:cover}
.logos .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px 32px;padding-top:28px;padding-bottom:28px;border-top:var(--border-width) solid var(--border);border-bottom:var(--border-width) solid var(--border)}
.logo-word{font-family:var(--font-display);font-size:20px;color:var(--muted);opacity:.85}
.section .wrap{padding-top:88px;padding-bottom:16px}
.section-title{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-tracking);font-size:clamp(30px,4vw,44px);line-height:1.1;margin:0 0 36px;color:var(--text);max-width:18em}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.card{background:var(--surface);color:var(--text);border:var(--border-width) solid var(--border);border-radius:var(--radius);padding:28px;box-shadow:var(--shadow)}
.card p{margin:0;color:var(--muted)}
.card-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:calc(var(--radius) * .6);background:var(--accent);color:var(--on-accent);margin-bottom:18px}
.card-icon svg{width:24px;height:24px}
.card-title{font-family:var(--font-display);font-weight:var(--display-weight);font-size:22px;line-height:1.2;margin:0 0 8px;color:var(--text)}
.quote{margin:0;padding:44px 48px;background:var(--surface);border:var(--border-width) solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}
.quote-text{font-family:var(--font-display);font-size:clamp(24px,3vw,34px);line-height:1.3;margin:0 0 18px;color:var(--text)}
.quote-by{color:var(--muted);font-size:15px}
.tier{display:flex;flex-direction:column;gap:14px;position:relative}
.tier ul{list-style:none;padding:0;margin:4px 0 8px;display:grid;gap:8px;color:var(--muted);font-size:15px}
.tier .btn{margin-top:auto}
.price{font-family:var(--font-display);font-weight:var(--display-weight);font-size:44px;line-height:1;color:var(--text)}
.price small{font-size:15px;font-family:var(--font-body);color:var(--muted);font-weight:400}
.badge{position:absolute;top:-13px;right:20px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 12px;border-radius:999px;background:var(--accent);color:var(--on-accent)}
.signup{display:grid;grid-template-columns:1fr auto;gap:32px;align-items:center;padding:44px 48px;background:var(--surface);border:var(--border-width) solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}
.signup h2{margin:0 0 6px}
.signup p{margin:0;color:var(--muted)}
.signup form{display:flex;gap:10px}
.input{min-height:46px;width:260px;padding:0 16px;font:15px var(--font-body);color:var(--text);background:var(--bg);border:var(--border-width) solid var(--border);border-radius:var(--radius)}
.input::placeholder{color:var(--muted)}
.divider{height:var(--border-width);background:var(--border);margin:88px 0 0;border:0}
.footer .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:16px 28px;padding-top:36px;padding-bottom:48px;color:var(--muted);font-size:14px}
.footer .brand{font-size:18px}
.footer .brand img{width:30px;height:30px}
@media (max-width:860px){
  .nav .nav-link{display:none}
  .hero .wrap{grid-template-columns:1fr;gap:36px;padding-top:44px;padding-bottom:48px}
  .grid-3{grid-template-columns:1fr}
  .section .wrap{padding-top:64px}
  .quote{padding:30px 26px}
  .signup{grid-template-columns:1fr;padding:30px 26px}
  .signup form{flex-direction:column}
  .input{width:100%}
  .hero-art img{width:100%;height:100%;object-fit:cover}
.logos .wrap{justify-content:center}
}
`;

/** The page body. Image slots are filled by render.ts. */
export function samplePageBody(emblemSrc: string | null, heroSrc: string | null): string {
  const hero = heroSrc ? `<img src="${heroSrc}" alt="">` : "";
  const emblem = emblemSrc ? `<img src="${emblemSrc}" alt="">` : "";
  return `
<div class="page">
  <header class="nav"><div class="wrap">
    <a class="brand" href="#">${emblem}<span>Fieldnote</span></a>
    <a class="nav-link" href="#">Features</a>
    <a class="nav-link" href="#">Pricing</a>
    <a class="nav-link" href="#">Stories</a>
    <a class="btn btn-primary" href="#">Start free</a>
  </div></header>

  <section class="hero"><div class="wrap">
    <div>
      <p class="eyebrow">The team journal</p>
      <h1 class="headline">Write it down together.</h1>
      <p class="lede">Fieldnote gives your team one shared notebook for decisions, wins and what you learned this week, so nothing important lives in someone's head.</p>
      <div class="actions">
        <a class="btn btn-primary" href="#">Start your notebook</a>
        <a class="btn btn-ghost" href="#">See a sample</a>
      </div>
    </div>
    <div class="hero-art" role="img" aria-label="Illustration">${hero}</div>
  </div></section>

  <section class="logos"><div class="wrap">
    <span class="logo-word">Northwind</span><span class="logo-word">Halcyon</span><span class="logo-word">Pinegrove</span><span class="logo-word">Lattice Co.</span><span class="logo-word">Marlow</span>
  </div></section>

  <section class="section"><div class="wrap">
    <p class="eyebrow">Why it works</p>
    <h2 class="section-title">Why teams keep a Fieldnote</h2>
    <div class="grid-3">
      <article class="card"><div class="card-icon">${ICONS.pen}</div><h3 class="card-title">Write in seconds</h3><p>Open today's page, type a line, tag a teammate. No templates to fill in.</p></article>
      <article class="card"><div class="card-icon">${ICONS.people}</div><h3 class="card-title">Everyone, same page</h3><p>Decisions and context sit in one place the whole team can read.</p></article>
      <article class="card"><div class="card-icon">${ICONS.clock}</div><h3 class="card-title">Look back easily</h3><p>Find what you decided in March in one search, with who was there.</p></article>
    </div>
  </div></section>

  <section class="section"><div class="wrap">
    <figure class="quote">
      <p class="quote-text">"We stopped re-arguing old decisions. It's all in the notebook."</p>
      <figcaption class="quote-by">Priya Raman, Head of Product at Halcyon</figcaption>
    </figure>
  </div></section>

  <section class="section"><div class="wrap">
    <p class="eyebrow">Pricing</p>
    <h2 class="section-title">Simple plans</h2>
    <div class="grid-3">
      <div class="card tier"><h3 class="card-title">Solo</h3><div class="price">$0 <small>/ month</small></div><ul><li>1 notebook</li><li>30 days of history</li></ul><a class="btn btn-ghost" href="#">Start free</a></div>
      <div class="card tier tier-featured"><span class="badge">Most popular</span><h3 class="card-title">Team</h3><div class="price">$8 <small>/ person</small></div><ul><li>Unlimited notebooks</li><li>Full history and search</li><li>Mentions and digests</li></ul><a class="btn btn-primary" href="#">Try Team</a></div>
      <div class="card tier"><h3 class="card-title">Company</h3><div class="price">$14 <small>/ person</small></div><ul><li>Everything in Team</li><li>SSO and audit log</li></ul><a class="btn btn-ghost" href="#">Talk to us</a></div>
    </div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="signup">
      <div><h2 class="section-title">Start this week's page</h2><p>Free for your first notebook. No card needed.</p></div>
      <form onsubmit="return false"><input class="input" type="email" placeholder="you@team.com" aria-label="Email"><button class="btn btn-primary" type="submit">Get started</button></form>
    </div>
    <hr class="divider">
  </div></section>

  <footer class="footer"><div class="wrap">
    <a class="brand" href="#">${emblem}<span>Fieldnote</span></a>
    <span>Made for teams who write things down.</span>
    <span>Privacy</span><span>Terms</span>
  </div></footer>
</div>`;
}
