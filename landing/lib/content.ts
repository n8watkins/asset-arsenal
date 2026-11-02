/** Page copy, kept apart from layout so it is easy to keep honest and in step with docs/SKINS_CONCEPT.md. */

export const steps = [
  {
    title: "Show it your page",
    body: "A screenshot of the page you want to dress up, plus what makes it yours: your logo, your colors and a few images you already use.",
  },
  {
    title: "Pick a direction",
    body: "Describe a style, or start from one: closer to your brand, high fantasy, sci-fi, paper craft. You get a few full-page concepts and keep the one you love.",
  },
  {
    title: "Break it down",
    body: "It finds every asset in that concept (header art, card frames, buttons, icons, dividers, the background) and lists them for you to check.",
  },
  {
    title: "Build each asset",
    body: "Each one is generated again on its own, zoomed in and full size on a transparent background, matching the concept. Keep the good ones, reject the misses, retry any single piece.",
  },
] as const;

export const pack = [
  { title: "Backgrounds and textures", body: "Full-page art and tiles that repeat cleanly." },
  { title: "Frames and panels", body: "Card and modal borders cut so they stretch to any size." },
  { title: "Buttons with states", body: "Normal, hover and pressed, in the same style." },
  { title: "Icons", body: "A matching set for the actions your page already has." },
  { title: "Illustrations", body: "Hero art, empty states and spot illustrations." },
  { title: "Dividers, badges and ornaments", body: "The small pieces that make a style feel finished." },
  { title: "A theme file", body: "Colors and font suggestions as CSS variables, to match the art." },
  { title: "A preview", body: "The assets placed back on your page, so you see the result before you ship it." },
] as const;

export const uses = [
  {
    title: "Make your site look like you",
    body: "Not \"a green page for a green brand\". Start from your own logo and images, and get art and parts that feel designed for your product.",
  },
  {
    title: "Give your users skins",
    body: "Like skins in a game: ship a few themes, from a calm default to something bold, and let people pick the one they want.",
  },
] as const;

export const workbench = [
  { title: "Keep or reject", body: "Box the assets you like and the ones you don't; rejected ones are regenerated, kept ones are locked." },
  { title: "Retry one piece", body: "Redo a single button or icon without touching the rest of the set." },
  { title: "Lock the style", body: "New assets you add later match the ones you already kept." },
  { title: "See the cost first", body: "Every run shows what it will cost before it starts." },
] as const;

export const compare = [
  {
    name: "ChatGPT or Gemini, by hand",
    good: "Great at reimagining a screenshot in a new style.",
    gap: "You get one flat picture. Cutting it into usable, transparent, full-size assets is all manual.",
  },
  {
    name: "Lovart",
    good: "A design agent with a brand kit; makes brand identities, mockups and campaigns.",
    gap: "Built for marketing designs, not for taking your live page apart into parts you drop back in.",
  },
  {
    name: "Recraft",
    good: "Consistent, brand-styled images and icons, including true vectors.",
    gap: "You describe each asset yourself; it doesn't start from your page or work out which assets it needs.",
  },
  {
    name: "Visily and Uizard",
    good: "Turn a screenshot into an editable layout and restyle it with a theme.",
    gap: "The restyle is colors, fonts and components, not new art; no illustrated frames, textures or hero images.",
  },
  {
    name: "Google Stitch and Figma Make",
    good: "Generate whole screens and front-end code from prompts and images.",
    gap: "Aimed at layouts and code; the visual style stays close to standard UI.",
  },
  {
    name: "Scenario",
    good: "Game-studio asset generation with custom style models.",
    gap: "Made for game teams, with style training up front; not aimed at web pages.",
  },
] as const;

export const faq = [
  {
    q: "Is it built?",
    a: "Not yet. A working workbench on my machine already turns a source image into a matching set of standalone icons, with keep, reject and retry. This page describes the next step: whole-page skins. There is no release date.",
  },
  {
    q: "Can I ask for a Warcraft or Lord of the Rings skin?",
    a: "You can ask for the feel: high fantasy, gothic, retro arcade, cozy pixel art. It won't copy someone else's characters, logos or trademarks, because the assets need to be yours to ship.",
  },
  {
    q: "Will each asset match the concept exactly?",
    a: "Close, not pixel for pixel. Each asset is made again at full size, using the concept and its crop as the reference. That is why keep, reject and retry are built in.",
  },
  {
    q: "What will it cost?",
    a: "Pricing isn't set. Image model costs today come to roughly one to three dollars for a skin: a few full-page concepts plus a dozen assets with some retries. The plan is to pay per skin, with a free first run, and to let people who self-host bring their own API key.",
  },
  {
    q: "Which image models does it use?",
    a: "Today the workbench uses OpenAI's and Google's image models, picking per step by quality and cost. That will change as models improve.",
  },
  {
    q: "Who owns the assets?",
    a: "You do, within the image model provider's terms. Nothing you upload is used for anything except your own runs.",
  },
] as const;
