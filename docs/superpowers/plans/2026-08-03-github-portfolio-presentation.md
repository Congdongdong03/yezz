# GitHub Portfolio Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `Congdongdong03` into a concise English-only full-stack portfolio centred on YezYY, with YezYY as the sole public pinned project.

**Architecture:** Treat the YezYY repository README, profile repository README, and GitHub account/repository metadata as three independent public surfaces that share one factual case-study narrative. Make text and screenshot changes through version-controlled repositories, then apply visibility and metadata changes through the authenticated GitHub UI and verify the final public presentation.

**Tech Stack:** Markdown, Git, GitHub profile repositories, GitHub repository metadata, Chrome browser control

## Global Constraints

- Public copy is English-only.
- YezYY is the only featured and pinned project.
- Do not claim public shopping or online payment is active.
- Do not invent user counts, revenue, performance metrics, testimonials, employment, or ownership claims.
- Do not expose credentials, customer data, recovery codes, environment values, or internal admin screenshots.
- Keep practice repositories private; do not delete them.
- Keep the repository name `yezz`; use `YezYY` as the product name in public copy.
- Changing `Congdongdong03.github.io` to private is explicitly approved even if its GitHub Pages site becomes unavailable.

---

### Task 1: Create an isolated YezYY documentation branch

**Files:**
- Modify later: `README.md`
- Create later: `docs/images/yezyy-production-homepage.png`

**Interfaces:**
- Consumes: clean `main` branch at the approved design and plan commits
- Produces: isolated `codex/github-portfolio-presentation` branch and worktree

- [ ] **Step 1: Confirm repository state**

Run:

```bash
git status --short
git branch --show-current
git rev-parse --git-dir
git rev-parse --git-common-dir
```

Expected: a clean `main` checkout with no unrelated user changes.

- [ ] **Step 2: Create the isolated worktree**

Run the `superpowers:using-git-worktrees` workflow and create:

```text
.worktrees/github-portfolio-presentation
```

on branch:

```text
codex/github-portfolio-presentation
```

- [ ] **Step 3: Confirm baseline identity**

Run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

Expected: clean worktree on `codex/github-portfolio-presentation`.

### Task 2: Rewrite the YezYY repository as a production case study

**Files:**
- Modify: `README.md`
- Create: `docs/images/yezyy-production-homepage.png`

**Interfaces:**
- Consumes: live public site at `https://yezyy.com/en`
- Produces: a current screenshot and factual case-study README

- [ ] **Step 1: Capture a clean production screenshot**

Open `https://yezyy.com/en` in the authenticated browser session, wait for the public homepage to settle, and save a page-only screenshot to:

```text
docs/images/yezyy-production-homepage.png
```

The screenshot must not show browser chrome, account details, admin data, or customer information.

- [ ] **Step 2: Inspect the screenshot**

Verify that it shows the production homepage clearly, contains no private data, and is readable near the top of a GitHub README. Replace it if the image is blank, clipped at an unusable point, or contains overlays.

- [ ] **Step 3: Replace the README opening and feature narrative**

Write an English README with these exact top-level sections:

```markdown
# YezYY

**A production bilingual booking and operations platform for an operating DIY studio in Glen Waverley, Melbourne.**

[Live Website](https://yezyy.com) · [API Health](https://yezz-api.fly.dev/health)

![YezYY production homepage](docs/images/yezyy-production-homepage.png)

## The Product
## Customer Booking Experience
## Staff Operations
## Business Rules in Code
## Architecture
## Technology
## Engineering Decisions
## Repository Layout
## Run Locally
## Quality and Release Gates
## Deployment
```

The product sections must describe bilingual ordinary DIY and party requests, capacity-aware Melbourne availability, human confirmation, in-store payment, customer rescheduling/cancellation, and the protected Chinese staff workflow. State that public product shopping is intentionally disabled at the current business stage.

- [ ] **Step 4: Preserve useful technical documentation**

Carry forward verified stack, architecture, repository layout, setup, release-gate, and deployment information from the existing README. Remove the existing claims that customers currently use a public cart, commerce, or online order-submission flow.

- [ ] **Step 5: Validate public wording**

Run:

```bash
rg -n 'cart|commerce|online payment|online order|YEZZ|Yezz' README.md
rg -n '^#|yezyy.com|yezz-api.fly.dev|Australia/Melbourne|in-store payment|human confirmation|intentionally disabled' README.md
git diff --check
```

Expected: any remaining `cart`, `commerce`, `online payment`, or `online order` text appears only in an explicit statement that the public feature is disabled; the product name is consistently `YezYY`; required links and current business rules are present; no whitespace errors.

- [ ] **Step 6: Commit the YezYY case study**

Run:

```bash
git add README.md docs/images/yezyy-production-homepage.png
git commit -m "docs: present YezYY as production case study"
```

### Task 3: Replace the GitHub profile README

**Files:**
- Clone: `Congdongdong03/Congdongdong03`
- Modify: `README.md` in the profile repository clone

**Interfaces:**
- Consumes: the approved YezYY case-study facts and public links
- Produces: a concise public profile README with YezYY as the sole featured project

- [ ] **Step 1: Clone the profile repository safely**

Clone `https://github.com/Congdongdong03/Congdongdong03.git` into a dedicated local directory outside the YezYY repository. Confirm the checkout is clean and on `main` before editing.

