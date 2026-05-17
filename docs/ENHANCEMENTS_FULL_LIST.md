# Enhancements (prioritized)

## Phase 1 — Quick Wins (same day)

- Polish up the booking approval and booked opening modals - round out bottom corners of modal space it etc.
- Notify list subheader says "Noho" in it; ensure this is consistent across all pages- ensure qr code and settings page do the same with their subheader
- Settings-page icons are in rounded rectangles while other pages are not; make consistent.
- In accounts with no openings filled yet, remove "revenue recovered" section from manage billing page because it is not relevant until data exists.
- Change all toast notifications to better format.
- update the content of the QR code page. Also, slightly polish the look and feel.. QR code and account screens are narrower than openings/reporting; make widths consistent; also add openings header text to openings page to match other page headers; keep responsive behavior on all pages.
- Only show working hours button on the day view of calendar Doesn't seem to do anything.

## Phase 2 — Small Projects (1-3 days)

- Confirm/fix text-to-create-opening flow.
- Add consumer text notification for when manual confirmation is on and the merchant confirms and approves an appointment - consumer should get a text
- When manual confirmation is on and the merchant gets a text that the user is requesting an appointment, ensure that the URL and the text correctly take them to the approve/reject page. ALSO ensure that the consumer gets a text once confirmed/approved.
- If merchant does not have booking systems, define how they want to be notified when someone books (check app, text, etc.)
- Add ability for merchant to view notify list and interact; allow merchants to manually add consumers to notify list.
- Update openings modal time picker to a scroll list with 15-minute increments from 12-12; model after Booksy/Setmore/Apple patterns.

## Phase 3 — Medium Initiatives (3-7 days)

- Add tutorial/walkthrough explainer of various ways to create openings; this is effectively the main merchant action required to use the app. Create tutorial for email input to booking platform or forwarding.
- Add notification history: log of notifications/texts sent for openings and how many consumers received text for each opening.
- Instrument FPTI/Amplitude and email alerts.
- Test staff E2E and billing.
- Fix Google Calendar sync.
- Gather sample cancellation emails from various platforms and build template-specific parsers; current status note: done for Setmore and Booksy, add others gradually; update parser output to include staff member name.

## Phase 4 — Large Initiatives (1-3+ weeks)

- Polish end-to-end UX for merchant and consumer.
- WIP: billing E2E testing and add friends-and-family plan pricing with unique one-time-use Stripe code, plus app-side support if needed.
- E2E testing of all flows; include beta testing with named testers (dad, Aaron, Andrew, Ece, etc.).
- E2E security scan.
- On account settings, explore sharing certain values across locations (business name, hours, etc.) and make this easy; includes competitor research angle and same idea for billing settings. Think through how locations dropdown impacts account settings page.
- Refresh layout/groupings of account screen: regroup fields, reconsider labels/sections (e.g., email under biz profile, booking defaults, staff, locations, integrations -> maybe "connectors", maybe separate login/account details). ADD ACCOUNT INFO SECTION??
- Referral system exploration: discounted months vs credits to offset monthly bill, with constraint that rewards are only earned after trial ends and first successful billing to reduce abuse risk.
- Future optimization bucket (features + tech): roles/permissions, new login models, different profiles per location or per staff, admin login vs staff login.
- Add retention coupons in Stripe for cancellation attempts.
- Research Shopify/ecommerce "notify me" flows and similar flows in other industries.

