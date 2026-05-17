# PokePrice Product Requirements Document (PRD)

**Product:** PokePrice  
**Repository:** `itsanderz/pokeprice`  
**Document version:** 1.0  
**Prepared from:** repository inspection at commit `48865fd9ddc728f04cfcecd302c6ac4c4897ec4f` and in-repo research (`findings.md`)  
**Date:** 2026-05-16

---

## 1. Executive Summary

PokePrice is a Pokémon TCG pricing and portfolio product aimed at serious collectors who do not trust existing “collection value” apps. The current repository already demonstrates a compelling product direction: multi-source card pricing, confidence scoring, watchlists, collection tracking, sealed inventory, card stories, grading submission tracking, and cross-region price context.

The core opportunity is **trust**.

Most competitors optimize for convenience or social engagement. PokePrice should optimize for **pricing fidelity, transparency, and serious collector workflows**:
- what a card is supposedly worth,
- what it can actually be sold for,
- what the user paid,
- what condition it is in,
- where it is stored,
- whether it is sealed or graded,
- and how value changes across markets.

The product should become the collector’s **source-of-truth operating system**, not just another scanner app.

---

## 2. Verified Current-State Facts

The following are verified from the current codebase, not assumptions:

### 2.1 Stack
- Frontend: **Next.js 16.2.6**, React 19, TypeScript, Tailwind 4.
- API surface: two app-router endpoints:
  - `GET /api/cards?q=...&limit=...`
  - `GET /api/cards/[id]`
- Search/ranking: **Fuse.js**-based fuzzy ranking.
- External data source currently wired: **pokemontcg.io**.
- Persistence is currently **browser localStorage only** for watchlist, collection, sealed vault, stories, grading submissions, recent items, and currency.

### 2.2 Verified Working Product Areas
- Search experience with fuzzy matching and result ranking.
- Card detail page with:
  - TCGPlayer pricing,
  - Cardmarket pricing,
  - estimated eBay sold average,
  - estimated COLLECTR CAD price,
  - consensus price,
  - realizable price,
  - confidence state,
  - cross-region estimate panel.
- Watchlist.
- Collection tracking with quantity, cost basis, and condition.
- CSV export for collection.
- Sealed Vault.
- Card Stories / provenance concept.
- Grading submission tracker.
- USD/CAD toggle.

### 2.3 Verified Non-Production Limitations
- eBay sold pricing is **estimated**, not sourced from a live eBay API.
- COLLECTR pricing is **estimated** from USD pricing, not sourced from a real COLLECTR API.
- Cross-region pricing is **heuristic/estimated**, not live market data.
- Rate limiting is **in-memory**, not durable/shared across instances.
- Caching helper is effectively a documented no-op, not real caching.
- No auth, no cloud sync, no database, no multi-device account system.
- No scanner implementation yet; scanner is UI copy only.

### 2.4 Build Verification
- After installing dependencies with `npm ci`, the app **builds successfully** with `npm run build`.
- Verified routes at build time:
  - `/`
  - `/api/cards`
  - `/api/cards/[id]`

---

## 3. Problem Statement

Collectors have three overlapping problems that existing products solve poorly:

1. **They do not trust displayed values.**  
   Most tools show optimistic market numbers rather than probable liquidation value.

2. **Their workflows are fragmented.**  
   Pricing, collection management, sealed tracking, grading, stories, and cross-market comparison all live in separate tools.

3. **Their collection is richer than a card list.**  
   Serious collectors care about condition, cost basis, provenance, sealed product, grading lifecycle, region differences, and emotional meaning.

PokePrice should solve this by becoming the most transparent and operationally useful collector product in the category.

---

## 4. Product Vision

**PokePrice helps Pokémon collectors make better decisions by turning noisy market data into transparent, collector-grade pricing and portfolio intelligence.**

Positioning:
- **Not** a casual scanner-first toy.
- **Not** a social flex app built around inflated totals.
- **Not** an AI grading gimmick.
- **Yes** to a trusted collector terminal focused on truth, provenance, and decision support.

---

## 5. Target Users

Based on the in-repo research, PokePrice should prioritize these users:

### Primary personas
1. **Investor / Portfolio Collector**
   - Needs cost basis, ROI, alerts, realizable pricing.
2. **Vintage Holder**
   - Needs condition-aware valuation and grading workflows.
3. **Sealed Collector**
   - Needs sealed inventory, storage tracking, and hold-vs-open context.
