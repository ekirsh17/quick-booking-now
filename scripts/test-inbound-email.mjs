#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const paths = [join(root, 'server', '.env'), join(root, '.env.local'), join(root, '.env')];
  const env = {};
  for (const p of paths) {
    try {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m) continue;
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!env[m[1]]) env[m[1]] = val;
      }
    } catch { /* skip */ }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
const FN_URL = `${SUPABASE_URL}/functions/v1/inbound-email`;
const BASE = `${SUPABASE_URL}/rest/v1`;

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const fnHeaders = {
  'Content-Type': 'application/json',
  apikey: ANON_KEY || SERVICE_KEY,
  Authorization: `Bearer ${ANON_KEY || SERVICE_KEY}`,
};

const TO = 'notify+a8fc12cb-aa5d-406d-a18b-0eca283c8723@inbound.openalert.org';
const SUFFIX = process.argv[2] || '002';

function slotMatchesTime(slot, expectedUtcIso, toleranceMin = 30) {
  const normalized = expectedUtcIso.endsWith('Z') ? expectedUtcIso : `${expectedUtcIso}Z`;
  return Math.abs(new Date(slot.start_time).getTime() - new Date(normalized).getTime()) <= toleranceMin * 60 * 1000;
}

const scenarios = [
  {
    id: 1, name: 'Setmore (regression)',
    payload: {
      From: 'no-reply@setmore.com', To: TO, OriginalRecipient: TO,
      Subject: 'Appointment canceled: Fri 27 Jun 2025 at 10:00 AM (EDT)',
      TextBody: 'Your appointment has been canceled.\nService: Haircut\nDate: Friday, June 27, 2025\nTime: 10:00 AM - 10:30 AM EDT',
      HtmlBody: '<p>Your appointment has been canceled.</p><p><b>What</b></p><p>Haircut</p><p><b>When</b></p><p>Fri 27 Jun 2025 10:00 AM - 10:30 AM EDT</p>',
      MessageID: `test-setmore-${SUFFIX}`, Date: 'Mon, 09 Jun 2025 12:00:00 +0000',
    },
    check: (ev, slot) => {
      const f = [];
      if (ev?.event_type !== 'cancellation_parsed') f.push(`event_type=${ev?.event_type}`);
      if (ev?.provider !== 'setmore') f.push(`provider=${ev?.provider}`);
      if ((ev?.confidence ?? 0) < 0.9) f.push(`confidence=${ev?.confidence}`);
      if (!slot || !slotMatchesTime(slot, '2025-06-27T14:00:00')) f.push(`slot=${slot?.start_time}`);
      return f;
    },
  },
  {
    id: 2, name: 'Booksy (regression)',
    payload: {
      From: 'notifications@booksy.com', To: TO, OriginalRecipient: TO,
      Subject: 'cancelled appointment on: Friday, June 27, 2025 2:00 PM',
      TextBody: 'Your client cancelled appointment for Manicure on: Friday, June 27, 2025, 2:00 PM - 2:30 PM',
      HtmlBody: '<p>Your client <b>cancelled appointment</b> for <b>Manicure</b> on: <b>Friday, June 27, 2025, 2:00 PM - 2:30 PM</b></p>',
      MessageID: `test-booksy-${SUFFIX}`, Date: 'Mon, 09 Jun 2025 12:01:00 +0000',
    },
    check: (ev, slot) => {
      const f = [];
      if (ev?.event_type !== 'cancellation_parsed') f.push(`event_type=${ev?.event_type}`);
      if (ev?.provider !== 'booksy') f.push(`provider=${ev?.provider}`);
      if (!slot || !slotMatchesTime(slot, '2025-06-27T18:00:00')) f.push(`slot=${slot?.start_time}`);
      return f;
    },
  },
  {
    id: 3, name: 'Square',
    payload: {
      From: 'noreply@squareup.com', To: TO, OriginalRecipient: TO, Subject: 'Appointment Cancelled',
      TextBody: 'An appointment has been cancelled.\nService: Deep Tissue Massage\nProvider: Marcus T.\nDate: Friday, June 27, 2025\nTime: 11:00 AM - 12:00 PM',
      HtmlBody: '<table><tr><td><strong>Service</strong></td><td>Deep Tissue Massage</td></tr><tr><td><strong>Provider</strong></td><td>Marcus T.</td></tr><tr><td><strong>Date</strong></td><td>Friday, June 27, 2025</td></tr><tr><td><strong>Time</strong></td><td>11:00 AM - 12:00 PM</td></tr></table>',
      MessageID: `test-square-${SUFFIX}`, Date: 'Mon, 09 Jun 2025 12:02:00 +0000',
    },
    check: (ev, slot) => {
      const f = [];
      if (ev?.event_type !== 'cancellation_parsed') f.push(`event_type=${ev?.event_type}`);
      if (ev?.provider !== 'square') f.push(`provider=${ev?.provider}`);
      const pd = Array.isArray(ev?.parsed_data) ? ev.parsed_data[0] : ev?.parsed_data;
      if (!pd?.source?.startsWith('square_')) f.push(`source=${pd?.source}`);
      if (!slot || !slotMatchesTime(slot, '2025-06-27T15:00:00')) f.push(`slot=${slot?.start_time}`);
      if (slot?.duration_minutes !== 60) f.push(`duration=${slot?.duration_minutes}`);
      if (pd?.staff_name !== 'Marcus T.') f.push(`staff_name=${pd?.staff_name}`);
      return f;
    },
  },
  {
    id: 4, name: 'Vagaro',
    payload: {
      From: 'noreply@vagaro.com', To: TO, OriginalRecipient: TO, Subject: 'Appointment Cancelled - Vagaro',
      TextBody: 'An appointment has been cancelled.\nService: Balayage\nProvider: Jessica R.\nDate: Saturday, June 28, 2025\nTime: 1:00 PM - 3:00 PM',
      HtmlBody: '<p>An appointment has been cancelled.</p><table><tr><td>Service:</td><td>Balayage</td></tr><tr><td>Provider:</td><td>Jessica R.</td></tr><tr><td>Date:</td><td>Saturday, June 28, 2025</td></tr><tr><td>Time:</td><td>1:00 PM - 3:00 PM</td></tr></table>',
      MessageID: `test-vagaro-${SUFFIX}`, Date: 'Mon, 09 Jun 2025 12:03:00 +0000',
    },
    check: (ev, slot) => {
      const f = [];
      if (ev?.event_type !== 'cancellation_parsed') f.push(`event_type=${ev?.event_type}`);
      if (!slot || !slotMatchesTime(slot, '2025-06-28T17:00:00')) f.push(`slot=${slot?.start_time}`);
      if (slot?.duration_minutes !== 120) f.push(`duration=${slot?.duration_minutes}`);
      return f;
    },
  },
  {
    id: 5, name: 'Acuity',
    payload: {
      From: 'no-reply@acuityscheduling.com', To: TO, OriginalRecipient: TO,
      Subject: 'Cancelled: Facial with Sarah on June 27, 2025',
      TextBody: 'An appointment has been cancelled.\nAppointment Type: Facial\nDate/Time: June 27, 2025 at 3:00 PM EDT\nCalendar: Sarah',
      HtmlBody: '<p><strong>Appointment Type:</strong> Facial</p><p><strong>Date/Time:</strong> June 27, 2025 at 3:00 PM EDT</p><p><strong>Calendar:</strong> Sarah</p>',
      MessageID: `test-acuity-${SUFFIX}`, Date: 'Mon, 09 Jun 2025 12:04:00 +0000',
    },
    check: (ev, slot) => {
      const f = [];
      if (ev?.event_type !== 'cancellation_parsed') f.push(`event_type=${ev?.event_type}`);
      if (!slot || !slotMatchesTime(slot, '2025-06-27T19:00:00')) f.push(`slot=${slot?.start_time}`);
      const pd = Array.isArray(ev?.parsed_data) ? ev.parsed_data[0] : ev?.parsed_data;
      if (pd?.appointment_name !== 'Facial') f.push(`appointment_name=${pd?.appointment_name}`);
      if (pd?.staff_name !== 'Sarah') f.push(`staff_name=${pd?.staff_name}`);
      return f;
    },
  },
  {
    id: 6, name: 'Fresha',
    payload: {
      From: 'no-reply@fresha.com', To: TO, OriginalRecipient: TO, Subject: 'Appointment cancelled at The Studio',
      TextBody: 'An appointment has been cancelled.\nService: Swedish Massage\nWith: Daniel K.\nDate: Friday, June 27, 2025\nTime: 4:00 PM - 5:00 PM',
      HtmlBody: '<p>An appointment has been cancelled.</p><p>Service: <strong>Swedish Massage</strong></p><p>With: <strong>Daniel K.</strong></p><p>Date: Friday, June 27, 2025</p><p>Time: 4:00 PM - 5:00 PM</p>',
      MessageID: `test-fresha-${SUFFIX}`, Date: 'Mon, 09 Jun 2025 12:05:00 +0000',
    },
    check: (ev, slot) => {
      const f = [];
      if (ev?.event_type !== 'cancellation_parsed') f.push(`event_type=${ev?.event_type}`);
      if (!slot || !slotMatchesTime(slot, '2025-06-27T20:00:00')) f.push(`slot=${slot?.start_time}`);
      if (slot?.duration_minutes !== 60) f.push(`duration=${slot?.duration_minutes}`);
      const pd = Array.isArray(ev?.parsed_data) ? ev.parsed_data[0] : ev?.parsed_data;
      if (!pd?.source?.startsWith('fresha_')) f.push(`source=${pd?.source}`);
      return f;
    },
  },
  {
    id: 7, name: 'GlossGenius',
    payload: {
      From: 'no-reply@glossgenius.com', To: TO, OriginalRecipient: TO, Subject: 'Appointment Cancelled: Color + Cut on June 28',
      TextBody: 'An appointment has been cancelled.\nService: Color + Cut\nProvider: Aisha M.\nDate: Saturday, June 28, 2025\nTime: 10:00 AM',
      HtmlBody: '<p><strong>Service:</strong> Color + Cut</p><p><strong>Provider:</strong> Aisha M.</p><p><strong>Date:</strong> Saturday, June 28, 2025</p><p><strong>Time:</strong> 10:00 AM</p>',
      MessageID: `test-glossgenius-${SUFFIX}`, Date: 'Mon, 09 Jun 2025 12:06:00 +0000',
    },
    check: (ev, slot) => {
      const f = [];
      if (ev?.event_type !== 'cancellation_parsed') f.push(`event_type=${ev?.event_type}`);
      if (!slot || !slotMatchesTime(slot, '2025-06-28T14:00:00')) f.push(`slot=${slot?.start_time}`);
      return f;
    },
  },
  {
    id: 8, name: 'Generic regex',
    payload: {
      From: 'noreply@someotherbookingapp.com', To: TO, OriginalRecipient: TO, Subject: 'Appointment Cancelled',
      TextBody: 'Your appointment for a Haircut with Stylist: James on Friday, June 27, 2025 at 9:00 AM has been cancelled.',
      HtmlBody: '<p>Your appointment for a <strong>Haircut</strong> with Stylist: <strong>James</strong> on Friday, June 27, 2025 at 9:00 AM has been cancelled.</p>',
      MessageID: `test-generic-${SUFFIX}`, Date: 'Mon, 09 Jun 2025 12:07:00 +0000',
    },
    check: (ev, slot) => {
      const f = [];
      if (ev?.event_type !== 'cancellation_parsed') f.push(`event_type=${ev?.event_type}`);
      if (ev?.provider != null) f.push(`provider=${ev?.provider}`);
      if (!slot || !slotMatchesTime(slot, '2025-06-27T13:00:00')) f.push(`slot=${slot?.start_time}`);
      const pd = Array.isArray(ev?.parsed_data) ? ev.parsed_data[0] : ev?.parsed_data;
      if (pd?.source === 'weekday') f.push(`source=weekday`);
      return f;
    },
  },
  {
    id: 9, name: 'AI fallback',
    payload: {
      From: 'noreply@unknownplatform.io', To: TO, OriginalRecipient: TO, Subject: 'Cancellation notice',
      TextBody: "Hey, just a heads up — the session booked for next Friday afternoon around 3 has been called off. The client won't be coming in.",
      HtmlBody: "<p>Hey, just a heads up — the session booked for next Friday afternoon around 3 has been called off. The client won't be coming in.</p>",
      MessageID: `test-ai-fallback-${SUFFIX}`, Date: 'Mon, 09 Jun 2025 12:08:00 +0000',
    },
    check: (ev) => {
      const f = [];
      const et = ev?.event_type;
      if (et !== 'cancellation_parsed' && et !== 'cancellation_unparsed') f.push(`event_type=${et}`);
      if (et === 'cancellation_parsed' && (ev?.confidence ?? 1) > 0.75) f.push(`confidence=${ev?.confidence}`);
      return f;
    },
  },
  {
    id: 10, name: 'Non-cancellation',
    payload: {
      From: 'noreply@setmore.com', To: TO, OriginalRecipient: TO, Subject: 'New appointment booked',
      TextBody: 'A new appointment has been booked for Friday, June 27, 2025 at 2:00 PM.',
      HtmlBody: '<p>A new appointment has been booked for Friday, June 27, 2025 at 2:00 PM.</p>',
      MessageID: `test-non-cancel-${SUFFIX}`, Date: 'Mon, 09 Jun 2025 12:09:00 +0000',
    },
    check: (ev, slot, http) => {
      const f = [];
      if (slot) f.push('unexpected slot');
      if (ev?.event_type !== 'email_received') f.push(`event_type=${ev?.event_type}`);
      if (http.status !== 200) f.push(`HTTP ${http.status}`);
      if (http.body?.success !== true) f.push(`success=${http.body?.success}`);
      return f;
    },
  },
];

