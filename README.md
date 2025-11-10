# LABAN — Disaster Response & Rescue Coordination Platform

LABAN connects civilians and rescuers during emergencies for faster, safer disaster response. It provides quick alerting, a live map of requests, and simple tools to triage and coordinate help.

## Features
- Civilian and Rescuer roles with a guided onboarding flow.
- Need Help form with quick messages, optional photo upload, and vehicle accessibility tags.
- Rescue Requests list with distance indicators and photo badges.
- Interactive map with markers, selection, and a photo overlay on selected requests.
- Water Level widget summarizing nearby flooded segments from crowdsourced reports.
- Responsive design with a sticky left panel on desktop and improved keyboard focus states.

## Requirements
- Node.js `>=18` and npm.
- A Supabase project with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Setup
- Clone the repo and install dependencies:
  - `npm install`
- Create an environment file at the project root:
  - `./.env.local`
  - Add the following variables:
    - `VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"`
    - `VITE_SUPABASE_ANON_KEY="YOUR_ANON_KEY"`
- Start the dev server:
  - `npm run dev`
  - Open `http://localhost:5173/`

Note: Vite reads env vars at startup; if you change `.env.local`, restart the dev server.

## Supabase Configuration
- This app uses the Supabase JS client to read/write help requests and road reports.
- Ensure your tables contain the basic fields used by the UI, for example:
  - `help_requests`: `id`, `user_name` or `user` object, `message`, `latitude`, `longitude`, `image_url`, `access_vehicles` (text array), `created_at`.
  - `road_reports`: `latitude`, `longitude`, `severity`, `created_at`.
- If you maintain SQL schema files, place them in a separate repo or remove `supabase/` from `.gitignore` to version them here.

## Scripts
- `npm run dev` — start Vite dev server.
- `npm run build` — production build.
- `npm run preview` — preview the production build.
- `npm run lint` — run ESLint.

## Environment & Secrets
- Do not commit secrets. The repo ignores:
  - `.env.local`
  - `.supabase/*` (Supabase CLI local artifacts)
  - `supabase/` (ignored by default — remove from `.gitignore` if you want to version SQL).

## Troubleshooting
- Map or list is empty:
  - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set and correct.
  - Restart `npm run dev` after changing `.env.local`.
- Supabase client is `null`:
  - Ensure both env vars are present; the client initializes only when both are set.
- Geolocation or consent issues:
  - Allow location in your browser and try again.

## Development Notes
- The desktop layout uses a sticky left panel with its own scroll to keep the list visible while exploring the map.
- Mobile disables sticky for a natural flow.
- Buttons and interactive elements have improved `:focus-visible` styles for accessibility.

## Credits
- Developed by: SG

## License
- Internal project. Do not distribute without permission.