4. **International Buyer / Arbitrage-Aware Collector**
   - Needs cross-region price clarity and landed-cost awareness.
5. **Master Set Builder / Power User**
   - Needs accurate card coverage, variants, and collection depth.

### Secondary personas
6. **Memorial / Story Collector**
   - Wants provenance and personal meaning attached to cards.
7. **Card Show Trader**
   - Needs quick pricing reference, trade accounting, and offline-friendly workflows.
8. **Parent / Family Collector**
   - Needs simple organization and child-safe collection visibility.

---

## 6. Product Principles

1. **Truth over hype**  
   Every price shown must be labeled by source and confidence.

2. **Facts vs estimates must be explicit**  
   Estimated values cannot be presented as if they are live market data.

3. **Collector workflows beat generic dashboards**  
   Condition, grading, sealed, storage, and provenance are first-class.

4. **Local utility first, cloud second**  
   The product should remain useful before accounts/sync exist.

5. **No fake precision**  
   If data is weak, say it is weak.

---

## 7. Goals

### Business / product goals
- Establish PokePrice as the **most trusted pricing UX** in Pokémon collecting.
- Differentiate from Collectr/TCGPlayer/Pokellector through workflows they do not own.
- Build a roadmap that can support future monetization via premium workflows, not basic collection storage.

### User goals
- Know what a card is worth across multiple sources.
- Understand what they could realistically sell it for.
- Track what they own, what they paid, and what condition it is in.
- Track sealed and grading workflows in one place.
- Export data and maintain control.

### Product goals for next phases
- Move from estimated pricing layers to real integrations where possible.
- Add durable backend infrastructure for accounts and sync.
- Expand from “pricing dashboard” into “collector operating system.”

---

## 8. Non-Goals

For the near-term roadmap, PokePrice should **not** prioritize:
- AI auto-grading as an authority product claim.
- Social feed / community feed as a core differentiator.
- Generic collectibles beyond Pokémon TCG.
- Marketplace fulfillment or escrow in the initial product phases.
- Full dealer/LGS software before collector workflows are strong.

---

## 9. Core Value Proposition

PokePrice answers five collector questions better than existing apps:

1. **What is this card worth right now?**  
2. **How trustworthy is that number?**  
3. **What would I actually net if I sold it?**  
4. **What is my real portfolio performance based on what I paid and the condition I own?**  
5. **How do I manage sealed, graded, and story-rich collection workflows in one place?**

---

## 10. Product Scope

### 10.1 Current MVP scope (already represented in repo)
- Search and discover cards.
- View card pricing from multiple sources.
- Display confidence and “realizable” logic.
- Save cards to watchlist.
- Add cards to collection.
- Track quantity, cost basis, and condition.
- Export collection to CSV.
- Track sealed products.
- Track grading submissions.
- Store card stories.
- Toggle USD/CAD.

### 10.2 Next production scope
- Harden data integrity and pricing transparency.
- Add backend persistence and auth.
- Replace estimated sources with live/verified sources where feasible.
- Improve portfolio and alerting workflows.

---

## 11. Functional Requirements

## 11.1 Card Search
**User story:** As a collector, I want to quickly find cards by name or number, even with imperfect spelling.

**Requirements**
- Support search by card name.
- Support search by number patterns like `#105`, `4/102`, `TG01`, `SVP001`.
- Support fuzzy matching for misspellings.
- Rank exact/near matches above weak matches.
- Return set, number, rarity, image, and best-available price summary.

**Success criteria**
- Common misspellings still surface the intended card.
- Search latency feels near-instant for normal use.

## 11.2 Card Pricing Detail
**User story:** As a serious collector, I want transparent multi-source pricing so I can judge whether a card is fairly valued.

**Requirements**
- Show source-by-source pricing separately.
- Show source freshness where available.
- Show a confidence label derived from source agreement.
- Show a realizable/net estimate separately from market price.
- Clearly label any estimate vs direct-source data.
- Link out to original source pages when possible.

**Critical requirement**
- Estimated values must never visually masquerade as verified live source values.

## 11.3 Watchlist
**User story:** As a collector, I want to save cards I care about and revisit them later.

**Requirements**
- Add/remove cards from watchlist.
- Persist watchlist between sessions.
- Show price snapshot and trend summary for watched items.
- Future-ready for alerts.

## 11.4 Collection Tracking
**User story:** As a collector, I want to track what I own and what I paid so I can understand real portfolio performance.

