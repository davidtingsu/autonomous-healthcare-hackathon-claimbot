# Claims Command Center

Interactive claims lifecycle dashboard with LangGraph HITL workflows, Vercel AI SDK receipt validation, Supabase realtime, and three actor panels.

## Stack

- **Next.js** on Vercel
- **Supabase** (Postgres, Realtime, Storage)
- **LangGraph** (claim workflow + HITL interrupts)
- **Vercel AI SDK** (`generateObject` for receipt vision)
- **React Flow** (lifecycle diagram)
- **shadcn/ui** (dark mode Slate + Teal)

## Setup

1. Copy env file:

```bash
cp .env.local.example .env.local
```

2. Apply database migrations (Drizzle):

```bash
# Add DATABASE_URL to .env.local (Supabase → Settings → Database → URI, use Transaction pooler)
npm run db:migrate
```

This drops and recreates all tables with valid demo user UUIDs. **supabase-js** is still used for Realtime in the browser; server routes use **Drizzle ORM**.

Legacy SQL files in `supabase/migrations/` are superseded by `drizzle/0000_reset.sql`.

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo flow

1. **User** actor → select subscriber (+ optional dependent) → create claim with receipt
2. Claim enters **Benefits HITL** → receipt validation (live LLM or faked without API key)
3. **Benefits** → edit fields inline → Save / Request revision / Submit / Cancel
4. **Insurance** → Approve or Deny submitted claims
5. **User** → receives match notification in event feed

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Deploy (Vercel + GitHub)

1. Push to GitHub
2. Import repo in Vercel
3. Set environment variables from `.env.local.example`
4. GitHub Actions CI runs lint, typecheck, test, build on each PR

## Receipt validation

- **Live**: set `OPENAI_API_KEY` or `XAI_API_KEY` with `LLM_PROVIDER=openai|grok`
- **Faked**: no API key → trusts ClaimRequest patient name, amount, date

## Actors

| Role | Panel |
|------|-------|
| User | Create/edit claims, notifications inbox |
| Benefits Company | Review queue with inline field edits |
| Insurance Company | Approve/deny insurance claims |

Pass actor via `X-Actor-Role` header: `user`, `benefits_company`, `insurance_company`.
