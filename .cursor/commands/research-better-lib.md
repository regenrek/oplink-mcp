# Research Template: Find a Modern, Faster Library than a Baseline

Use this template to evaluate alternatives to any baseline library. Replace placeholders like <BASELINE_LIB>, <DOMAIN/USE‑CASE>, <CANDIDATE_LIBS> before posting or running the search.

---

## Problem statement
- Goal: Find a modern, faster JavaScript/TypeScript library for <DOMAIN/USE‑CASE> that outperforms <BASELINE_LIB> in latency and bundle size while maintaining or improving relevance/quality.
- Context: Runs in Node 18+/browser, ESM‑first, TS types, no native deps; list size 5k–50k items (adjust to your scale); return top‑N suggestions per query.

## Success metrics (make these explicit)
- P95 latency/query: target <1 ms at 10k items; <5 ms at 50k items (Node laptop). Adjust as needed.
- Bundle size: <25 KB min+gzip for core (no heavy optional modules).
- Quality: NDCG@5 (or task‑specific metric) ≥ <BASELINE_LIB> on the same corpus (≥1.0x).
- Features: multi‑field weights, typo tolerance, diacritics, highlight ranges, incremental updates.
- DX: ESM, TS types, active maintenance (<6 months since last release), permissive license.

## Scope and exclusions
- In‑scope: in‑memory, client/Node libraries (no servers, no external indexes).
- Out‑of‑scope: hosted/search servers unless used only for comparison; heavy NLP stacks unless used for query expansion (phase 2).

## Concrete research question to post/search
- “Which modern JS/TS libraries outperform <BASELINE_LIB> for <DOMAIN/USE‑CASE> at 10k–50k items, with ESM, TS types, and <25 KB gzip bundle? Compare <CANDIDATE_LIBS> by p95 latency, relevance (NDCG@5 or equivalent), bundle size, multi‑field weighting, and maintenance.”

## Search queries (copy/paste)
- benchmark “<BASELINE_LIB>” vs <CANDIDATE_A> vs <CANDIDATE_B> js performance
- “<CANDIDATE_A> vs <BASELINE_LIB>” latency relevance “typescript” “esm”
- “<CANDIDATE_B>” library benchmark fuzzy search (adjust for your domain)
- <CANDIDATE_C> benchmark bundle size “diacritics” “highlight”
- <CANDIDATE_D> bm25 javascript benchmark “multi field”
- <CANDIDATE_E> js benchmark in‑memory search

## Shortlist to evaluate (example for fuzzy name/description search)
- fuzzysort (very fast, great for names; small footprint)
- quick‑score (modern, relevance‑focused UI search)
- FlexSearch (very fast full‑text; larger surface; async workers)
- MiniSearch (BM25, tiny, strong relevance for short fields)
- Orama/Lyra (modern in‑memory engine; plugin ecosystem)
- fast‑fuzzy / match‑sorter (light choices for simple lists)

Replace with candidates relevant to your <DOMAIN/USE‑CASE>.

## Minimal benchmark design
- Dataset: 25k items with fields relevant to the task (e.g., name, description). Combine synthetic + real.
- Queries: 100 mixed queries (typos, prefixes, mid‑word, camelCase splits, etc.).
- Procedure: warm index; run 1k queries; record mean/p95; compute NDCG@5 (or task metric) vs hand‑labeled relevancy; measure min+gzip bundle.
- Environments: Node 20, Chrome stable. Configs: defaults + one tuned weights (e.g., name:0.7, description:0.3).

## Decision rubric
- Must meet latency + bundle targets and maintain ≥ <BASELINE_LIB> quality metric.
- Prefer simple multi‑field API and highlight support.
- Tie‑breaker: maintenance cadence, type safety, ESM‑first.

## Deliverables
- One‑page results table (latency, quality metric, size, features).
- Example integration snippet for our “did‑you‑mean”/ranking path.
- Recommendation + migration notes (config, weights).

---

## Example (pre‑filled for fuzzy search vs Fuse.js)

Problem statement
- Goal: Find a modern, faster JS/TS library for fuzzy matching tool names + short descriptions (10–500 chars) that beats Fuse.js in latency and bundle size, while keeping good relevance.
- Context: Node 18+/browser, ESM‑first, TS types, no native deps; list size 5k–50k; top‑3 suggestions per query.

Success metrics
- P95 latency/query: <1 ms @10k items; <5 ms @50k items.
- Bundle size: <25 KB min+gzip.
- Relevance: NDCG@5 ≥ Fuse.js.
- Features: multi‑field weights, typo tolerance, diacritics, highlight ranges, incremental updates.
- DX: ESM, TS types, active maintenance (<6 months), permissive license.

Scope and exclusions
- In‑scope: in‑memory libraries; Out‑of‑scope: servers (Meilisearch), heavy NLP stacks (wink‑nlp) unless only for query expansion.

Concrete research question
- “Which modern JS/TS fuzzy search libraries outperform Fuse.js on 10k–50k items for short text (tool names + 1–2 fields), with ESM, TS types, and <25 KB gzip bundle? Please compare fuzzysort, quick‑score, FlexSearch, MiniSearch, Orama by p95 latency, relevance (NDCG@5), bundle size, multi‑field weighting, and maintenance.”

Search queries
- benchmark “fuse.js” vs fuzzysort vs “quick‑score” vs flexsearch vs minisearch vs orama js performance
- “fuzzysort vs fuse.js” latency relevance “typescript” “esm”
- “quick‑score” library benchmark fuzzy search
- flexsearch benchmark bundle size “diacritics” “highlight”
- minisearch bm25 javascript benchmark “multi field”
- orama lyra js benchmark in‑memory search

Shortlist to evaluate
- fuzzysort, quick‑score, FlexSearch, MiniSearch, Orama (Lyra), fast‑fuzzy, match‑sorter

Minimal benchmark design
- Dataset: 25k items (name, description). Queries: 100 mixed. Warm index; run 1k queries; record mean/p95; compute NDCG@5; measure bundle.

Decision rubric
- Must meet latency + bundle targets and maintain ≥ Fuse.js NDCG@5.
- Prefer multi‑field API, highlight.
- Tie‑breaker: maintenance, type safety, ESM‑first.

Deliverables
- Results table; integration snippet; recommendation + migration notes.

