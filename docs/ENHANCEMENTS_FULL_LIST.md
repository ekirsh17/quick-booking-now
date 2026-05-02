# Enhancements (prioritized)

Prioritized for a demoable product and onboarding real merchants quickly. Tiers are **P0** (do first: blockers and core loop) through **P3** (larger or later bets). Within each tier, items are ordered roughly by impact versus effort (foundational fixes and quick wins before heavier work). Original thematic wording is preserved except for spelling fixes.

## P0 — Unblock sign-up, core loop, and first-merchant trust

- Notify-me consumer page does not seem to work for logged-in consumers.
- Notify-me consumer page does not have guest flow / change name-number flow if remembered from last time; may have been removed; possibly correlated with "sign out consumer" button; question remains whether robust consumer accounts are wanted in DB.
- Confirm/fix text-to-create-opening flow.
- Add tutorial/walkthrough explainer of various ways to create openings; this is effectively the main merchant action required to use the app.
- On cancel trial and return to app, verify whether banner appears immediately or only after refresh.
- In accounts with no openings filled yet, remove "revenue recovered" section from manage billing page because it is not relevant until data exists.

## P1 — Merchant operations and high-touch UX

- Add ability for merchant to view notify list and interact; allow merchants to manually add consumers to notify list.
- Notify list subheader says "Noho" in it; ensure this is consistent across all pages (either all pages do this or none).
- Add location name (if populated, e.g., Noho/Chelsea) to consumer views.
- Fix consumer date selector for notify-me page range and make calendar widget auto-close when date selected.
- Update UI overall for this consumer page and maybe following pages.
- Update openings modal time picker to a scroll list with 15-minute increments from 12-12; model after Booksy/Setmore/Apple patterns.
- WIP: billing E2E testing and add friends-and-family plan pricing with unique one-time-use Stripe code, plus app-side support if needed.

## P2 — Integrations, observability, polish, and QA

- Instrument FPTI/Amplitude and email alerts.
- Change all toast notifications to better format.
- Add notification history: log of notifications/texts sent for openings and how many consumers received text for each opening.
- Polish end-to-end UX for merchant and consumer.
- Test staff E2E and billing.
- E2E testing of all flows; include beta testing with named testers (dad, Aaron, Andrew, Ece, etc.).
- Check all consumer screens.
- Settings-page icons are in rounded rectangles while other pages are not; make consistent.
- Fix location selector on mobile and desktop, including background/box behavior on desktop to match mobile intent.
- QR code and account screens are narrower than openings/reporting; make widths consistent; also add openings header text to openings page to match other page headers; keep responsive behavior on all pages.
- Decide whether to hide calendar sync for now, or keep it for merchants that do not have a booking system.
- Create tutorial for email input to booking platform or forwarding.
- merge redirects to third-party booking systems to complete booking with main tutorial.
- Fix Google Calendar sync.
- Gather sample cancellation emails from various platforms and build template-specific parsers; current status note: done for Setmore and Booksy, add others gradually; update parser output to include staff member name.
- If merchant does not have booking systems, define how they want to be notified when someone books (check app, text, etc.).
- If merchant has "confirm appt" setting enabled, define how they actually go confirm pending appointments.
- E2E security scan.

## P3 — Account architecture, growth, and future scope

- Think through how locations dropdown impacts account settings page.
- On account settings, explore sharing certain values across locations (business name, hours, etc.) and make this easy; includes competitor research angle and same idea for billing settings.
- Refresh layout/groupings of account screen: regroup fields, reconsider labels/sections (e.g., email under biz profile, booking defaults, staff, locations, integrations -> maybe "connectors", maybe separate login/account details). ADD ACCOUNT INFO SECTION??
- Bolster consumer account functionality, or maybe skip for now to simplify.
- Add retention coupons in Stripe for cancellation attempts.
- Referral system exploration: discounted months vs credits to offset monthly bill, with constraint that rewards are only earned after trial ends and first successful billing to reduce abuse risk.
- Research Shopify/ecommerce "notify me" flows and similar flows in other industries.
- Future optimization bucket (features + tech): roles/permissions, new login models, different profiles per location or per staff, admin login vs staff login, and broader big/small optimization opportunities.

