# SatyaNet Client

React (Vite) single-page app for SatyaNet.

## Setup

```bash
cp .env.example .env      # set VITE_API_BASE_URL if your API isn't on localhost:4000
npm install
npm run dev                # http://localhost:5173
```

## Build for production

```bash
npm run build               # outputs to dist/
npm run preview             # serve the production build locally to sanity-check it
```

## Structure

- `src/components/` — one file per screen/widget (Header, Login, Signup, Timeline, etc.)
- `src/services/api.js` — thin fetch wrapper around the server's REST API, handles the JWT token
- `src/App.jsx` — routing + auth context (`useAuth()` hook used across components)
