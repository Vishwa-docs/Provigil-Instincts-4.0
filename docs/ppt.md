# ProVigil PPT Structure

## Goal

Use a short 6-7 slide deck that matches the 3–4 minute presentation and keeps the story simple: problem, solution, proof, and impact.

## Slide 1: Title

Title:

`ProVigil Instincts 4.0: Predictive Maintenance for Smart Meter Fleets`

Show:

- Team name
- One-line tagline: `Localized intelligence for smart meter health, diagnostics, and maintenance action`
- Hero screenshot of the dashboard
- Live URL: https://provigilinstincts.click

What to say:

"We built ProVigil Instincts 4.0 to help utilities detect meter failures earlier and act before they become outages, safety risks, or revenue loss."

## Slide 2: Problem Statement

Title:

`Why This Problem Matters`

Show:

- 3-4 short bullets
- Reactive maintenance
- Communication loss and meter failure
- Loose terminal or overheating risk
- Revenue leakage and avoidable truck rolls

What to say:

"Utilities already have telemetry, but most workflows still act after failure. That creates safety risk, service disruption, and operational inefficiency."

## Slide 3: Our Solution

Title:

`What ProVigil Does`

Show:

- Simple flow diagram:
  `Meter telemetry -> Localized scoring -> Network intelligence -> Digital twin diagnosis -> Alerts -> Work orders -> Field app`
- 8 innovation tags:
  `Localized model`
  `Network intelligence`
  `Digital twin`
  `VLM field validation`
  `AI work orders`
  `VOC gas sensing`
  `Edge ML`
  `GIS clustering`

What to say:

"We turn raw smart-meter telemetry into a full maintenance workflow, from anomaly detection to actionable field response. Our platform includes 17 detection rules calibrated to Indian CEA/IEC standards, including a VOC gas sensor for arcing detection."

## Slide 4: Dashboard and Fleet Visibility

Title:

`Fleet Command View`

Show:

- Screenshot of **HowItWorks landing page** (`/`) — 8 innovation cards, detection methods table, problem-solution mapping
- Screenshot of **Dashboard** (`/dashboard`) — fleet health cards, anomaly trend, fault scenario trigger
- Screenshot of meter fleet
- Small callouts for:
  `Fleet health`
  `Risk ranking`
  `Anomaly trend`
  `Recent alerts`
  `VOC gas sensing`

What to say:

"Visitors land on our How It Works page, which showcases all 8 innovations including VOC gas sensing hardware. The operator dashboard gives fleet-level visibility — which meters need attention first. The fault scenario trigger lets judges see the detection pipeline in action with one click."

## Slide 5: Network Intelligence and Digital Twin

Title:

`Localized Diagnosis`

Show:

- Screenshot of network map
- Screenshot of digital twin
- Labels:
  `Feeder and transformer context`
  `Neighbor consensus`
  `Component-level health`

What to say:

"This is where the platform becomes more than a dashboard. We localize issues in the network and then expose the subsystem most likely causing failure."

## Slide 6: Alerts, Work Orders, and Mobile App

Title:

`From Detection to Action`

Show:

- Screenshot of alerts page
- Screenshot of work orders page
- Small mobile app note:
  `Android APK available for field use`
  `Field video inspection with Cosmos Reason 2`
  `Loose connection detection flow`
- Hardware innovation:
  `VOC gas sensor (SGP40/BME680) — $1 MOX sensor for off-gas/arcing detection`
  `ESP32 edge firmware — on-device anomaly scoring`

What to say:

"The system closes the loop by generating actionable alerts and maintenance work orders. We also built a mobile app where a field engineer captures a meter image and the VLM pipeline flags physical defects like loose connections."

Note:

- APK path: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- Best demo moment: record a hanging wire, stop, wait for the processing screen, then show the result and optional voice output.

## Slide 7: Impact and Closing

Title:

`Why ProVigil Matters`

Show:

- Earlier fault detection
- Better explainability
- Fewer blind truck rolls
- Faster maintenance prioritization
- Clear path to live DISCOM deployment

What to say:

"ProVigil helps utilities shift from reactive replacement to predictive, localized, explainable maintenance. That is the value of the platform."

## PPT design tips

- Keep the deck visually clean and short
- Use screenshots from the live product, not too much text
- Limit each slide to one idea
- Use the same words in the deck and in the live demo
- If time is tight, present Slides 1, 2, 3, then jump into the live demo, and end on Slide 7
