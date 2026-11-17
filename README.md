# F2R – Field-to-Record (Emergency Medical Web App)
> **Speak once. Get a safe, timestamped record.**
> An offline-first emergency medical Progressive Web App (PWA) designed for prehospital first responders, paramedics, and emergency department (ED) resuscitation teams to convert spoken or typed on-scene clinical notes into structured, validated HL7 FHIR medication records.

[![Vitest](https://img.shields.io/badge/tests-19%2F19%20passing-teal)](https://github.com/rishika526/Vice-Versa)
[![PWA](https://img.shields.io/badge/PWA-offline--ready-emerald)](https://github.com/rishika526/Vice-Versa)
[![Assistant](https://img.shields.io/badge/Assistant-Clinical%20Assistant-blueviolet)](https://github.com/rishika526/Vice-Versa)
[![Dual--Handshake](https://img.shields.io/badge/handover-Accept%20%26%20Reconcile-teal)](https://github.com/rishika526/Vice-Versa)
[![Sync](https://img.shields.io/badge/sync-%E2%9C%93%20Secure%20Sync-blue)](https://github.com/rishika526/Vice-Versa)
[![FHIR](https://img.shields.io/badge/FHIR-R4%20Compliant-red)](https://github.com/rishika526/Vice-Versa)

---

## 1. Core Architectural Overview

F2R features a dual-mode prehospital emergency medical architecture engineered for buttery smooth responsiveness, glove-friendly usability, and 100% offline autonomy using **Hybrid Logical Clocks (HLC)** for event ordering:

```
[On-Scene Paramedic (Voice/Typed)]
                │
                ▼
  [In-Browser Edge AI (NER) Pipeline]
  (Xenova Transformers.js ONNX Quantized + Offline Clinical Fallback)
                │
                ▼
  [Closed-Loop Validation UI ("Draft Clinical Note")]
  - Entity Tag Colors: Drug (Teal), Dose (Sky Blue), Route (Purple)
  - Amber Warnings for Missing Entities
  - High-Contrast "CONFIRM MEDICATION" Button
                │  (Upon Active Paramedic Confirmation)
                ├─────────────────────────────────────────┐
                ▼                                         ▼
   [Verified Run-Sheet Timeline]             [Real-Time ED Telemetry Link]
   - Hybrid Logical Clock (HLC) Ordering     (BroadcastChannel / Storage Events)
   - HL7 FHIR R4 Generation                              │
   - IndexedDB Offline Store                             ▼
                                           [ED Hospital Clinical Monitor]
                                           - Dark-Mode Clinical Monitor (#0B1120)
                                           - Mounts Clean (Zero Default Dummy Alerts)
                                           - Flashing "INCOMING AMBULANCE UPDATE"
                                           - Standard Text Selection Enabled
```

---

## 2. Key Features

### 1. In-Browser Edge AI (NER) Pipeline
- **100% Offline Token Classification**: Powered by Xenova's `@xenova/transformers`, executing quantized ONNX token classification models directly in the browser via WebAssembly and CacheStorage.
- **Entity Extraction**: Automatically parses unstructured on-scene text or voice dictations to extract **Drug**, **Dose**, and **Route** alongside Unit, Clinical Indication, and Timestamps.
- **Local Model Caching with Loading State**: Displays a real-time progress bar while the quantized model downloads and caches into the browser's CacheStorage API.
- **Hybrid Edge Clinical Engine (Zero-Latency Fallback)**: If offline, constrained, or before model cache completes, seamlessly falls back to a high-precision clinical rule/regex parser with confidence scoring and sub-10ms latency.
- **Token Spans & Highlighting**: Tokenizes and labels raw text segments with confidence percentages and visual entity tags.

### 2. Closed-Loop Validation UI & Procedure Mode (CPR Fix)
- **Draft Clinical Note Holding Pattern**: Extracted clinical entities are **never** committed or saved immediately. They are held in a prominent "Draft Clinical Note" card awaiting active human verification.
- **Distinct Entity Tag Colors**:
  - **Procedure (Intervention)**: High-Visibility Cyan (`bg-cyan-100 text-cyan-950 border-cyan-400`)
  - **Drug (Medication)**: Medical Teal (`bg-teal-100 text-teal-950 border-teal-300`)
  - **Dose & Unit**: Electric Blue / Sky (`bg-sky-100 text-sky-950 border-sky-300`)
  - **Route of Administration**: Vibrant Purple (`bg-purple-100 text-purple-950 border-purple-300`)
- **Emergency Procedure Mode (CPR Bug Fix)**:
  - If the NLP detects an intervention (e.g. CPR, chest compressions, defibrillation, intubation, BVM) or if no drug is detected but action text is present (like "gave CPR"), the Draft Note toggles automatically into **Procedure Mode**.
  - In Procedure Mode, all amber warnings demanding Drug, Dose, and Route are hidden.
  - The confirmation button dynamically switches to **"CONFIRM PROCEDURE"** and is immediately enabled, unblocking the paramedic.
  - Paramedics can also freely toggle between Procedure Mode and Medication Mode using the one-tap header switcher.
- **Interactive Inline Note Preview**: Highlights words in the original raw dictation corresponding to each extracted entity.
- **Amber Clinical Warnings (Medication Mode)**: If a critical entity is missing (e.g. `Route Not Stated` or `Dose Missing`), high-visibility amber warning alerts appear with one-tap choice chips.
- **High-Contrast Confirmation Button**:
  - Minimum 58px touch target engineered for paramedic gloves in bumpy ambulances.
  - Tapping **"CONFIRM MEDICATION"** / **"CONFIRM PROCEDURE"**:
    1. Generates compliant HL7 FHIR R4 `MedicationAdministration` or `Procedure` record.
    2. Tags event with realistic Hybrid Logical Clock (`urn:f2r:hlc:timestamp`) and device ID (`urn:f2r:device:id: MEDIC-04-RIG-TABLET`). Zero blockchain hashes.
    3. Persists to IndexedDB.
    4. Instantly dispatches a telemetry payload to the ED Hospital Dashboard.
    5. Moves the record into the 'Verified Run-sheet'.

### 3. ED Hospital Dashboard (Clinical Monitor) & Dual-Handover
- **Navigation Toggle Switch**: Seamlessly swap between **"Paramedic View"** (clean light clinical theme) and **"Hospital ED View"** (dark-mode clinical monitor) from the main header and sidebar. Top navigation displays **"✓ Secure Sync"**.
- **Dark-Mode Clinical Monitor Styling**: Deep dark background (`#0B1120` / `#070D18`), glowing telemetry grids, live digital UTC/local clock, channel indicators, and clinical telemetry cards.
- **Dual-Handover "Accept & Reconcile"**:
  - On the Incoming Ambulance Update card, the top action button is a high-visibility **"ACCEPT & RECONCILE"** button.
  - When the ED physician clicks "Accept & Reconcile", the card dismisses from the top area and immediately appends to the **"INBOUND PARAMEDIC RUN-SHEET STREAM"** below.
  - In the Run-Sheet list, a distinct badge **"✓ ED Reconciled"** appears next to **"✓ Secure Sync"**, proving the dual-handshake is completed.
- **UI/UX Polish (Hidden Simulator)**:
  - The bulky simulation test banner is moved out of the main monitoring screen into a discreet, collapsible **"Demo Tools"** dropdown in the top header and tiny outline triggers, making the monitor look like an authentic emergency department resuscitation terminal.
- **Text Selection & Dynamic Rendering**:
  - Original Paramedic Note dynamically renders the exact note submitted from Paramedic View.
  - Standard text selection is enabled across all clinical cards, notes, headers, and data inspectors.
- **Structured Data Inspector & Jargon Purge**:
  - Paramedic and hospital views use clean clinical phrasing: **"Export Clinical Record"** (replacing "Export FHIR-lite JSON") and **"Toggle Data View"** (replacing "Hide FHIR JSON").
  - FHIR payload identifiers strictly contain `urn:f2r:hlc:timestamp` and `urn:f2r:device:id` with zero blockchain hashes.

### 4. Consistent UI/UX & Responsive Design
- Standardized typography across Paramedic Capture, Draft Note, and Run-Sheet components (`text-lg font-semibold` headers, `text-sm` body).
- Aligned internal card padding (`p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm`) for a cohesive enterprise feel.
- Fully responsive across mobile, tablet, and desktop screens with bottom tab bar safe areas and touch-friendly targets.

---

## 3. Tech Stack & Dependencies

| Technology | Purpose |
| :--- | :--- |
| **React 19** (`^19.3.1`) | Reactive UI framework with client-side state synchronization |
| **TypeScript 6** (`~6.0.3`) | Strict type checking and verbatim module syntax |
| **Vite 8** (`^8.3.4`) | High-speed bundler with automatic dynamic code splitting |
| **@xenova/transformers** | In-browser Hugging Face ONNX quantized token classification / NER |
| **Tailwind CSS 3** (`^3.4.19`) | Medical color palette (teals, greens, whites, dark greys) & dark telemetry mode |
| **vite-plugin-pwa** (`^2.0.0`) | Service worker asset precaching & offline progressive web app |
| **idb** (`^8.0.4`) | IndexedDB promise-based local persistence (zero cloud backend needed) |
| **lucide-react** (`^1.61.0`) | Clinical and emergency iconography |
| **vitest** (`^5.0.5`) | Unit and end-to-end integration test runner (18/18 tests passing) |
| **Hybrid Logical Clocks** | Distributed monotonic event ordering across field and hospital nodes |
| **BroadcastChannel API** | Real-time cross-tab prehospital telemetry broadcast |

---

## 4. How to Install, Run, and Test

### Prerequisites
- Node.js `v18+` (v20+ recommended)
- npm `v9+`

### Installation
```bash
git clone https://github.com/rishika526/Vice-Versa.git
cd Vice-Versa
npm install
```

### Run Locally (Dev Server)
```bash
npm run dev
# Server starts at http://localhost:5173/
```

### Run Test Suite (Vitest)
```bash
npm test
# Executes all 18 unit, NER, and E2E integration tests
```

### Production Build & PWA Precache
```bash
npm run build
npm run preview -- --port 4173 --host
# Built bundle verified in dist/
```

---

## 5. Test Suite Verification (19/19 Passing)

```
✓ src/lib/__tests__/extract.test.ts (5 tests)
  ✓ Example 1 (Complete): Midazolam 2 mg IV push
  ✓ Example 2 (Missing route): Epinephrine 0.5 mg
  ✓ Example 3 (Missing dose): Midazolam IV relative time
  ✓ Example 4 (Explicit time): Morphine IM at 1:44
  ✓ Aliases: Narcan 500 mcg intranasal

✓ src/lib/__tests__/ner.test.ts (5 tests)
  ✓ Extracts Drug, Dose, and Route from clinical note
  ✓ Identifies missing route and sets field status accurately
  ✓ Identifies missing dose while preserving route and explicit time
  ✓ Correctly tags tokens with distinct DRUG, DOSE, and ROUTE entity labels
  ✓ Reports NER status and model metadata

✓ src/lib/__tests__/closed_loop_and_hospital.test.ts (4 tests)
  ✓ Builds compliant HL7 FHIR R4 MedicationAdministration with HLC provenance (No blockchain hashes)
  ✓ Correctly identifies procedures (e.g. CPR) into Procedure Mode without blocking warnings
  ✓ Broadcasts confirmed medication and notifies hospital ED feed
  ✓ Allows ED physicians to accept & reconcile alerts

✓ src/lib/__tests__/chain_safety.test.ts (4 tests)
  ✓ Timeline ordering validation
  ✓ Tamper detection
  ✓ High dose threshold warning
  ✓ Duplicate dose alert within 2 minutes

✓ src/lib/__tests__/e2e_journey.test.ts (1 test)
  ✓ Full end-to-end user journey simulation
```
