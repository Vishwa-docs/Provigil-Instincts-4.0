# Pro-Vigil 3-4 Minute Demo Script

## Demo goal

Present Pro-Vigil as a predictive maintenance platform for smart meter fleets that helps DISCOMs move from reactive replacement to localized, explainable, action-oriented maintenance.

Keep the full pitch within 3-4 minutes.

## Quick structure

1. Intro and problem statement: 30-40 seconds
2. Solution and live product walkthrough: 2.5-3 minutes
3. Conclusion: 20-30 seconds

## Intro and problem statement

Say:

"Pro-Vigil is a predictive maintenance platform for smart meter fleets. Today, utilities usually respond after a meter fails, overheats, loses communication, or creates billing blind spots."

"That leads to outage risk, fire risk from loose terminals, extra truck rolls, and revenue loss. Our idea is simple: instead of reacting after failure, we continuously score meter health, localize the issue in feeder context, and convert that into clear maintenance action."

## Solution overview

Say:

"Our solution combines five things: localized model intelligence, network intelligence, component-level digital twin diagnostics, AI-assisted alert summarization and work orders, and a field mobile workflow with VLM-based visual validation."

"Let me show the operator flow from fleet visibility to maintenance action."

## Live walkthrough

### 1. Dashboard

Open the dashboard.

Say:

"This is the fleet command view. We can immediately see fleet health, meters at risk, anomaly trend, recent alerts, and the innovation blocks that define the platform."

"The key point is that we are not only raising alarms. We are organizing maintenance decisions."

Point out:

- Fleet health cards
- Health distribution
- Anomaly trend
- Recent alerts
- Innovation cards

### 2. Meter Fleet

Open the meter fleet page.

Say:

"Here the utility team gets the ranked list of meters, with health score, current status, and suspected issue. This helps them focus immediately on the riskiest assets first."

### 3. Network Intelligence

Open the network map page.

Say:

"This is one of our strongest innovations. A meter is not analyzed in isolation. It is interpreted in transformer and feeder context."

"That means we can use neighbor consensus. If only one meter degrades, it is likely a local hardware issue. If several nearby meters degrade together, the issue may be upstream in the network."

Point out:

- Feeders
- Transformers
- Meter links
- Critical meter queue

### 4. Meter Detail and Digital Twin

Open a warning or critical meter such as `MTR-008`, then open its digital twin.

Say:

"For each meter, we expose the telemetry trail, health forecast, remaining life estimate, and the suspected root cause. Then the digital twin breaks the asset into terminals, relay, battery, power supply, display, and communication module."

"So instead of only saying a meter is risky, we show what subsystem the engineer should inspect first."

Point out:

- Forecast and remaining life
- Weakest component
- Component details and risk factors

### 5. Alerts and Work Orders

Open alerts, then work orders.

Say:

"Once the risk is detected, the system turns it into action. Alerts are enriched with AI summaries, and then converted into maintenance work orders with issue type and urgency."

"So the platform closes the loop from detection to execution."

## How to mention the mobile app

Say:

"We also have a mobile field inspection demo. The APK opens directly into the field vision flow, where an engineer records a short inspection clip and the app simulates visual reasoning on the video."

"For this demo, I record a loose or hanging wire, stop the recording, show the processing screen, and the app returns: 'There seem to be a loose connection' followed by 'Detected by Cosmos Reason 2.' It also supports voice playback for the finding."

"The demo APK is available at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`."

## Innovations to emphasize

Say these clearly:

1. "The model is localized, so each meter is interpreted in its feeder and transformer neighborhood."
2. "Network intelligence helps separate local meter faults from upstream grid issues."
3. "The digital twin gives subsystem-level explainability instead of one black-box score."
4. "The VLM workflow extends predictive maintenance into field inspection."
5. "AI summaries and work orders turn raw telemetry into action."

## Conclusion

Say:

"So Pro-Vigil helps a DISCOM move from reactive meter replacement to localized predictive maintenance. The value is earlier fault detection, clearer diagnosis, faster field action, and a full path from anomaly to work order."

"That is the core of our POC: detect earlier, explain better, and act faster."
