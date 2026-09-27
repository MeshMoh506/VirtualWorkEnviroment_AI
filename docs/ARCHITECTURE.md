# Venv — Architecture & Technology Deep Dive

A complete technical explanation of what Venv is, how it's built, why
each piece of technology was chosen, and how the code is organized —
written to be readable by someone with general software background who
has never seen this codebase before. For a running log of what got
built when, see `docs/PROJECT_STATUS.md`; this document is the
structural, "how does it all fit together and why" companion to that
changelog.

## Table of contents

1. [What Venv is](#1-what-venv-is)
2. [System architecture, at a glance](#2-system-architecture-at-a-glance)
3. [The technology stack, in depth](#3-the-technology-stack-in-depth)
4. [Code organization](#4-code-organization)
5. [The data model](#5-the-data-model)
6. [Distinctive techniques and design decisions](#6-distinctive-techniques-and-design-decisions)
7. [A request's journey, worked end to end](#7-a-requests-journey-worked-end-to-end)
8. [Where to learn more](#8-where-to-learn-more)

---

## 1. What Venv is

Venv is a **simulated company** for recent graduates who need real work
experience before anyone will give them a job that requires real work
experience. A graduate uploads a CV, gets placed on a track, and joins
a small AI-staffed "team": a **Manager** who assigns real weekly tasks,
a **Mentor** who reviews submitted work the way a senior engineer
would, and **HR** who tracks growth over time — plus up to seven
optional specialists (Security Reviewer, Data Reviewer, DevOps, QA
Engineer, UX Reviewer, Career Coach, Technical Writer) the graduate can
add to their roster. Ten agents in total, each backed by a real LLM
call doing real work, not a scripted chatbot.

The platform has a second side too: **companies**. A company can
register, define a real role, upload real knowledge-base material,
create a real project of their own, and invite a specific graduate to
work on it — with the graduate's explicit, informed consent about
exactly what the company will (and won't) be able to see. The company
gets a live roster and real, ongoing reports on how their invited
graduates are doing, built entirely from the same reviews the weekly
cycle already produces — not a second reporting system.

Everything a graduate does is **real**, not simulated in the sense of
being fake: real submitted code (a real GitHub repository link,
genuinely fetched and read), a real structured review with real
per-category scores, a real growing "Employee File" shared across every
agent, and — as of this pass — automated tests proving each of those
claims against actual assertions, not just "the endpoint returned 200."
Only the *company* is invented.

## 2. System architecture, at a glance

```
┌─────────────────────┐         ┌──────────────────────────┐
│   Next.js frontend   │  HTTP   │      FastAPI backend      │
│  (React 19, TS,      │ ──────▶ │  (Python, SQLAlchemy,     │
│   Tailwind CSS v4)   │ ◀────── │   Alembic, LangGraph)     │
└─────────────────────┘  JSON   └────────────┬─────────────┘
                                              │
                       ┌──────────────────────┼──────────────────────┐
                       │                      │                      │
              ┌────────▼────────┐   ┌─────────▼─────────┐   ┌────────▼────────┐
              │   PostgreSQL     │   │   LLM providers     │   │  External APIs  │
              │  (or SQLite for  │   │  Anthropic / OpenAI  │   │  GitHub REST    │
              │   local dev)     │   │  / DeepSeek / Qwen   │   │  SMTP (email)   │
              └──────────────────┘   │  + OpenAI embeddings │   └─────────────────┘
                                     └──────────────────────┘
```

Two independent codebases, one JSON API between them:

- **`backend/`** — a FastAPI application. Owns every bit of state (the
  database), every agent's logic, every LLM call, authentication, and
  the entire REST API. Nothing about "what the Manager should do next"
  lives in the frontend at all — the frontend only ever displays what
  the backend tells it and sends back what the graduate typed or
  clicked.
- **`frontend/`** — a Next.js single-page application (using the App
  Router, not the older Pages Router). Talks to the backend exclusively
  over `fetch` calls to JSON endpoints; holds no business logic of its
  own beyond presentation, routing, and light client-side state
  (what's currently selected on screen, form inputs before submission).

This is a deliberate, conventional split: the backend is the single
source of truth and could serve a different frontend (a mobile app, a
CLI) with zero changes; the frontend could be rebuilt in a different
framework without touching a line of Python.

## 3. The technology stack, in depth

### 3.1 Backend

**FastAPI** — the web framework the entire backend is built on
(`app/main.py`, `app/routers/*.py`). FastAPI is a Python framework for
building HTTP APIs, built on top of two lower-level pieces: Starlette
(the actual ASGI web server plumbing — routing, requests, responses)
and Pydantic (data validation — see below). What FastAPI adds on top:
you write a plain Python function, type-annotate its parameters, and
FastAPI automatically (a) validates the incoming request against those
types, (b) generates interactive API documentation for free (visit
`/docs` on a running server), and (c) turns your return value into
correctly-shaped JSON. **Why FastAPI specifically** (over, say, Flask
or Django): this project is almost entirely a JSON API with no server-
rendered HTML pages of its own, and it's written by a team that also
uses Python for the AI/agent logic — FastAPI's async support and tight
Pydantic integration make it the natural fit for a Python-only API
backend with real, sometimes-slow LLM calls in the request path.

**SQLAlchemy** (`app/models.py`) — the Object-Relational Mapper (ORM):
instead of writing raw SQL strings everywhere, database tables are
defined as Python classes (`class Task(Base): ...`), and rows become
Python objects you can read and write with normal attribute access
(`task.status = TaskStatus.REVIEWED`). This project uses SQLAlchemy
2.0's newer, more explicit `Mapped[...]` typed-column style throughout.
**Why an ORM at all**: with 20 real tables and a genuinely complex web
of relationships (a User has a Project, which has Weeks, which have
Tasks, which have Reviews and Messages and Attachments — and a company
Invitation can affiliate a User with an Organization that owns Job
Titles that own Knowledge Chunks...), writing and maintaining that much
raw SQL by hand would be far more error-prone than letting the ORM
generate it from typed Python relationships.

**Alembic** (`backend/alembic/`) — SQLAlchemy's own migration tool.
Every change to `models.py` (a new column, a new table, a new enum
value) gets a matching migration script in `alembic/versions/`, each
one a small Python file with an `upgrade()` and a `downgrade()`. The
app runs these automatically on startup (`app/migrations.py`, called
from `main.py`'s startup event) rather than using SQLAlchemy's blunt
`create_all()`, which can create tables but can never safely *alter* an
existing one — meaning a schema change made without a migration would
never actually reach a database that already has data in it. This
project is now on **migration 0010**, and the whole migration story
(including two genuinely tricky Postgres-enum bugs that only real
Postgres — not SQLite — ever surfaced) is written up in
`docs/MIGRATIONS.md`, `docs/STAGE3_COMPANY_RAG.md`, and
`docs/TEN_AGENTS.md`.

**PostgreSQL** (production) **/ SQLite** (local dev) — the actual
database engine. The same SQLAlchemy code runs against either
(`app/database.py` picks the engine based on `DATABASE_URL`), which
makes iterating locally fast (SQLite needs zero setup — it's a single
file) while still deploying against the real, more strictly-typed
Postgres the app actually runs on in production. This dual-database
approach is also *why* several of the trickiest bugs this project has
hit were enum-related: SQLite doesn't enforce column types or CHECK
constraints the way Postgres does, so a mistake that's completely
invisible in local SQLite testing can be a hard failure the moment it
touches real Postgres — a lesson learned the hard way and now
explicitly guarded against (see §6.9).

**Pydantic** (`app/schemas.py`) — the data-validation library FastAPI
is built on. Every request body and every response shape is a Pydantic
`BaseModel` subclass — a plain Python class with typed fields. Pydantic
does two jobs here: it validates that incoming JSON actually matches
the expected shape (wrong type, missing required field → a clean 422
error, automatically, with no code written for it), and it serializes
outgoing Python/SQLAlchemy objects into correctly-shaped JSON. This is
also where the project's snake_case API convention comes from —
Pydantic doesn't rename fields by default, so every endpoint returns
plain `snake_case` JSON (`company_project_title`, not
`companyProjectTitle`); the frontend's TypeScript layer converts to
camelCase for its own domain objects, but the wire format itself stays
snake_case throughout.

**python-jose + passlib/bcrypt** (`app/auth.py`) — JWT (JSON Web Token)
based authentication. On login, the server issues a signed token
containing the user's ID; the frontend sends it back as a `Bearer`
header on every subsequent request; the server verifies the signature
and looks up the user, with no server-side session storage needed.
Passwords are hashed with bcrypt (via passlib) before ever touching the
database — the raw password is never stored anywhere.

### 3.2 The AI / agent layer

This is the most distinctive part of the codebase, and where the
project's two more unusual technology choices live: **LangGraph** and
**multi-provider LLM failover**.

**Anthropic Claude, OpenAI, DeepSeek, and Qwen** — the actual language
models doing the "thinking." Rather than depending on one provider,
`app/agents/llm_client.py` builds a *priority chain* of every provider
that has an API key configured (`settings.llm_provider_priority` in
`.env`) and tries each in turn: if the first provider is down, out of
credit, or rate-limited, the call automatically **fails over** to the
next one, logging which provider actually answered. OpenAI, DeepSeek,
and Qwen all speak the same "OpenAI Chat Completions" API dialect
(including tool/function calling), so one `openai.OpenAI` client,
pointed at each provider's own `base_url`, covers all three; Anthropic
keeps its own SDK because its tool-use and image-content-block shapes
genuinely differ from OpenAI's. **Why bother with four providers
instead of just picking one**: reliability (a single provider's outage
or rate limit doesn't take the whole platform down) and cost/latency
tuning (a **tier system** — `tier="small"` vs `tier="main"` — routes
cheap, low-stakes calls like the roundtable's specialist commentary to
faster/cheaper models, and reserves the more expensive tier for the
calls that matter most, like a formal Mentor review).

**LangGraph** (`app/agents/graph/`) — this is the one technology in
the stack that most warrants a "what even is this" explanation, since
it's unusual outside AI-specific engineering.

*What it is*: LangGraph is a library (from the LangChain ecosystem) for
building **stateful, multi-step AI workflows as an explicit graph** —
you define a set of named "nodes" (each a function that reads and
updates some shared state) and the edges connecting them, compile the
graph, and then `.invoke()` it. It's conceptually a state machine
purpose-built for LLM-driven processes, with two built-in capabilities
a hand-rolled sequence of function calls doesn't get for free:
**checkpointing** (the graph's state can be persisted between calls,
keyed by a `thread_id`) and **`interrupt()`** (a node can pause the
graph mid-execution and hand control back to the caller, to be resumed
later with `Command(resume=payload)`).

*Why it's used here, specifically*: two places in this codebase
genuinely need exactly those two capabilities, not just "an LLM
pipeline":

1. **The onboarding wizard**
   (`app/agents/graph/onboarding_graph.py`) — CV uploaded → agent-
   generated follow-up questions → answered → a track suggested and
   approved → an agent roster suggested and approved → complete. Three
   separate points in that flow use `interrupt()`: the graph pauses
   after generating questions, again after suggesting a track, and
   again after suggesting a roster — each time handing a decision back
   to the graduate, who might not respond for minutes, hours, or (if
   they close the tab) days. Resuming means invoking the same graph
   again with `Command(resume=...)` against the same `thread_id` (the
   graduate's own user ID) — the state genuinely persists in between,
   which is exactly what makes onboarding **resumable**: a graduate can
   close the tab mid-wizard and pick up exactly where they left off
   (`docs/ONBOARDING_RESUME.md`), something that would otherwise need a
   hand-built state machine and a lot more custom persistence code.
2. **The end-of-week cascade**
   (`app/agents/graph/weekly_cycle_graph.py`) — once all five of a
   week's subtasks are approved, four things need to happen *in a
   specific order*, each depending on the previous: the Manager
   consults the Mentor about how the week went → the Manager writes the
   progress review using that answer → HR separately consults the
   Mentor about consistency → HR writes the behavioral review using
   *that* answer. LangGraph's `StateGraph` expresses this as four nodes
   with explicit edges between them, which is easier to read and modify
   than a long, nested sequence of plain function calls — and, since
   this graph has no interrupts (it never needs to pause for a human),
   it runs start-to-finish in one `.invoke()` with no checkpointer
   needed at all, unlike the onboarding graph.

For everything that *doesn't* need multi-step state or a pause-and-
resume point — a single formal review, a single chat reply, a single
structured rollup — the code deliberately does **not** reach for
LangGraph. Those calls go straight through `llm_client.py`'s
`call_with_tool` / `call_agentic` functions instead (see
`app/agents/manager.py`, `mentor.py`, `hr.py`, `career_coach.py`,
`roundtable.py`, `task_chat.py`, `meeting.py`) — plain Python functions
making one LLM call and returning a result. LangGraph earns its
complexity exactly twice in this codebase, and only where genuinely
needed.

**LangChain** (`langchain-core`, `langchain-anthropic`,
`langchain-openai`) — the library LangGraph is built on top of, mostly
invisible here except as the thing that provides `BaseChatModel` (a
unified interface for calling different providers' chat models the
same way) and the message types (`HumanMessage`, `SystemMessage`) the
two LangGraph flows use internally.

**Forced tool calls, not free-text parsing** — nearly every agent
action in this codebase (a Mentor review, a plan for the week, a
career-checkin) asks the model to call one specific, named "tool" (a
JSON schema, essentially a strict contract for the shape of the
response) rather than asking it to write prose and then trying to
parse that prose back into structured data. `app/agents/tools.py`
holds these schemas; `force_tool="submit_review"` in a `call_with_tool`
call means the model literally cannot respond with anything except a
call to that tool, in that shape. `app/agents/tool_output.py` adds a
second layer on top: if a model *does* return something that doesn't
quite validate (a required field missing, a wrong type), the code
first tries a cheap in-process **repair**, then **retries** the same
provider, and only then **fails over** to the next provider in the
chain — see `docs/TEN_AGENTS.md` and `docs/AGENT_READ_WRITE.md` for
concrete examples of this working in practice.

**`app/rag.py`** — retrieval-augmented generation for a company's
knowledge-base uploads, used when a company answers "does our RAG
knowledge base actually know about X." Deliberately **not** built on a
vector database: each uploaded document is chunked (~1,200 characters,
150-character overlap, paragraph/sentence-aware), each chunk gets a
real embedding from OpenAI's `text-embedding-3-small` model, and the
embedding is stored as a plain JSON array of floats
(`KnowledgeChunk.embedding_json`) rather than in pgvector or an
external vector-DB service. At query time, cosine similarity between
the query's embedding and every stored chunk's embedding is computed
directly in Python, and the top-K matches are returned. This is a
genuinely scoped, deliberate simplification, not a naive oversight —
at this stage's realistic scale (a handful of job titles, a handful of
documents each), a real vector index would add real infrastructure for
no real benefit yet; swapping `retrieve()`'s internals for a proper
vector index later is a contained change, not a rewrite, and
`docs/STAGE3_COMPANY_RAG.md` spells out exactly what that swap would
involve when the scale justifies it.

**`app/agents/github_client.py`** — a minimal GitHub REST API client
that lets the Mentor actually *read* a graduate's submitted repository
(description, first 25 file paths, first 2,000 characters of the
README) before reviewing it — not the code itself, only what's visible
without cloning. Works without any token for public repos (GitHub's
anonymous rate limit is 60 requests/hour/IP), with an optional
`GITHUB_TOKEN` bumping that to 5,000/hour for anyone doing real,
repeated testing.

**`app/email.py`** — real invitation emails over plain `smtplib`
(Python's standard library), not a third-party email-sending service.
Works with any SMTP provider (Gmail, SendGrid, Mailgun, AWS SES, a real
mail server) by pointing `SMTP_HOST`/`SMTP_PORT`/credentials at it in
`.env`; if nothing is configured, sending is a documented no-op rather
than an error — the invitation itself always still exists regardless of
whether an email actually goes out (`docs/PROJECT_STATUS.md`'s API
surface section, and this session's own SMTP verification against a
real local mail server via `aiosmtpd`).

### 3.3 Frontend

**Next.js 16, with the App Router** — the React framework the whole
frontend is built on (`frontend/src/app/`, one folder per route). Next
handles routing (a folder named `company/students/[invitationId]`
becomes the URL `/company/students/:id` automatically), and this
project uses it purely as a client-rendered single-page app talking to
the FastAPI backend — no server components fetching data server-side,
no API routes living inside Next itself. **Why Next.js over plain
React + a router**: conventions (file-based routing, a standard project
shape) and a genuinely fast dev server (Turbopack), for a team that
didn't need Next's server-rendering features but did want its
structure and tooling.

**React 19** — the underlying UI library: components, hooks
(`useState`, `useEffect`, custom hooks like `useLocale`/`useAgents` in
`lib/i18n/locale.tsx`), and the whole component tree that actually
renders the interface.

**TypeScript** — every file in `frontend/src` is `.ts`/`.tsx`, not
plain JavaScript. Every API response shape is typed (`lib/api.ts`'s
`Api*Out` interfaces mirror the backend's Pydantic schemas by hand),
which is what caught a real bug this session: `lib/reviews.ts`'s
`Review.agentType` was typed as only ever being one of the three
default agents — a type that was quietly wrong the moment Career Coach
started writing reviews too, caught by the type system rather than
silently misbehaving at runtime.

**Tailwind CSS v4** — utility-class styling (`className="flex gap-4
rounded border border-border"` rather than separate `.css` files per
component). Version 4 specifically is configured almost entirely
through CSS custom properties in `app/globals.css` rather than a
separate `tailwind.config.js` — every color, font, and spacing token
the whole app uses lives there, in one place, for both light and dark
mode.

**Framer Motion** — animation (`motion.div`, `AnimatePresence`) for the
handful of places that genuinely benefit from it: the landing page's
scroll-triggered reveals, the detail panel's slide-in drawer. Used
sparingly and deliberately, per `frontend/DESIGN.md`'s explicit stance
against decoration for its own sake.

**React Flow (`reactflow`)** — the interactive node-and-edge graph on
the board page showing a graduate's agent team as a connected diagram
(`components/board/nodes.tsx`), a genuinely good fit for "a small set
of connected entities the user can drag around and inspect," which is
exactly what a team-of-agents visualization is.

**Recharts** — the score-trend chart on the Growth page
(`app/growth/page.tsx`) — a standard React charting library for the one
place in the app that needed an actual line chart.

**Bilingual i18n (English/Arabic) with RTL** — not a third-party i18n
library; a hand-rolled system (`lib/i18n/en.ts`, `lib/i18n/ar.ts`,
`lib/i18n/locale.tsx`) because the app's needs were narrow and specific
enough that a general-purpose library would have added more complexity
than it removed. Every user-facing string goes through a `t("some.key")`
lookup; switching to Arabic doesn't just swap strings but flips the
whole layout direction, which is why the app uses **logical CSS
properties** throughout (`ms-`/`me-`/`start-`/`end-` instead of
`ml-`/`mr-`/`left-`/`right-`) — a property like `margin-inline-start`
means "the start of the reading direction," which is the *left* in
English and the *right* in Arabic, automatically, with zero JavaScript
needed to flip it. `docs/DESIGN_HANDOFF.md` documents this pattern (and
one real exception to it — a `framer-motion` `x` transform is a
*physical* translateX regardless of `dir`, so that one case needs an
explicit sign flip).

### 3.4 Testing

No third-party test framework (no `pytest`, no `jest`) — every one of
the 39 backend test files (`backend/smoke_test_*.py`) is a plain Python
script using FastAPI's own `TestClient`, a hand-written `check(label,
condition)` assertion helper, and `unittest.mock.patch` to replace real
LLM calls with realistic, narratively-consistent mocked responses. This
is a deliberate choice, not a gap: it keeps every test runnable with a
single `python smoke_test_whatever.py`, with zero test-framework
configuration, and every test file doubles as a fully readable script
showing exactly what it does, top to bottom, without needing to
understand fixture/decorator magic. See §6.10 for the testing
philosophy this project actually holds itself to.

---

## 4. Code organization

```
VirtualWorkEnviroment_AI/
├── README.md, LICENSE, docker-compose.yml
├── docs/                       Every feature's own write-up — see §8
│
├── backend/
│   ├── requirements.txt        Every Python dependency, pinned, with inline
│   │                           comments explaining anything non-obvious
│   ├── .env.example            Every configurable setting, documented
│   ├── e2e_real_llm.py         A real-key (not mocked) end-to-end check —
│   │                           `--save-report out.json` to capture a run
│   ├── alembic/versions/       0001 (baseline) through 0010 (ten agents) —
│   │                           one migration file per schema change
│   ├── smoke_test_*.py         39 files — see docs/PROJECT_STATUS.md's
│   │                           full list, one line each, with check counts
│   │
│   └── app/
│       ├── main.py             FastAPI app setup: middleware, routers,
│       │                       startup (migrations + catalog seeding)
│       ├── config.py           Settings — reads backend/.env
│       ├── database.py         SQLAlchemy engine/session (Postgres or SQLite)
│       ├── models.py           Every table and enum — the whole schema,
│       │                       in one file, ~750 lines, heavily commented
│       ├── schemas.py          Every Pydantic request/response shape
│       ├── auth.py             Password hashing, JWT issue/verify
│       ├── language.py         X-Venv-Language middleware — every agent
│       │                       call answers in the graduate's language
│       ├── migrations.py       Runs Alembic automatically on startup
│       ├── email.py            Real SMTP invitation emails
│       ├── rag.py              Chunking + embeddings + cosine retrieval
│       ├── materials.py        Shared "extract text from an upload" used
│       │                       by own-project and company material uploads
│       ├── company_roster.py   Shared roster-building logic — used
│       │                       identically by a company's own view AND a
│       │                       student's transparency view (see §6.6)
│       ├── scheduling.py       Saudi Sun–Thu workweek date math
│       ├── dashboard.py        The board page's stats endpoint
│       ├── storage.py          Local-disk file storage for attachments
│       │
│       ├── routers/            One file per resource — the actual HTTP
│       │   ├── auth.py           endpoints. Each stays thin: validate,
│       │   ├── users.py          call into app/agents/ or a model query,
│       │   ├── tasks.py          return. No business logic lives here.
│       │   ├── projects.py
│       │   ├── onboarding.py
│       │   ├── agents.py         Every agent-triggered endpoint
│       │   ├── meeting.py
│       │   ├── company.py        The whole company side of the platform
│       │   └── invitations.py    A student's side of the invite flow
│       │
│       └── agents/             The AI layer — see §3.2 for the deep dive
│           ├── llm_client.py     Multi-provider failover, the low-level
│           │                     call_with_tool / call_agentic functions
│           ├── orchestrator.py   Thin wrappers every router calls through
│           │                     instead of importing an agent module
│           │                     directly — one seam between HTTP and AI
│           ├── tools.py          Every forced-tool-call JSON schema
│           ├── tool_output.py    Repair / retry / fail-over on bad output
│           ├── manager.py        Plans weeks, assigns tasks, writes the
│           │                     end-of-week progress review
│           ├── mentor.py         Reviews submitted work (incl. real
│           │                     GitHub fetch + real image vision)
│           ├── hr.py             Skills rollup, behavioral review
│           ├── career_coach.py   The career check-in (§6.5)
│           ├── meeting.py        1:1 Meeting Room + the Team Room
│           ├── task_chat.py      In-task-thread replies from any eligible
│           │                     agent on the roster
│           ├── roundtable.py     The post-submission specialist discussion
│           ├── co_reviewers.py   An earlier, simpler implementation of the
│           │                     same idea — superseded by roundtable.py,
│           │                     kept only for its own isolated tests
│           ├── weekly_cycle.py   get_next_task — the state machine that
│           │                     decides what a graduate sees next
│           ├── github_client.py  Real GitHub REST calls for the Mentor
│           ├── guardrails.py     Keeps every agent conversation on-topic
│           ├── rubric.py         Mentor's structured scoring rubric
│           ├── task_bank.py      The seed library of realistic tasks
│           │
│           └── graph/          Everything actually built on LangGraph
│               ├── state.py            The TypedDict state each graph shares
│               ├── models.py           small_model_chain — which model
│               │                       answers each tier, in priority order
│               ├── onboarding_graph.py The 3-interrupt onboarding wizard
│               ├── onboarding_resume.py Resuming a closed-tab onboarding
│               ├── weekly_cycle_graph.py The end-of-week cascade graph
│               ├── collaboration.py    ask_mentor — one agent consulting
│               │                       another mid-cascade
│               ├── cv_parsing.py       Extracts CV text AND validates it's
│               │                       genuinely a CV (§6.8)
│               └── catalog.py          The 7 optional agents' seed data
│
└── frontend/
    ├── package.json, next.config.ts, tsconfig.json
    ├── DESIGN.md                The design system's own rulebook
    │
    └── src/
        ├── app/                 One folder per route (Next's App Router) —
        │                        20 pages total, see docs/DESIGN_HANDOFF.md
        │                        for the full page-by-page map
        │
        ├── components/
        │   ├── board/             The agent-graph visualization (React Flow)
        │   ├── dashboard/         Board-page widgets (focus hero, week strip)
        │   ├── workspace/         Task detail, submission form, agent chat
        │   └── nav/               Shared header controls (AccountMenu,
        │                          IconLink) — used identically everywhere
        │                          a header needs them, one definition each
        │
        └── lib/
            ├── api.ts             Every raw API call + every ApiXOut type
            │                      (mirrors the backend's schemas.py exactly)
            ├── auth-context.tsx   Login state, the ApiError type
            ├── tasks.ts, projects.ts, reviews.ts, team.ts, company.ts,
            │   invitations.ts, employee-file.ts, dashboard.ts, meeting.ts
            │                      One file per domain — converts each raw
            │                      Api*Out shape into a clean camelCase
            │                      domain type the components actually use
            ├── agents.ts          The 3 default agents' identity (colors,
            │                      order) — optional agents come from the
            │                      backend catalog instead, not hardcoded
            └── i18n/
                ├── en.ts, ar.ts   Every translated string, one key each
                └── locale.tsx     useLocale/useAgents/useTrackLabels hooks
```

## 5. The data model

Eighteen tables (`app/models.py`), grouped by what they're for:

**Identity & organizations** — `User` (a student or a company rep,
distinguished by `account_type`), `Organization` (a company), `Employee
File` (the one shared record Manager/Mentor/HR all read from and write
to — see §6.1).

**The weekly cycle** — `Project` → `Week` → `Task` (a subtask) →
`TaskMessage` (the thread on one task) / `TaskAttachment`
(submitted files/images) / `Review` (a structured judgment — five
different *kinds* share this one table: a per-task Mentor review, a
Manager's weekly progress review, HR's behavioral review, HR's periodic
skills rollup, and the Career Coach's check-in — see §6.4).

**The optional-agent roster** — `AgentCatalog` (the 7 selectable
specialists' seed data) and `UserAgent` (which ones a given graduate
actually added).

**Direct chat** — `ChatMessage` (a 1:1 Meeting Room conversation with
one agent) and `TeamMessage` (the shared Team Room, everyone at once).

**The company side** — `JobTitle`, `KnowledgeMaterial` /
`KnowledgeChunk` (the RAG knowledge base), `CompanyProject` (a
company's own real project template — distinct from a graduate's own
project), `Invitation` (the whole invite → consent → accept flow).

Twelve enums define every fixed vocabulary in the system: which of the
six IT tracks a graduate is on (`TrackEnum`), which of the ten agents
(`AgentType`), where a graduate is in onboarding
(`OnboardingStage`), a task's status, who sent a message
(`SenderType`), a project's status and its source, a week's status,
which of the five review kinds, an account's type, a company rep's
role, and an invitation's status.

## 6. Distinctive techniques and design decisions

A tour of the choices in this codebase that are genuinely worth
understanding on their own, not just implied by "we used FastAPI."

### 6.1 One shared Employee File, not separate agent memories

Every agent reads from and writes to the *same* `EmployeeFile` row for
a given graduate (`skills_json`, `strengths_json`, `growth_areas_json`,
`summary_text`). The Manager's next task, HR's rollup, and the Career
Coach's check-in all read the same record — nothing is siloed per
agent. This is a deliberate architectural stance, not an accident of
how the schema happened to end up: it's what makes the "one team, not
three separate assistants" feeling real rather than just a UI framing.

### 6.2 A catalog-driven agent roster, not hardcoded logic

The seven optional agents (`AgentCatalog`, seeded from
`app/agents/graph/catalog.py`) are database rows, not an `if/elif`
chain somewhere. Adding an eighth optional agent — as this project's
own history shows, going from 4 to 7 optional agents across two
separate passes — means adding rows and a persona string, not touching
onboarding logic, the roster-selection UI, or any routing code. The
whole point of this design was that growth would be additive.

### 6.3 Multi-provider LLM failover with tier-aware routing

Covered in depth in §3.2 — worth restating here as a *design decision*
rather than just a technology: reliability and cost are treated as
first-class product concerns, not an afterthought. A demo or a real
user's session doesn't go down because one provider hiccups, and a
cheap, high-volume call (a roundtable specialist's aside) doesn't cost
the same as a formal review that genuinely needs the strongest
available model.

### 6.4 One `Review` table, five kinds

Rather than five separate tables for "a task review," "a week
progress review," "a behavioral review," "a skills rollup," and "a
career check-in," all five share one `reviews` table with a `kind`
column. This keeps every "show me everything written about this
graduate" query — the Growth page, a company's roster report, a
student's own transparency view — a single, simple query instead of a
five-way UNION.

### 6.5 Career Coach's dedicated action, not just a chatbot

Every agent that isn't purely conversational writes something durable:
Mentor's review, HR's rollup, Manager's weekly progress. Career Coach
used to be the one exception — chat-only, nothing it ever *produced*.
`app/agents/career_coach.py`'s `run_checkin` closes that gap: it reads
the graduate's real Employee File and CV and writes real, usable resume
bullets and a concrete focus area, saved as a `Review` the same way
every other agent's durable output is — see `docs/TEN_AGENTS.md`.

### 6.6 One function builds both the company's view and the student's own transparency view

`app/company_roster.py`'s `student_detail()` function is called by
*both* a company's own roster endpoint (`GET /company/students/{id}`)
and a student's own transparency endpoint (`GET
/invitations/{id}/visibility`) — the literal same function, not two
independently-maintained implementations of "what does a company see."
This means a student checking "what do they actually see about me" is
architecturally guaranteed to get the true answer, not a
best-effort approximation that could quietly drift out of sync. This
session's own test suite proves it directly: after a full month of
real simulated work, a student's own view and the company's view of
that same student are asserted **byte-for-byte identical**
(`smoke_test_full_lifecycle.py`, `smoke_test_student_visibility.py`).

### 6.7 Real GitHub reads and real image vision, not text descriptions

A Mentor review isn't judged on a graduate's own description of what
they built — `app/agents/github_client.py` genuinely fetches the
submitted repository's description, file tree, and README, and a
submitted image attachment is sent to the model as a real
`{"type": "image", ...}` content block with actual image bytes, not a
filename mentioned in a text prompt. Both of these were directly
verified this session (`smoke_test_agent_read_write.py`) by asserting
on exactly what was sent to the model, not just that a review came
back.

### 6.8 A second validation pass on CVs — not just "did text come out"

A real reported bug: uploading any file with extractable text as a
"CV" — an invoice, an essay — used to be silently accepted, because the
only check was "did some text come out of the file." Fixed with a
genuinely separate concern: `validate_is_cv()`
(`app/agents/graph/cv_parsing.py`) judges, via a real forced tool call,
whether the extracted text actually *reads* like a CV — deliberately
kept out of the shared `read_cv_upload()` function, since that function
is also reused (despite its name) by company knowledge-base uploads and
own-project materials, which genuinely need to accept any document.
Full story in `docs/CV_VALIDATION.md`.

### 6.9 Migrations as a real discipline, with the scars to prove it

Ten migrations in, this project has hit and fixed two genuinely subtle
classes of Postgres-specific bugs that SQLite's laxer type/constraint
enforcement let slip through completely unnoticed until real Postgres
was actually tested against: `ADD COLUMN` doesn't auto-create a
referenced Postgres enum type the way `CREATE TABLE` does, and
generic SQLAlchemy `Enum` doesn't reliably honor `create_type=False`
inside `op.create_table` — both fixed by switching to
`sqlalchemy.dialects.postgresql.ENUM` specifically. A second, subtler
lesson from adding a longer enum member later: SQLite sizes its
`VARCHAR` representation of an enum column to the longest member name
*at that column's original creation time*, so a new, longer member can
silently leave the column too narrow — caught by an automated
model-drift guard (`smoke_test_migrations.py`), not by a human noticing.
Full account in `docs/MIGRATIONS.md`, `docs/STAGE3_COMPANY_RAG.md`, and
`docs/TEN_AGENTS.md`.

### 6.10 A testing philosophy: real context in, real content out — not just status codes

The project's later test files are deliberately held to a standard
beyond "did this endpoint return 200": does the mocked LLM call
*genuinely receive* the real context it's supposed to (asserted by
inspecting exactly what was sent, not just that a request succeeded),
and does what gets written back *genuinely round-trip* correctly
through a later read? Concrete examples: HR's attendance/lateness
figures checked against a hand-computed exact answer from deliberately
constructed timestamps, not just "some numbers came back"
(`smoke_test_agent_read_write.py`); the agent roundtable's "a real
conversation, not parallel monologues" claim verified by confirming a
later specialist's prompt genuinely contains an earlier specialist's
actual words; and the full-lifecycle test's byte-for-byte transparency
check described in §6.6. See `docs/AGENT_READ_WRITE.md` and
`docs/FULL_LIFECYCLE.md`.

## 7. A request's journey, worked end to end

To make the architecture concrete: here is exactly what happens when a
graduate clicks "submit" on a task with a GitHub link.

1. **Frontend** (`components/workspace/task-workspace.tsx`) sends
   `POST /tasks/{id}/submit` with the link as form data, via
   `lib/tasks.ts`'s wrapper around `lib/api.ts`'s raw `fetch` call.
2. **FastAPI** (`app/routers/tasks.py`) validates the request against
   its Pydantic schema, looks up the task via SQLAlchemy, confirms it
   belongs to the authenticated user (from the JWT the frontend sent as
   a `Bearer` header), and updates its status to `submitted`.
3. The frontend's **task workspace** then calls `POST
   /agents/mentor/review/{id}` (`app/routers/agents.py`).
4. That router calls into `app/agents/mentor.py`'s `review_task`,
   which:
   - Fetches the real GitHub repo (`github_client.py`) — description,
     file tree, README.
   - Builds a prompt including the task, the submission notes, any
     prior feedback (if this is a resubmission), and real image content
     blocks for any attached screenshots.
   - Calls `llm_client.py`'s `call_with_tool`, forcing a
     `submit_review` tool call — which tries providers in priority
     order until one succeeds, and repairs/retries once before failing
     over if the response doesn't quite validate.
5. The structured result becomes a `Review` row (`kind=task_review`),
   and the task's status flips to `reviewed` (if approved) or back to
   `in_progress` (if it needs changes).
6. **A background task** (FastAPI's `BackgroundTasks`) then kicks off
   `app/agents/roundtable.py`'s `run_roundtable` — every technical
   specialist the graduate has added discusses the submission with each
   other in sequence (each seeing what the last one said), and the
   Manager synthesizes what matters most, all posted as real
   `TaskMessage` rows in the task's thread.
7. The frontend polls (or the graduate refreshes) and sees the review,
   the score breakdown, and — if any specialists are on the roster —
   the roundtable discussion, all through the same `GET /tasks/{id}`
   endpoint that returns the task with its full thread.

Every step above is exercised by real, passing automated tests —
`smoke_test_agents.py`, `smoke_test_mentor_rubric.py`,
`smoke_test_background_roundtable.py`, and
`smoke_test_agent_read_write.py` between them.

## 8. Where to learn more

This document explains structure and technology choices; `docs/`
explains the *history* of how each feature actually got built, in the
order it happened, with the reasoning and the bugs found along the way
preserved rather than edited out:

- **`docs/PROJECT_STATUS.md`** — the living summary. Start here for
  "what's actually built right now" and a full doc index.
- **`docs/STAGE1_PRODUCT_FLOW.md`**, **`STAGE2_*.md`** (eight files) —
  the original weekly-cycle spec and every Stage 2 feature (onboarding,
  the roundtable, own-project uploads, the Team Room, and more).
- **`docs/STAGE3_COMPANY_RAG.md`** — the entire company side of the
  platform: accounts, RAG, company projects, invitations, the roster.
- **`docs/TEN_AGENTS.md`**, **`AGENT_READ_WRITE.md`** — the current
  ten-agent roster and the deep read/write audit proving it's real.
- **`docs/CV_VALIDATION.md`**, **`FULL_LIFECYCLE.md`** — the most
  recent two passes: a real bug fixed, and the full end-to-end story.
- **`docs/MIGRATIONS.md`**, **`LLM_PROVIDER_FAILOVER.md`** — the two
  most technically dense infrastructure write-ups, for anyone touching
  the schema or the LLM layer directly.
- **`docs/DESIGN_HANDOFF.md`**, **`frontend/DESIGN.md`** — the design
  system, for anyone working on the UI.
- **`README.md`**, **`backend/README.md`**, **`frontend/README.md`**,
  **`backend/app/agents/README.md`** — practical "how to actually run
  this" instructions, separate from this document's "how it's built
  and why."