**Requirements**
- Add cards to collection.
- Track quantity.
- Track cost basis per card.
- Track condition per card.
- Compute invested amount and unrealized performance.
- Export collection to CSV.
- Support local filtering/search within collection.

**Future requirement**
- Support multiple copies of the same card with distinct conditions and acquisition lots.

## 11.5 Sealed Vault
**User story:** As a sealed collector, I want to track sealed products like I track cards.

**Requirements**
- Store sealed product name, set, format, quantity, cost basis, estimated value, storage location, purchase date, and notes.
- Support common formats: booster box, ETB, blister, tin, collection box, other.
- Show inventory-level totals.
- Preserve user-entered storage context.

**Future requirement**
- Add hold/open decision support and per-pack normalization.

## 11.6 Grading Submission Tracker
**User story:** As a grader, I want to track where my cards are, what grading cost me, and what came back.

**Requirements**
- Create grading submissions.
- Track grading company, service level, submission date, declared value, grading cost, shipping cost, other cost, status, and timeline stages.
- Optionally link a submission to a collection item.
- Support final grade and cert number.
- Support lifecycle states such as pending, in transit, received, grading, completed, lost, cancelled.

**Future requirement**
- Auto-roll grading cost into collection cost basis when returned.

## 11.7 Card Stories / Provenance
**User story:** As a collector, I want to attach meaning and history to specific cards.

**Requirements**
- Create and edit a story tied to a card.
- Support title, body, event date, and created/updated timestamps.
- Keep this as a first-class feature, not buried metadata.

**Future requirement**
- Support photo/audio attachments and exportable “heirloom report” flows.

## 11.8 Currency and Region Context
**User story:** As a non-US collector, I want price context in my working currency and region.

**Requirements**
- Support USD/CAD display today.
- Preserve selected currency.
- Show cross-region estimates only with explicit estimate labeling.
- Future architecture should allow real country- or market-specific pricing modules.

---

## 12. Key Product Gaps to Address

These are important because they affect trust.

### 12.1 Estimated eBay sold data
Today, eBay sold average is derived from a multiplier of TCGPlayer market price. That is useful as a placeholder but weak as a truth claim.

**Requirement:** replace with direct sold-listing integration or clearly degrade the prominence of the estimate until real data exists.

### 12.2 Consensus inflation risk
The current consensus model averages multiple values, including converted Cardmarket values and estimated eBay. For some cards, this can produce obviously distorted outputs if sources are structurally incomparable.

**Requirement:** redesign consensus methodology to:
- normalize sources properly,
- exclude outliers,
- weight source trust by card type/region/condition context,
- avoid presenting a mathematically neat but practically misleading number.

### 12.3 Cross-region estimate credibility
The current cross-region panel uses hardcoded heuristics. It is useful as concept validation, but not yet trustworthy enough to be a headline decision tool.

**Requirement:** move toward source-backed regional pricing and landed-cost logic.

### 12.4 Local-only persistence
Current localStorage persistence is good for MVP, but insufficient for product durability.

**Requirement:** add account-based sync, backup, and multi-device continuity.

---

## 13. UX Requirements

### 13.1 Pricing UX
- Every price module must show source and recency.
- Estimates must use visibly distinct labeling.
- Confidence state must be understandable by non-expert users.
- Realizable price must be clearly explained as net/after-fees logic.

### 13.2 Serious-collector UX
- Cost basis and condition cannot be hidden behind advanced settings.
- Sealed and grading should feel native, not bolted on.
- Card detail should support fast decision-making at a desk or card show.

### 13.3 Mobile responsiveness
- Search, detail, watchlist, collection, sealed, and grading flows must be fully usable on mobile.
- Detail pages should prioritize scanability over ornamental density.

---

## 14. Technical Requirements

### 14.1 Data source integrity
- External source responses must handle timeouts and retries.
- Source failures should degrade gracefully.
- Source-level availability should not crash the UI.

### 14.2 API reliability
- Replace in-memory rate limiting for production deployments.
- Add real caching strategy for high-frequency lookups.
- Prepare for source adapters per marketplace.

### 14.3 Persistence
Phase 1 backend requirements:
- user accounts,
- cloud persistence,
- device sync,
- export/import.

### 14.4 Observability
- Track search usage, detail views, add-to-collection, add-to-watchlist, sealed creation, grading creation, CSV export.
- Track source failure rates and latency per source.
- Track estimate-vs-live coverage rate.

---

## 15. Proposed Data Model Direction

