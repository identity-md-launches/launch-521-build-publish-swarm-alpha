# SWARM ALPHA design

## Overview

SWARM ALPHA helps people new to IdentityMD find projects, open their websites, and inspect the public evidence behind them. Its light theme uses a light grey page, white cards, dark text, and blue actions. A remembered dark theme uses the same component hierarchy. Discovery comes first; detailed attribution, contracts, delivery claims, and history appear on individual project pages.

The source of truth is `src/styles.css`, with component patterns in `src/App.tsx`. `src/model.ts` builds the directory's view models; it is not a scoring system. Branding lives in `src/config.ts:2` (`brand.name`, `brand.tagline`, `brand.logo`, `brand.favicon`). No approved brand attachment was present in the supplied inputs. The logo and favicon paths therefore remain empty, rather than substituting another Pepe. Project logos under `public/logos/` are separate, sourced project assets.

## Colors

The two token blocks are `:root` (`src/styles.css:8`) and `:root[data-theme=dark]` (`src/styles.css:41`). Values use hexadecimal notation. Components consume tokens by their role; do not introduce a parallel palette.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#f5f6f8` | `#12161e` | Page background |
| `--surface` | `#fff` | `#1c222d` | Cards, panels, header, footer, controls |
| `--surface-soft` | `#f8f9fb` | `#242c39` | Inset information, neutral badges, request history |
| `--text` | `#1d2636` | `#f0f3f8` | Headings and primary text |
| `--muted` | `#596575` | `#b2bece` | Descriptions, metadata, secondary links |
| `--border` | `#e1e5eb` | `#354052` | Separators and structural outlines |
| `--control` | `#8491a3` | `#6a7a91` | Field and button boundaries |
| `--accent` | `#245bd6` | `#98b8ff` | Links and selected navigation |
| `--accent-hover` | `#1948b3` | `#bed2ff` | Detail-action hover text |
| `--accent-soft` | `#edf3ff` | `#263650` | Detail buttons and evidence callouts |
| `--focus` | `#245bd6` | `#98b8ff` | Keyboard outlines |
| `--green` / `--green-bg` | `#21714a` / `#edf7f0` | `#9dd9b5` / `#223c2e` | Published/Delivered labels |
| `--amber` / `--amber-bg` | `#875719` / `#fff5e4` | `#f4d197` / `#413423` | Partial delivery and testnet labels |
| `--red` / `--red-bg` | `#aa3440` / `#fff0f0` | `#ffb0b8` / `#422930` | Broken promises |

Primary buttons retain `#245bd6` with white text in both themes and use `#1948b3` on hover. Badges always carry text: color alone never establishes status. The declared `--subtle` token has no component consumers. Contrast measurements and their scope belong in `artifacts/validation.md`; this document does not imply every rendered pairing was tested.

The theme button in `App` sets the root `data-theme` attribute and saves `swarm-alpha-theme` in local storage. `index.html` reads that preference before React mounts. Light is the default; unavailable storage does not prevent a session theme change.

## Typography

