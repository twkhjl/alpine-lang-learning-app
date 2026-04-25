# Supabase Data Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move public lexicon data from static JSON into Supabase and load it through Supabase API in the Alpine app.

**Architecture:** Supabase stores normalized tables and exposes JSON-compatible read views. The frontend uses Supabase JS as the only runtime data source.

**Tech Stack:** Supabase Postgres, SQL migrations, Node.js test runner, Alpine.js, Supabase JS CDN.

---

### Task 1: Conversion Tests

**Files:**
- Create: `local-tests/supabase-data.test.js`
- Modify: `package.json`

- [ ] Write Node tests that verify Supabase API rows normalize into the app data shape.
- [ ] Run `npm test` and verify the test fails because the normalizer does not exist.
- [ ] Implement the Supabase data helper with exported pure functions.
- [ ] Run `npm test` and verify the test passes.

### Task 2: Supabase Migration

**Files:**
- Create: `supabase/migrations/<timestamp>_create_lexicon_schema.sql`
- Create: `supabase/seed.sql`

- [ ] Add normalized tables with primary keys, foreign keys, indexes, and RLS enabled.
- [ ] Add anonymous read policies for public lexicon tables.
- [ ] Add views that return the current frontend payload shape.
- [ ] Keep `supabase/seed.sql` as the checked-in seed source for remote setup.

### Task 3: Frontend Supabase Loader

**Files:**
- Modify: `index.html`
- Modify: `public/assets/js/main.js`
- Add: `public/assets/js/supabase-config.js`

- [ ] Add Supabase JS CDN and public config script.
- [ ] Remove existing JSON loading.
- [ ] Add `loadSupabaseData()` that queries the four API views.
- [ ] Update `init()` to require Supabase and show the load error state if Supabase fails.

### Task 4: Verification And Push

**Files:**
- Modify as needed from previous tasks.

- [ ] Run `npm test`.
- [ ] Run existing local browser tests.
- [ ] Run `supabase db push`.
- [ ] Confirm remote data is readable from Supabase views.
