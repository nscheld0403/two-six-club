# The Two Six Club — iPhone Home Screen / PWA branding

This supplements CLAUDE_CODE_PROMPT.md. The existing live site is used in Safari via Share > Add to Home Screen. Do not change app functionality or break deployment.

## Visual identity
- Full horizontal wall plaque reference in assets/two-six-club-emblem-reference.png is the brand reference, NOT a suitable square icon as-is.
- Create a dedicated square icon with an oversized white/ivory **26** in elegant serif typography, a subtle white laurel underneath, matte black background, and generous safe margins. No lighthouse, anchor, rope, mountains, photo, glow, or tiny illegible text.
- Optionally make 2 alternates: simplified THE TWO SIX CLUB stacked, and 26 CLUB. Default recommendation: big 26 + laurel.
- Use vector source (SVG) and export raster 180x180 apple-touch-icon.png, 192x192 icon-192.png, 512x512 icon-512.png. Provide appropriate maskable variant with additional safe zone. Avoid transparent background for Apple icon. Inspect at actual home-screen size.
- Use brand-consistent logo on sign-in splash/welcome screen, but do not use wall photo as the home-screen icon.

## Implementation
1. Inspect actual framework and existing PWA metadata before changes; do not assume a particular file structure.
2. Set app title and Apple web app title to `The Two Six Club` (short_name may be `Two Six Club`); set theme/background color #101112 and display `standalone` in a valid web app manifest.
3. Configure icon paths and `apple-touch-icon` in HTML/Next.js metadata as appropriate; check iOS Safari Add to Home Screen behavior. Add `apple-mobile-web-app-capable` / status bar style only where appropriate and supported.
4. Ensure icon URLs are public, load without authentication, are cache-busted if replacing existing assets, and have correct MIME types. Verify manifest, touch icon, and display behavior on production deployment.
5. Test Safari > Share > Add to Home Screen, launching from icon, navigation, login persistence, viewport/safe-area, and no duplicate browser-like header. Explain that previously saved icons may need to be removed and added again to refresh.
6. Keep GitHub private; do not commit secrets or modify Supabase policies as part of branding.
7. Show 3 icon previews and a welcome screen before rolling out full design. Confirm existing member/admin workflows after deploy.

## Acceptance criteria
- Distinct, legible monochrome icon at small size; no unreadable plaque text.
- iOS home-screen icon displays correctly and opens deployed app in standalone mode where supported.
- Existing sign-in, approvals, workouts, RSVPs, results, and admin controls still work.