### Entities
- **User**
- **Card**
- **PriceSnapshot**
- **CollectionItem**
- **WatchlistItem**
- **SealedItem**
- **GradingSubmission**
- **GradingStage**
- **CardStory**
- **StorageLocation**
- **AlertRule**

### Important modeling decision
A long-term collection model should support:
- multiple copies of the same card,
- each copy or lot having its own condition,
- acquisition date,
- cost basis,
- optional grading linkage.

That is stronger than the current simplified per-card aggregate model.

---

## 16. Metrics

### North-star metric
- **Weekly active serious collectors** who view pricing and maintain collection data.

### Core product metrics
- Search-to-detail conversion rate.
- Detail-to-watchlist conversion rate.
- Detail-to-collection conversion rate.
- % of collection items with cost basis filled.
- % of collection items with condition filled.
- # of sealed items tracked per active sealed user.
- # of grading submissions created per active grader.
- CSV export rate.
- Repeat weekly retention for collectors with 10+ items saved.

### Trust metrics
- % of visible prices that are direct-source vs estimated.
- Source freshness coverage.
- User-reported price accuracy satisfaction.
- Frequency of users clicking out to source links.

---

## 17. Monetization Direction

PokePrice should keep core collection trust features strong in free tier and monetize advanced workflows.

### Free tier candidates
- Search.
- Basic detail pricing.
- Watchlist.
- Basic collection tracking.
- CSV export.
- Basic stories.

### Premium candidates
- Advanced portfolio analytics.
- Live alerts.
- Grading analytics and submission automation.
- Rich sealed analytics.
- Cross-region landed-cost tools.
- Insurance / heirloom exports.
- Historical price snapshots and charts.
- Multi-device cloud sync with backup/version history.

---

## 18. Roadmap

## Phase 0 — Current Prototype Hardening
**Goal:** make the current prototype trustworthy enough to demo seriously.

Ship:
- tighten estimate labeling,
- fix consensus/outlier methodology,
- improve empty/error states,
- add source attribution consistently,
- add simple analytics,
- add import/export polish.

## Phase 1 — Collector Core
**Goal:** become a reliable collection + pricing tool.

Ship:
- auth + backend persistence,
- synced watchlist/collection/sealed/grading/stories,
- better portfolio calculations,
- richer collection lot model,
- stronger detail pages.

## Phase 2 — Trust Differentiators
**Goal:** own the “serious collector” niche.

Ship:
- live sold-price integrations where feasible,
- source reliability weighting,
- advanced condition-aware valuation controls,
- alerts,
- historical snapshots.

## Phase 3 — Category-Creating Workflows
**Goal:** own greenfield features competitors ignore.

Ship:
- sealed analytics,
- grading lifecycle intelligence,
- insurance/heirloom reports,
- offline show mode,
- advanced regional pricing / landed cost.

---

## 19. Risks

### Product risks
- If estimated data is presented too aggressively, trust will collapse.
- If the product becomes too feature-heavy without prioritization, it may feel unfocused.
- If collector workflows remain local-only too long, retention will suffer.

### Technical risks
- External marketplace/API dependency volatility.
- Data normalization across regions and variants.
- Pricing consensus logic becoming misleading at scale.

### Market risks
- Existing products can copy surface-level features.
- Trust differentiation only works if claims remain precise and verifiable.

---

## 20. Release Criteria for a Real Public Beta

PokePrice should not be publicly positioned as a serious pricing tool until:
- estimated data is explicitly labeled everywhere,
- consensus logic is resilient against outliers,
- collection data is persistable beyond one browser,
- key workflows are stable on mobile,
- source failures are graceful,
- analytics and error monitoring are in place.

---

## 21. Recommended Immediate Priorities

1. **Fix pricing trust presentation**
   - Rework consensus and estimate labeling.
2. **Add backend persistence**
   - Move beyond localStorage.
3. **Strengthen collection model**
   - Better support multiple copies/lots/conditions.
4. **Harden grading and sealed flows**
   - These are major differentiators already seeded in the repo.
5. **Prepare monetizable trust features**
   - alerts, historical tracking, reports, advanced analytics.

---

## 22. Final Product Definition

PokePrice should be defined as:

> **A trusted Pokémon collector terminal that combines transparent multi-source pricing, realizable value insight, portfolio tracking, sealed inventory, grading workflows, and card provenance in one collector-grade system.**

That is a sharper and more defensible product than “Pokémon card price tracker.”