The root stack is `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, at `16px`, with body line height `1.55`. Inter is used only if installed; platform fonts otherwise render the text. No body font file or remote font request is required. The brand and footer request `"Comic Sans MS", "Comic Sans", "Comic Neue", cursive` (`src/styles.css:209`). Comic Sans is preferred when installed; it was unavailable in the test browser and its proprietary font file is not included. The local `src/assets/comic-neue-bold.woff2` supplies the 700 normal Comic Neue fallback through `@font-face` (`src/styles.css:1`), with `font-display: swap`. Its SIL Open Font License is preserved in `public/fonts/OFL.txt`. Comic Neue is a fallback, not a claim that Comic Sans rendered.

The CSS requests weights 400, 500, 550, 600, 650 and 700; the active system font determines the actual available faces. Brand type is 24px on desktop and 20px on small screens. The main display heading uses `clamp(2rem, 4.3vw, 3.6rem)`, weight 700, letter spacing `-.045em`, and line height `1.25`, with breakpoint overrides. Detail headings are 40px, reducing to 28.8px on small screens. Default section headings are 24px, panel headings 20px, and card headings 17px (18px on small screens). The final metadata rule (`src/styles.css:1823`) sets domains, badges, claim labels, card metadata, field labels and repeated actions to `.75rem` (12px); this later rule supersedes their earlier smaller declarations. Smaller decorative eyebrows remain. Mobile search inputs and selects use at least 16px text.

Paragraphs use `text-wrap: pretty`; headings use `text-wrap: balance`. Card descriptions are clamped to three lines; the project's detail page and expandable original requests retain the expanded context. Description line heights are 1.7–1.8. Long addresses, domains, IDs and original requests wrap. Code uses `ui-monospace, SFMono-Regular, Consolas, monospace`; timeline dates, result counters and pagination use tabular numerals. Text remains selectable. Links inside `.panel` that are not `.button` actions have persistent underlines with `text-decoration-thickness: from-font`; their affordance does not depend on blue text alone.

## Layout

`.container` centers content at a maximum width of 1248px with 36px horizontal padding. At 1600px and above its maximum grows to 1344px. The header has its own 1344px maximum. Repeated spacing values are 8–12px within small controls, 16–24px within cards and groups, and 28–64px between major sections; these are component declarations rather than named spacing variables.

The home page combines a two-column introduction, a full-width search/filter area, a three-column project grid, then the complete record directory. The directory is an article list styled as aligned columns, not a semantic data table. Detail pages use a main column plus a 265px evidence sidebar; the section navigation wraps in normal document flow. The evidence page caps its own width at 880px.

| Breakpoint | Implemented changes |
| --- | --- |
| `max-width: 68rem` (`src/styles.css:1357`) | Tighter header/hero gaps; smaller card padding; brand directory pill and search hint disappear; sidebar becomes 230px; agent cards stack. |
| `max-width: 53rem` (`src/styles.css:1395`) | 24px content margins; header navigation moves to a second row; introduction becomes one column and its optional note disappears; project cards become two columns; detail sidebar moves below the main content; directory publication date is hidden. |
| `max-width: 37rem` (`src/styles.css:1479`) | 18px margins; one project per row; search/filter groups stack; directory rows become vertical records; detail sidebar, overview, and agents become one column; website action fills the detail width; footer stacks. The later small-screen rule also allows card actions to wrap. |

Controls stay inside the content margins. Grid tracks use `minmax(0, …)` and long values wrap. Original requests have a 440px maximum height with vertical scrolling; coverage JSON uses 500px. Production browser checks covered home and detail horizontal overflow at 320, 390, 834 and 1440 CSS pixels; screenshots were inspected for light mobile and dark desktop states. Detailed commands, screenshots, zoom limitations and interaction results are recorded in `artifacts/validation.md`.

## Elevation & Depth

The design uses restrained depth. `--shadow` is `0 2px 5px #17264d03, 0 6px 18px #17264d03` in light mode and `none` in dark mode. Project cards, the hero note, and the primary search use this shadow alongside structural 1px borders. Dividers separate metadata, request disclosures, timeline entries, and directory records. Inset content uses `--surface-soft`; nothing relies on blur, glass effects or gradients.

There is no fixed header, modal, floating overlay, or autoplay media. Only the keyboard skip link uses an elevated stacking level (`z-index: 100`).

## Shapes

Project cards use 15px radii; detail panels 14px; directory panels 13px; search and evidence callouts 12px. Buttons and selects generally use 7px, inner notes 8px, and badges 5px. Avatars are square with 12px corners (48px default size), with 38px/9px small and 76px/18px detail variants. Avatar images use `object-fit: contain` and a 1px inset pure-black 10% outline, switching to pure white 10% in dark mode; unavailable project assets fall back to neutral initials. Status dots and timeline markers are circles.

## Components

