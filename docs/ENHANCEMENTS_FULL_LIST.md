# Enhancements (prioritized)

## Phase 1 — Quick Wins

- DONE

## Phase 2 — Small Projects

- Screenshots on iPhone, darken color of toast
- Two claude prompts
- If merchant does not have booking systems, define how they want to be notified when someone books (check app, text, etc.)
- inbound fwding email UPSDATE page content remove side bar
- fix staff seats 3 of 1 error

## Phase 3 — Medium Initiatives

- Instrument FPTI/Amplitude and email alerts.
- Confirm/fix text-to-create-opening flow. Also ensure that approve or deny for manual appointments, SMS flow works as expected.
- Gather sample cancellation emails from various platforms and build template-specific parsers; current status note: done for Setmore and Booksy, add others gradually; update parser output to include staff member name.

## Phase 4 — Large Initiatives

- Polish end-to-end UX for merchant and consumer.
- WIP: billing E2E testing and add friends-and-family plan pricing with unique one-time-use Stripe code, plus app-side support if needed.
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

