# THE TWO SIX CLUB — Official Black & White Brand Integration

The existing app is deployed at https://two-six-club.vercel.app/. I have selected the attached image `assets/two-six-club-emblem-reference.png` as the official visual reference for the brand. Please integrate its aesthetic into the existing app, WITHOUT rebuilding the product.

## Non-negotiables
- First inspect the repository and summarize its framework, styling system, components, routes, auth, Supabase integration, and deployment setup. Don't assume any of them are present until verified.
- Preserve existing features, data, schema, member accounts, admin controls, authentication, workout scheduling, RSVPs, results, and analytics. No destructive migrations, database resets, or secret exposure.
- Keep the GitHub repo private. Never commit `.env` files, credentials, or service-role keys. Do not modify production data without explicit approval.
- Create a branch for visual changes, make focused commits, and show a preview before deploying to production.

## Brand reference and treatment
Official name: THE TWO SIX CLUB. Supporting line: ESTABLISHED 2026.
The reference is a black wall plaque with raised white serif lettering, thin double-line white border, silver corner standoffs, and a symmetrical laurel ornament. It is sophisticated, timeless, athletic, and slightly heritage-club inspired. No lighthouse, waves, anchors, rope knots, gold, or neon. The brand should look equally strong on a matte-black gym wall, on a phone, and in a browser.

Use the uploaded reference image as visual inspiration and preserve it in the repository as a reference. **Do not use the full photograph as the main logo in the app**: it includes a wall, perspective, lighting, and bolts, so it won't scale cleanly. Create a clean, transparent-background logo asset based on the lettering/layout, plus a simplified compact icon. Prefer SVG vector shapes and appropriately licensed fonts; do not auto-trace the photographic texture. If you cannot produce a faithful vector without a design tool, present a clean CSS/SVG approximation and request approval. Keep the original image unchanged.

## Color tokens
- `--bg`: #0D0D0E (main background)
- `--surface`: #171819 (cards and panels)
- `--surface-raised`: #222426 (raised elements)
- `--border`: #343638 (subtle dividers)
- `--text`: #F5F4F0 (primary text, warm ivory)
- `--text-muted`: #B4B5B5 (secondary text)
- `--metal`: #CFD1D2 (silver detail)
- `--white`: #FFFFFF (strong highlights)
- `--success`: #6FB995 (functional success only)
- `--warning`: #E6B866 (functional warnings only)
- `--danger`: #E07777 (functional errors only)

Keep the UI primarily black/charcoal/white. Reserve semantic colors for meaningful states and workout charts. Maintain WCAG AA contrast and visible keyboard focus states.

## Typography
Use an elegant high-contrast serif for brand wordmarks/headings, and a crisp readable sans-serif for body text, forms, and dense workout data. Match the reference's letter spacing and hierarchy: small 'THE', dominant 'TWO SIX', secondary 'CLUB', small 'ESTABLISHED 2026'. Do not force decorative serif typography into tables or workout logging inputs.

## Assets to create
1. `brand-wordmark.svg`: clean, scalable horizontal/stacked primary wordmark, transparent background.
2. `brand-emblem.svg`: plaque-inspired framed mark with a restrained laurel motif and established date, transparent background.
3. `brand-icon.svg`: compact '26' or 'TSC' symbol for favicon, PWA icon, avatar, and small-screen navigation; test at 32px.
4. Appropriate raster PWA icons (192px, 512px) generated from the approved icon, if the existing project supports PWA.
5. A short brand style guide in the repo describing colors, fonts, usage, spacing, and contrast.

## Screens to refine
- **Welcome/login:** hero branding, elegant logo, clean member actions, no overwhelming background photo.
- **Member dashboard:** branded header, strong hierarchy for next class/workout, subtle borders and monochrome cards.
- **Schedule/RSVP:** clear selected date, class capacity, and Going/Maybe/Not Going status; retain unambiguous semantic colors where necessary.
- **Workout details/logging:** prioritize readable numbers, timers, reps, weights, input fields, and quick interactions.
- **Leaderboards/PRs:** premium restrained ranking style, readable performance tables and charts.
- **Admin:** efficient, dense but legible controls; don't sacrifice usability for decoration.
- **Mobile/PWA:** responsive typography, 44px touch targets, correct safe areas, crisp app icon.

## Workflow — do not skip approval
**Phase A — Audit and proposal:** inspect the code and identify exactly what will change. Show the palette, typography, proposed assets, and mockup/preview of the welcome screen and dashboard. Stop and request approval before broad rollout.
**Phase B — Implementation:** after approval, apply reusable tokens/components and update screens incrementally. Avoid duplicated styles or introducing unnecessary dependencies.
**Phase C — QA:** test existing login/join/approval, member and admin routes, workouts, RSVP, result logging, leaderboards, mobile layouts, and accessibility. Run the project's actual lint/build/test commands and report outcomes accurately.
**Phase D — Deployment:** create a Vercel preview deployment first. Ask for approval before pushing visual changes to production. Provide the preview URL and changed-file summary.

Start now with Phase A. Do not tell me that assets, tests, or deployment are complete until you have actually produced and verified them. If you need access to this ZIP, tell me the simplest way to upload/extract it into the current Claude Code project.