- [ ] **Step 2: Replace the profile README**

Use this exact structure and factual content:

```markdown
# Hi, I'm Wesley

**Full Stack Developer based in Melbourne, Australia.**

I build production web applications across product UI, backend APIs, relational databases, automated testing, and cloud deployment. My current focus is turning real business workflows into clear, maintainable software.

## Featured Project

### [YezYY](https://github.com/Congdongdong03/yezz) — DIY Studio Booking & Operations Platform

YezYY is a production bilingual platform for an operating DIY studio in Glen Waverley, Melbourne.

- Built responsive English and Chinese customer experiences with Next.js, React, TypeScript, Tailwind CSS, and next-intl
- Implemented ordinary DIY and party request flows with human confirmation and in-store payment
- Modelled capacity-aware availability, bookings, schedules, catalogue content, and staff workflows in PostgreSQL
- Developed a Fastify REST API with validation, authentication, rate limiting, uploads, and server-authoritative business rules
- Added Vitest and Playwright coverage, database-backed release gates, and production health checks
- Deployed the web application to Vercel and the API to Fly.io with Neon PostgreSQL and Cloudflare R2

[Live Website](https://yezyy.com) · [Source Code](https://github.com/Congdongdong03/yezz)

## Core Stack

| Area | Technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, next-intl |
| Backend | Node.js, Fastify, REST APIs, JWT, Zod |
| Data | PostgreSQL, Drizzle ORM, Redis |
| Testing | Vitest, Playwright, ESLint, TypeScript |
| Delivery | Docker, Vercel, Fly.io, Neon, Cloudflare R2 |

## Current Focus

Continuing to evolve YezYY as a production application while pursuing full-stack engineering opportunities in Melbourne.
```

- [ ] **Step 3: Validate the profile copy**

Run:

```bash
rg -n '[\p{Han}]|cart|commerce|online payment|online order|Birthday Sky' README.md
rg -n 'YezYY|Melbourne|Full Stack|yezyy.com|Congdongdong03/yezz' README.md
git diff --check
```

Expected: no Chinese text, closed-commerce claims, or Birthday Sky reference; required YezYY and Melbourne positioning is present; no whitespace errors.

- [ ] **Step 4: Commit and push the profile README**

Run:

```bash
git add README.md
git commit -m "docs: focus profile on YezYY case study"
git push origin main
```

Expected: the public profile repository advances to the new commit.

### Task 4: Apply GitHub profile, repository, and visibility settings

**Files:**
- No local files

**Interfaces:**
- Consumes: authenticated GitHub browser session and explicit user approval
- Produces: final account profile, YezYY metadata/topics, sole pin, and private Birthday Sky repository

- [ ] **Step 1: Update the account profile**

Set:

```text
Name: Wesley Cong
Bio: Full Stack Developer building production web applications with TypeScript, Next.js, Fastify, and PostgreSQL.
Location: Melbourne, Australia
Website: https://yezyy.com
```

Leave public email unchanged and do not add one.

- [ ] **Step 2: Update YezYY repository metadata**

Set:

```text
Description: Production bilingual booking and operations platform for a Melbourne DIY studio — Next.js, Fastify, and PostgreSQL.
Homepage: https://yezyy.com
Topics: typescript, nextjs, fastify, postgresql, drizzle-orm, monorepo, booking-system, bilingual, docker, vercel, flyio
```

- [ ] **Step 3: Make Birthday Sky private**

Change `Congdongdong03/Congdongdong03.github.io` from public to private. Confirm the repository name in GitHub's visibility dialog before submitting.

- [ ] **Step 4: Keep only YezYY pinned**

Open profile pin customization, ensure only `Congdongdong03/yezz` is selected, and save.

### Task 5: Integrate and verify the public portfolio

**Files:**
- Merge YezYY documentation branch into `main`

**Interfaces:**
- Consumes: completed local commits and GitHub UI settings
- Produces: verified public GitHub presentation

- [ ] **Step 1: Review the YezYY documentation diff**

Run:

```bash
git diff main...codex/github-portfolio-presentation -- README.md docs/images/yezyy-production-homepage.png
git diff --check main...codex/github-portfolio-presentation
```

Confirm that only the approved README and screenshot plus the approved specification/plan commits are included.

- [ ] **Step 2: Merge and push YezYY**

Fast-forward `main` to the feature branch after final checks, then run:

```bash
git push origin main
```

- [ ] **Step 3: Verify public links**

Confirm HTTP success for:

```text
https://github.com/Congdongdong03
https://github.com/Congdongdong03/yezz
https://yezyy.com
https://yezz-api.fly.dev/health
```

- [ ] **Step 4: Verify recruiter-visible state**

Check the public profile and repository pages for:

- English-only public copy.
- `Wesley Cong`, Melbourne location, full-stack bio, and YezYY website.
- YezYY as the only pinned project.
- Birthday Sky absent from public repositories.
- Current YezYY screenshot rendered correctly.
- Repository description, homepage, and topics exactly matching the approved design.
- No active-shopping or online-payment claim.

- [ ] **Step 5: Clean temporary workspaces**

After successful verification, remove the merged YezYY worktree and the temporary profile-repository clone. Do not delete any user-owned repository or unrelated local folder.
