# Package 8.19 — Web UX / Accessibility / Runtime-State Audit

Baseline: Package 8.18.

## Scope
- Preserve the complete 8.18 repository; no deletion or replacement of previous files.
- Add route-level loading/error/not-found states.
- Add skip navigation, keyboard focus visibility and reduced-motion support.
- Add persisted light/dark/system theme handling.
- Extend user preferences with language, timezone and default-company placeholders without bypassing backend authorization.
- Add minimum-length + debounced global search execution.
- Add notification category filtering.
- Keep Backend as the final authorization and data-scope authority.

## Source alignment
The master documents require Home Personalization, Executive/Relationship/Project views, Notification Center categories, User Preferences (language, timezone, theme, dashboard layout, notification preferences, default company/calendar), Web Performance (lazy loading, caching, CDN/bundle analysis), Search performance (debounce, pagination, ranking, permission-aware filtering, fuzzy matching), and RTL/LTR, Persian/English, Light/Dark/System UI support.

## Verification
- `scripts/audit-web-8-19.sh` performs static invariants and accidental-secret checks.
- Runtime Next.js build is not declared PASS unless dependencies are installed and the build is executed.
