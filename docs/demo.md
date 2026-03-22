## ProVigil Instincts 4.0 — Demo Script (3–4 min)

## Demo Goal

Present ProVigil Instincts as a standards-calibrated predictive maintenance platform for smart meter fleets, enabling DISCOMs to shift from reactive replacement to localized, explainable, action-oriented maintenance.

**Live URL**: https://provigilinstincts.click

**Total duration**: 3–4 minutes (9 scenes).

---

## Scene 1 — Problem Statement (30 s)

**Visual**: Open https://provigilinstincts.click — the **How It Works** landing page (`/`) loads first, showing 8 innovation cards, detection methods, and problem-solution mapping.

**Say**:

> "India is deploying 250 million smart meters by 2030. Utilities still replace them *after* they fail — that means outages, fire risk from overheating terminals, extra truck rolls, and revenue loss. ProVigil flips that model: we score meter health continuously, localize faults in feeder context, and convert insights into clear maintenance actions. Our landing page showcases all 8 innovations including VOC gas sensing hardware and vision language models."

---

## Scene 2 — Fleet Command Dashboard (25 s)

**Visual**: Navigate to Dashboard page (`/dashboard`) — fleet health cards, health distribution bar chart, anomaly trend, "Fleet Risk Insights" row.

**Say**:

> "The command dashboard gives the utility operator an instant snapshot. Fleet health score, the distribution of healthy vs. degraded meters, anomaly trend over time, and the Fleet Risk Insights row — counting thermal events, relay chatter incidents, harmonic issues, battery concerns, and comms failures in real time."

**Point out**: Fleet Risk Insights counters, health score stat card, anomaly trend chart.

---

## Scene 3 — Fault Scenario Trigger (20 s)

**Visual**: Click "See It In Action" CTA → fault scenario panel. Click "Run Fault Scenario".

**Say**:

> "Let me inject a live fault. This introduces degraded readings for a meter — the scoring engine processes them in real time, creates an alert, and generates a work order. Watch the alert count update."

**Action**: Click the fault scenario button. Wait for success confirmation.

---

## Scene 4 — Meter Diagnostics Deep Dive (35 s)

**Visual**: Navigate to Meter Fleet → click a warning/critical meter (e.g. MTR-008) → Meter Detail page.

**Say**:

> "For any meter, we see the full telemetry trail — voltage, current, temperature, THD, relay chatter, battery voltage — each with threshold reference lines from Indian CEA standards. The health forecast shows remaining useful life. And the extended metrics row gives a quick read on THD, relay timing, battery level, and firmware memory."

**Point out**: THD chart tab with 5%/8% reference lines, relay chatter with 50ms/200ms thresholds, battery chart with 2.8V/2.5V bounds, extended metrics row.

---

## Scene 5 — Digital Twin (25 s)

**Visual**: Click "View Digital Twin" for the same meter.

**Say**:

> "The digital twin decomposes the meter into six subsystems — terminals, power supply, display, battery, relay, and communication. Each shows a health percentage and risk factors. Instead of just saying 'this meter is failing', we tell the engineer *which component* to inspect first."

**Point out**: Worst-component highlight, risk factor labels, component health percentages.

---

## Scene 6 — Network Intelligence & Peer Consensus (25 s)

**Visual**: Open the Network Map page → see the Leaflet OpenStreetMap with color-coded meter/transformer/feeder markers → click a degraded meter node.

**Say**:

> "Network Intelligence is one of our strongest innovations. We don't analyze a meter in isolation — we compare it against its transformer neighbors. If only one meter degrades, it's likely a local hardware fault. If several neighbors degrade together, the issue may be upstream — a transformer problem or a feeder-level event. That's mesh consensus."

**Point out**: Feeder/transformer topology, critical meter queue, consensus verdict.

---

## Scene 7 — Alerts, AI Summary & Work Orders (30 s)

**Visual**: Open Alerts page → expand a critical alert → click "Generate Summary" → click "Auto-Generate" work order → switch to Work Orders page.

**Say**:

> "When risk is detected, the system turns it into action. Alerts show severity, type, and the affected meter. Expanding an alert lets the operator request a GPT-4o root-cause analysis — and with one click, auto-generate a prioritized maintenance work order. The work order cards show priority, status timeline, and assignment details."

**Point out**: AI Analysis panel, Work Order card with priority stripe and status timeline.

---

## Scene 8 — Field Mobile & VLM Validation (20 s)

**Visual**: Show the mobile app on a real phone (Expo Go or Android APK). Open Inspector screen → point camera at a meter → capture → show VLM analysis result.

**Say**:

> "Finally, the field crew validates on-site with our mobile app. The inspector captures an image of the meter, and the Vision Language Model (Cosmos Reason 2) analyzes physical condition — corrosion, damaged terminals, loose wires. This closes the loop from prediction to physical confirmation."

---

## Closing

"ProVigil Instincts 4.0 enables utilities to shift from reactive replacement to predictive, localized, explainable maintenance. All demo steps match the live product at https://provigilinstincts.click."

## Closing (10 s)

**Say**:

> "ProVigil: from fleet-wide prediction to component-level diagnosis to field validation — an end-to-end predictive maintenance platform for the smart meter era."

---

## Pre-Demo Checklist

1. Backend running (`make run-backend` or `docker compose up`) — or use live deployment at https://provigilinstincts.click
2. Dashboard running (`cd dashboard && npm run dev`) — or use live URL
3. Seed data loaded (10 meters with all telemetry fields)
4. Mobile app loaded in Expo Go on phone
5. Email subscriber added (to show live email delivery if desired)
6. Email toggle works (can pause/resume notifications from dashboard)
7. Guided Tour will auto-launch for first-time visitors — let it run or skip

### 6. Guided Tour and Visitor Engagement

Say:

"When judges or visitors first open the site, a 12-step guided tour automatically launches. It navigates across 7 pages — How It Works, Dashboard, Meter Fleet, Network Map, Digital Twin, Alerts, and Work Orders — with smooth transition overlays between pages."

Point out:

- The Q-Tips tour stepping through HowItWorks (/) → Dashboard (/dashboard) → Fleet (/meters) → Network Map (/map) → Digital Twin (/digital-twin) → Alerts (/alerts) → Work Orders (/workorders)
- The email subscription form: subscribe OR unsubscribe with toggle
- The email toggle button: operators can pause/resume email notifications at any time
- The 'Run Fault Scenario' button that injects a fault, creates an alert and work order, and links the user to see the result in real time
- Contact email: vishwakumaresh@gmail.com

Say:

"This makes the product self-explanatory. A visitor can experience the full detection-to-action pipeline in 30 seconds with one button click."

### 7. Mobile Field App

Open the mobile app (or show screenshots).

Say:

"The field technician uses our React Native mobile app. It has the same light, professional design. They see their assigned meters, alerts, and can run the VLM visual inspection with the device camera."

Point out:

- Light Apple-inspired theme matching the web dashboard
- Fleet view, alerts, and meter detail screens
- VLM camera inspector for visual defect detection

## How to mention the mobile app

Say:

"We also have a mobile field inspection app. The APK opens directly into the field vision flow, where an engineer captures a meter image and the VLM pipeline analyzes it for physical defects."

"For this walkthrough, I point the camera at a loose or hanging wire, capture the image, show the processing screen, and the app returns: 'There seem to be a loose connection' followed by 'Detected by Cosmos Reason 2.' It also supports voice playback for the finding."

"The APK is available at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`."

## Innovations to emphasize

Say these clearly:

1. "The model is localized, so each meter is interpreted in its feeder and transformer neighborhood."
2. "Network intelligence helps separate local meter faults from upstream grid issues."
3. "The digital twin gives subsystem-level explainability instead of one black-box score."
4. "The VLM workflow extends predictive maintenance into field inspection."
5. "AI summaries and work orders turn raw telemetry into action."

## Conclusion

Say:

"So ProVigil Instincts helps a DISCOM move from reactive meter replacement to localized predictive maintenance. The value is earlier fault detection, clearer diagnosis, faster field action, and a full path from anomaly to work order."

"That is the core of the platform: detect earlier, explain better, and act faster."
