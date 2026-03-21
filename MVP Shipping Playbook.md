# 🚀 MVP Shipping Playbook — Vibe Coding DO's & DON'Ts

> **Core Principle:** The best builders know what NOT to build. Every hour saved on boilerplate is an hour spent on what actually matters.

---

## 🗂️ Metadata
- **Source:** "Why Vibe Coders Fail" — 50+ MVPs shipped across US, India, Dubai, Australia
- **Status:** #active-reference
- **Tags:** #mvp #shipping #vibe-coding #tools #decisions
- **Agent Context:** Use this note to evaluate tech decisions at project start. When a task involves picking a tool or building a feature, cross-check against the DO/DON'T tables below before proceeding.

---

## ✅ DO's — Tooling Decisions (Reference Before Starting Any Project)

| Area | Use This | Why |
|---|---|---|
| **Auth** | Clerk / Supabase Auth | Handles sessions, OAuth, security edge cases in hours not weeks |
| **UI Components** | shadcn/ui + Tailwind | Figma → working UI in 2–3 hrs. Consistent sizing, no raw CSS |
| **State Management** | Zustand (client) + Server Components (server) | No Redux needed until you have real scale |
| **API Layer** | tRPC + Server Actions | End-to-end type safety, zero boilerplate, no custom REST |
| **Deployment** | Vercel | Push to main = live. No SSH, no server config |
| **Database** | Prisma + Managed Postgres (Supabase/Neon/Railway) | Typed ORM, easy migrations, no server management |
| **Form Validation** | Zod + React Hook Form | Predictable forms, safe DB inputs |
| **Payments** | Stripe | 45 min integration. PCI compliance handled. Never DIY |
| **Error Tracking** | Sentry | Set up day one. Know what breaks before users do |
| **Analytics** | PostHog / Plausible | Set up pre-launch so data exists when you need it |
| **Secrets** | .env + Doppler / Vercel Env Manager | Never commit keys to version control. Ever. |
| **File Uploads** | UploadThing / Cloudinary | Storage, CDN, validation — solved in an afternoon |
| **Preview Deploys** | Vercel PR Previews | Every PR gets a test URL. No broken UI in production |
| **UI Primitives** | Radix UI | Unstyled, accessible, production-grade components |
| **Search** | Algolia / Typesense / Meilisearch | Full-text search is deceptively hard. Use the experts |
| **Realtime** | Supabase Realtime / Pusher / Partykit | Websockets + presence = full-time project. Don't DIY |
| **Performance Audit** | Lighthouse (Chrome DevTools) | Free, 30 seconds. Score < 70 = fix before launch |

---

## 🚫 DON'Ts — Time Killers to Avoid

| Trap | Why It Kills You | Alternative |
|---|---|---|
| Building auth from scratch | #1 time killer. Security edge cases, maintenance overhead | Clerk / Supabase Auth |
| Writing raw CSS | Slow, inconsistent, unnecessary in 2025+ | Tailwind |
| Over-engineering state | Architecture for 10M users before you have 10 | Zustand + Server Components |
| Custom REST APIs early | Weeks of work before any validation | tRPC + Server Actions |
| Manual deployments | Human error, time sink, one mistake = broken prod | Vercel / Railway / Render |
| Raw SQL everywhere | Hard to maintain, refactor, and secure | Prisma ORM |
| DIY payment system | PCI compliance = months of work + legal liability | Stripe |
| Rolling own search | Ranking, typo tolerance, perf — not trivial | Algolia / Typesense |
| Skipping monitoring | You find out it's broken when users leave | Sentry / LogRocket / Axiom |
| Hardcoding API keys | Exposed in version control = infrastructure loss | .env files always |
| DIY file uploads | Breaks in prod in unpredictable ways | UploadThing / Cloudinary |
| Pushing straight to main | One bad push = broken prod for real users | Feature branches + previews |
| DIY realtime | Websockets + conflict resolution = full-time project | Supabase Realtime / Pusher |
| Ignoring performance | Slow app = dying app. Users have no patience | Lighthouse pre-launch |
| No onboarding/empty states | Confused users don't convert — they leave | Add empty states + tooltips |
| Skipping README | You won't remember. Future you will be lost | Write it day one, 20 mins |
| Messy folder structure | 30% time lost navigating vs building | components / hooks / utils / types |
| Chasing perfect before shipping | Biggest time killer of all | Ship imperfect. Iterate. |
| Never refactoring | Tech debt compounds into a codebase you can't move in | Clean up every 2–3 features |
| Not documenting decisions | Why did you pick this? You won't remember | Write it in README or `/docs` |

---

## 🧠 Decision Framework — Use Before Writing Any Code

> Run through this checklist before starting any new feature or project component.

- [ ] **Does this already exist as a battle-tested tool?** → Use it. Don't build it.
- [ ] **Is this reversible later?** → If yes, start simple. Migrate when you have data.
- [ ] **Will a user ever see or care about this?** → If no (e.g. auth internals), use an abstraction.
- [ ] **Am I building for 10M users before I have 10?** → Stop. Simplify.
- [ ] **Is this blocking the core feature that makes the product worth using?** → Unblock it first.
- [ ] **Have I set up monitoring before I ship?** → Sentry must be live at launch.
- [ ] **Do users know what to do when they land?** → Empty states + onboarding must exist.
- [ ] **Are secrets in .env and out of version control?** → Check before first push.
- [ ] **Is there a README with setup steps and key decisions?** → Write before you forget.

---

## 📦 Recommended Stack (Opinionated Fast-Ship Default)

```
Frontend:     Next.js + Tailwind + shadcn/ui + Radix UI
Auth:         Clerk or Supabase Auth
State:        Zustand + React Server Components
API:          tRPC + Server Actions
DB:           Prisma + Supabase (Postgres)
Payments:     Stripe
Files:        UploadThing
Monitoring:   Sentry
Analytics:    PostHog
Deployment:   Vercel (with PR previews)
Secrets:      Vercel Env Manager / Doppler
Forms:        React Hook Form + Zod
```

---

## 🔁 Workflow Rules

1. **New project** → Bootstrap with the stack above before writing any feature code
2. **New feature** → Run through the decision framework checklist first
3. **Every 2–3 features** → Refactor session. Pay down debt before it compounds.
4. **Pre-launch** → Lighthouse audit. Score < 70 = fix it. Monitoring live? Analytics live?
5. **Any tech decision** → Ask "does someone already build this better?" If yes, use theirs.

---

## 💬 Agent Instructions

> If you are an AI agent consuming this note:
> - When asked to scaffold a project, use the **Recommended Stack** above as default
> - When asked to implement auth, forms, payments, file uploads, or search — use the listed tools, do not write custom implementations
> - When reviewing a codebase, flag any violations of the DON'Ts table as technical debt
> - When estimating effort, factor in whether existing tools are being used — DIY adds 3–10x time
> - Prioritize shipping a working version over a perfect one. Iterate after real user feedback.
