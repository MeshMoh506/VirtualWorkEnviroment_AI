# The Manager's task bank

## Why

The Manager used to improvise a project, and each week's tasks, from the graduate's CV
alone. Real-model runs showed the output was sensible ("SecureBook: Full-Stack Booking
Platform"), but there was no shared idea of what a good project for each track looks
like, no story running across the weeks, and nothing to point at when someone asks
"why this task?". The task bank is that shared idea: **12 project seeds, two per track,
each with a four-week arc.** It is *guidance the Manager adapts*, not a script.

## What is in it

| Track | Seed id | Project | Weeks (focus in short) |
|---|---|---|---|
| software_engineering | `se-booking-platform` | Team Booking Platform | Foundations > Core logic > Users and quality > Ship it |
| software_engineering | `se-support-desk` | Support Ticket Desk | Foundations > Workflow > Usability > Ship it |
| data_science_ai | `ds-churn-insights` | Customer Churn Insight Pipeline | Understand the data > Baseline model > Improve and scrutinise > Communicate |
| data_science_ai | `ds-document-qa` | Company Documents Q&A (RAG) | Ingestion > Retrieval and answers > Evaluation > Ship it |
| cybersecurity | `sec-webapp-review` | Vulnerable Web App Security Review | Scope and set up > Find weaknesses > Fix and verify > Report |
| cybersecurity | `sec-api-hardening` | Harden a REST API | Baseline > Identity and input > Operations > Prove it |
| networks_infrastructure | `net-branch-office` | Branch Office Network Design | Requirements and design > Build the core > Secure it > Operate it |
| networks_infrastructure | `net-services-lab` | Internal Services Lab | Build the lab > Core services > Access and safety > Watch it |
| information_systems | `is-leave-workflow` | Employee Leave and Approval Workflow | Requirements > Design > Build > Prove and roll out |
| information_systems | `is-inventory-dashboard` | Inventory and Reporting Dashboard | Understand the business > Model and load > Report > Hand over |
| cloud_devops | `cloud-cicd-service` | CI/CD for a Web Service | Containerise > Automate > Deploy > Operate |
| cloud_devops | `cloud-three-tier-iac` | Three-Tier Infrastructure as Code | Design > Network and compute > Data and security > Cost and resilience |

Each seed has a title, a short brief, the skills it exercises and a four-week **arc**:
for each week a *focus* and a *deliverable* - the concrete thing that should exist by
the end of the week. Graduates on the legacy `junior_dev` track get the
software-engineering seeds.

The whole bank is one file, `backend/app/agents/task_bank.py`. It is a **first draft
written for the team to edit** - see "Decisions for the team" below.

## How the Manager uses it

1. **`create_project`** is shown the seeds for the graduate's *track only*, and told to
   base the project on the one that best fits their CV and interests, **adapt** it (a
   specific name, scope and difficulty tuned to their level), and record which it used
   in `seed_id`. The tool's `seed_id` is restricted to that track's ids.
2. The choice is stored as `Project.seed_id` (migration `0003`, nullable). A made-up id
   is never stored: the Manager's answer is checked against the track's seeds, and an
   unknown one becomes `NULL` (the project still works, just without an arc).
3. **`plan_week`** is told where this week sits in the arc - its focus and the
   deliverable that should exist by Thursday - so week 2 builds on week 1. Past the last
   arc week it is told to extend the project (harden, add a feature, polish, present)
   rather than repeat it.
4. **Every** weekly plan (with or without a seed) also gets the subtask-shaping
   principles: about one working day each, independently reviewable, ending in something
   concrete a mentor can check, ordered so each builds on the last, each with a "done
   when". This is what makes the Mentor's job well-defined.
5. A graduate's **own project** (Stage 2) has no seed and is planned as before, plus the
   principles.

`GET /projects/me` now returns `seed_id`, so "which seed was this?" is one API call.

## Rules the tests enforce

Anyone adding or editing a seed gets these checked automatically
(`smoke_test_task_bank.py`): every track has at least two seeds; ids and titles are
unique slugs; every seed has exactly a four-week arc; every brief, focus and deliverable
is a real sentence of sensible length; every seed lists at least three skills; no
placeholder text; the first week of an arc is about foundations and the last about
finishing. **To add a seed:** append a `Seed(...)` to `SEEDS` and run the suite.

## Decisions for the team

These are my drafts; please read them as a reviewer.

1. **Are these the right projects?** In particular: are two seeds per track enough for
   the demo, and do the security and networking ones match what you can show?
2. **Four-week arcs.** The bootcamp demo will probably only reach week 1 or 2, so the
   later weeks matter less on stage, but the arc is what makes week 2 feel like a
   continuation. Change the length freely (the test asks for four; update it if you
   change your mind).
3. **Level.** Seeds are written for a recent graduate. Calibrating difficulty to a weaker
   or stronger CV is left to the Manager's judgement ("tune to their level"); there is no
   explicit beginner/advanced split.
4. **Stage 3.** A company's own tasks (its knowledge base) would plug into the same two
   hooks: seeds become "the company's projects", the arc becomes "the company's plan".

## What was verified

`smoke_test_task_bank.py` (53 checks): the integrity rules above; the prompt helpers; and,
through the real endpoints with only the model faked, exactly what the Manager is shown
(its track's seeds and nobody else's, the right arc step for weeks 1, 2 and past the end,
the principles), that the chosen seed is stored and returned, that a made-up seed is not,
that a graduate's own project is untouched, and that the shared tool definition is never
mutated. Mutation-checked: dropping the arc from the prompt, storing an unchecked seed,
truncating an arc, or ignoring the track each fail a check.

## Not covered

- **Not tested with real models.** The wiring is verified; whether a real Manager
  actually *adapts* a seed (rather than copying it) is not. Run
  `python e2e_real_llm.py --save-report run1.json` and read the project and subtasks it
  produced (the script prints them, and `seed:` shows which seed it chose).
- **Seeds are in English.** With `X-Venv-Language: ar` the Manager writes the project and
  tasks in Arabic (see `docs/AGENT_LANGUAGE.md`), adapting the seed.
- **No per-seed resources yet** (starter repos, datasets, reference links). A seed says
  what to build, not what to start from.