async function restGet(path, query) {
  const res = await fetch(`${BASE}${path}?${query}`, { headers });
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function main() {
  const results = [];
  for (const scenario of scenarios) {
    const before = await restGet('/slots', `message_id=eq.${encodeURIComponent(scenario.payload.MessageID)}&select=id`);
    const res = await fetch(FN_URL, { method: 'POST', headers: fnHeaders, body: JSON.stringify(scenario.payload) });
    const body = await res.json().catch(() => ({}));
    await new Promise((r) => setTimeout(r, 1500));
    const events = await restGet('/email_inbound_events', `message_id=eq.${encodeURIComponent(scenario.payload.MessageID)}&select=*`);
    const ev = events[0];
    let slot = null;
    if (body?.opening_ids?.[0]) {
      const slots = await restGet('/slots', `id=eq.${body.opening_ids[0]}&select=*`);
      slot = slots[0];
    }
    const fails = scenario.check(ev, slot, { status: res.status, body });
    results.push({ id: scenario.id, name: scenario.name, pass: fails.length === 0, fails, event_type: ev?.event_type, source: ev?.parsed_data?.[0]?.source || ev?.parsed_data?.source });
  }

  console.log('\n=== INBOUND EMAIL PARSER TEST RESULTS ===\n');
  let passed = 0;
  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    if (r.pass) passed += 1;
    console.log(`Scenario ${r.id} — ${r.name}: ${status}${r.fails.length ? ' — ' + r.fails.join('; ') : ''}`);
    if (r.source) console.log(`  source: ${r.source}`);
  }
  console.log(`\n${passed}/10 passed\n`);
  process.exit(passed === 10 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
