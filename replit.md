# Film Production Studio Assistant

Filmhouse turns screenplay scene text into a production-ready prop pull list with inventory status and daily rental cost.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/film-studio-assistant run dev` — run the studio dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 with a Python Google ADK extraction worker
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/film-studio-assistant/src/pages/studio-home.tsx` — scene intake, analysis report, filters, and CSV export
- `artifacts/api-server/src/routes/production.ts` — scene parsing and inventory matching API
- `lib/api-spec/openapi.yaml` — source of truth for the scene analysis contract

## Architecture decisions

- The dashboard calls the shared API through generated React Query hooks rather than embedding parsing logic in the browser.
- Inventory matching is isolated behind the production route so a live ClickHouse adapter can replace the starter inventory without changing the UI contract.
- The initial experience ships with a small representative inventory set so coordinators can try the full flow before connecting a warehouse.
- Gemini analysis uses the official Python `google-genai` SDK with `gemini-2.5-flash` as the requested primary model and a provider-compatible fallback when Google retires that model for a new account.
- The formal ADK agent is defined in the root `main.py`; the API worker delegates screenplay extraction to it and keeps inventory matching and cost calculation in the existing route.

## Product

- Paste screenplay text and load an example scene.
- Extract props and identify location/title context.
- Show daily rental cost, requested quantity, on-hand stock, condition, category, matched term, and status.
- Filter the pull list by availability and export it as CSV.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
