# Enhancements (prioritized)

## Phase 3 — Medium Initiatives

- update openalert text msg preview content
- Instrument FPTI/Amplitude and email alerts- use plugins
- Gather sample cancellation emails from various platforms and build template-specific parsers; current status note: done for Setmore and Booksy, add others gradually; update parser output to include staff member name. ENSURE parsing takes into account location and routes it correctly so we can continue to just use one inbound email (might work already). strehgten so its not reliant on exact text and has fallbacks if needed. AI to parse as backup?? ask agent for proposal as to how to do this well for all diff booking platforms. also look at platforms from potential pilot merchants to ensure we support them. 
- polish homepage

## Phase 4 — Large Initiatives

- Review bug scan and use implementer to fix
- Review security scan and use implementer to fix
- Consider backups for DB and app
- Consider monitoring, amplitude + other for backend?
- Polish end-to-end UX for merchant and consumer.
- WIP: billing E2E testing and add friends-and-family plan pricing with unique one-time-use Stripe code, plus app-side support if needed.
- Security- use codex plugin to test
- E2E testing of all flows; include beta testing with named testers (dad, Aaron, Andrew, Ece, etc.)E2E security scan.
- On account settings, explore sharing certain values across locations (business name, hours, etc.) and make this easy; includes competitor research angle and same idea for billing settings. Think through how locations dropdown impacts account settings page.
- Refresh layout/groupings of account screen: regroup fields, reconsider labels/sections (e.g., email under biz profile, booking defaults, staff, locations, integrations -> maybe "connectors", maybe separate login/account details). ADD ACCOUNT INFO SECTION??
- Referral system exploration: discounted months vs credits to offset monthly bill, with constraint that rewards are only earned after trial ends and first successful billing to reduce abuse risk.
- Future optimization bucket (features + tech): roles/permissions, new login models, different profiles per location or per staff, admin login vs staff login.
- Add retention coupons in Stripe for cancellation attempts.
- Research Shopify/ecommerce "notify me" flows and similar flows in other industries.
- Add ability for merchant to view notify list and interact; allow merchants to manually add consumers to notify list.
- Add notification history: log of notifications/texts sent for openings and how many consumers received text for each opening.
- shorten the inbound fwding email and UPSDATE page content
- Fix Google Calendar sync. x

