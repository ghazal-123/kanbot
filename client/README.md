# Kanbot client

## Run locally

```bash
npm install
npm run dev
```

The client uses `http://localhost:4000/api` by default. Set `VITE_API_URL` to
override it. The API server must be running for registration and login.

## Design and implementation

- React 19, Vite, React Router, Axios, Zod, MUI and Tailwind CSS.
- MUI supplies accessible form controls and theme tokens; Tailwind utilities
  and CSS provide the responsive layout and class-based dark mode.
- Indigo (`#4f46e5`) is the primary action color, with green (`#22c55e`) for
  success. The page backgrounds follow the design spec's slate and navy
  palettes; the official light/dark Kanbot logos are used on onboarding.
- Login and registration validate with Zod before sending requests. The JWT is
  persisted in local storage, checked with `/auth/me` on startup, and cleared
  when a protected API request returns 401.
- The theme follows the system preference initially and can be toggled for the
  current app session.

## Features

- Authentication context and API calls, startup session verification,
  login/register validation and server errors, protected routes,
  redirect-aware sign-in and session-expiry handling.
- Project listing and CRUD, duplicate-key conflict feedback and confirmed
  deletion.
- Project backlog with debounced search, priority/type filters, quick todo
  creation, todo editing, sprint planning and drag-and-drop ordering.
- Four-status active sprint board with optimistic todo moves, rollback on API
  failures, sprint completion and carry-over selection.
- Sprint history and details, generated Markdown summaries, AI status/chat,
  todo generation and sprint planning.
- Responsive light/dark styling, a MUI theme bridge to Tailwind, and the
  official Kanbot onboarding logos.
- Inter is the single UI typeface, loaded from Google Fonts and shared by the
  Tailwind `font-sans` token, global CSS, and MUI typography scale.

The app follows the API contract in `../server/src/types/api.ts`; the backend
must be running for authenticated pages and API-backed workflows. Page routes
are loaded on demand to keep the initial bundle smaller.