All patterns below are local functions in `src/App.tsx`, with their classes in `src/styles.css`; they are not a separate component library.

| Pattern | Reuse and behavior |
| --- | --- |
| `OutLink` (`src/App.tsx:40`) | Validates an HTTP(S) destination through `safeUrl`; opens external links in a new tab with `noopener noreferrer` and a decorative arrow. Missing destinations render “Not recorded”. Use its `label` prop when surrounding context is needed for the accessible name. |
| `Badge` (`src/App.tsx:67`) | Neutral, green, amber and red tones. Keep explicit status wording; green includes a redundant dot. |
| `Avatar` (`src/App.tsx:81`) | Accepts `name`, optional `src`, and `small`; uses initials after an image error. Images beside named content use empty alt text to avoid repetition; fallback initials have a named img role. |
| `ProjectCard` (`src/App.tsx:175`) | Project logo/initials, status, name, domain, public purpose claim, category, attribution and check date. “Project details” and “Open website” remain separate links. |
| `Pagination` (`src/App.tsx:130`) | Native previous/next buttons, visible page/range text, contextual navigation label, native disabled endpoints; defaults to nine projects and accepts ten-record directory pages. |
| `Directory` (`src/App.tsx:240`) | Independent search and record-type filter, persistent result status, full discovered-record coverage, website/detail/IPFS links, paginated rows and recoverable empty state. |
| `CopyButton` (`src/App.tsx:670`) | Copies the full visible contract address. Announces “Copied”, or explains manual selection when the clipboard is unavailable. |
| `.panel` | Detail/evidence grouping with a heading. Combine with `.overview-grid`, `.agents-grid`, `.contract-row`, `.promise-row` or `.timeline` for the relevant evidence type. |
| Native `details` / `summary` | Expand original requests and version records without a custom keyboard widget. Keep source links available beside the preserved text. |

Searches are labelled; native links, buttons and selects provide keyboard behavior. The first focusable element skips to the main landmark. Project section links use hash routing and focus the destination section. The shared `:focus-visible` outline is 3px with a 3px offset; forced colors substitutes system `Highlight`. Search also highlights its surrounding field on focus. Loading, unavailable snapshot, unknown project, empty results, copy feedback and refresh feedback have explicit messages and recovery paths. Refresh failures retain the complete existing snapshot.

Hover effects are gated by `hover: hover`. Button press motion is a 150ms `ease-out` transform to scale `.96`, enabled only by `prefers-reduced-motion: no-preference`. Theme changes have no color transitions. There are no entrance animations or video.

## Do's and Don'ts

- Start a new page inside `.container`, give it one `h1`, and reuse `.panel` for evidence groups. Add the route in `App` using a hash path so static and IPFS subpath hosting works.
- Use the blue filled action for the page's main action; use `.detail-button` for repeated project detail links and ordinary links for sources. Give repeated links context in their accessible names.
- Reuse semantic color tokens and both theme blocks. Use `--control` for inputs and `--border` for content separation.
- Keep claims, publication, reachability, feature tests, and unknowns distinct. A green publication badge is not a feature or financial-safety endorsement.
- Keep actual addresses and IDs selectable and wrap long values. Do not shorten away the only accessible copy of evidence.
- Change the public name and approved artwork through `src/config.ts`; do not fabricate or substitute the missing brand attachment. Preserve project-logo provenance and neutral fallback behavior.

This document follows the supplied implementation-documentation method. Design guidance: [Jakub Krehel's Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface), copyright 2026 Jakub Krehel, MIT, pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. Documentation method: [Paul Bakaus's Impeccable](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md), copyright 2025 Paul Bakaus, Apache-2.0, pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. The methods were adapted to document this implementation; the two works retain their respective licenses.

Scrollable request and coverage blocks in `src/App.tsx` are named regions with `tabIndex={0}` so keyboard users can scroll their complete contents. Final automated scan details and all measured rendered pairs are recorded in `artifacts/validation.md`.
