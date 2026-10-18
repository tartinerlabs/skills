---
title: Time Zones and Timestamps
impact: CRITICAL
tags: time-zone, dst, timestamp, utc, calendar, grouping, travel
---

**Rule**: Store absolute instants, keep the time zone each event happened in, and format or group in the zone the user means — not whatever zone the device is in now.

**Why**: A run logged at 07:00 in Tokyo shows up as 23:00 the day before once the user is back in London, and lands under the wrong day in a timeline. Adding 24 hours to cross midnight, or assuming every day has 24 hours, breaks twice a year at DST changes.

### Checks

- **Absolute storage** — instants as UTC/epoch (`Date`, `Instant`, ISO 8601 with offset); never local wall-clock strings without a zone
- **Event zone kept** — for anything recorded in a place (location history, check-ins, workouts, receipts), store the IANA zone ID (`Europe/Paris`) next to the instant. An offset alone (`+02:00`) loses DST rules
- **Two meanings, named** — decide per screen whether a time is *event-local* ("where it happened") or *device-local* ("your time now"), and label it when the two can differ (show the zone or offset)
- **Calendar arithmetic** — use calendar APIs for "next day", "start of day", "same time tomorrow"; never `+ 86400` seconds
- **Grouping** — group by calendar day in the chosen zone. A timeline of past events usually groups by event-local day; say so in code
- **Future wall-clock events** (alarms, reminders at "9:00") — store local date-time plus zone, because zone rules can change before the event
- **Persisted semantics** — never reinterpret existing stored timestamps in place. If data lacks a zone, propose a migration and leave the data alone until the user approves it

### Incorrect

```ts
const key = new Date(event.at).toDateString(); // groups in the device's current zone
const tomorrow = new Date(day.getTime() + 24 * 60 * 60 * 1000); // wrong on DST days
```

### Correct

```ts
const key = new Intl.DateTimeFormat("en-CA", { timeZone: event.timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
  .format(new Date(event.at)); // "2026-03-29" in the event's own zone, used only as a grouping key
```

### Alternatives

Purely device-local data that never travels (a local reminder on one device, server logs in UTC) needs no stored zone. If existing data has no zone, the device's current zone is an honest fallback for display — note the limit rather than inventing a zone.
