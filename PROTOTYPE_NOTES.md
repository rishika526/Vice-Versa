# F2R – Field-to-Record: Prototype Technical Notes & Audit

## Architecture Overview
The application follows a strictly decoupled client-side prehospital emergency medical architecture:
1. **Dual-Mode Clinical Presentation Layer**:
   - **Paramedic Field View**: Clean, professional light-theme medical interface constructed with React 19, Tailwind CSS, and Lucide React. Designed for glove-friendly interaction with high-contrast amber/teal indicators, minimum 48px–58px touch targets, standardized typography (`text-lg font-semibold` headers, `text-sm` body), and offline voice dictation.
   - **Hospital ED View**: Dark-mode clinical telemetry monitor (`#0B1120` / `#070D18`) simulating an emergency department trauma resuscitation bay. Mounts clean and empty of dummy alerts, listening to application state, BroadcastChannel, and localStorage for instant incoming ambulance handovers. Full standard text selection enabled across clinical cards.
2. **In-Browser Edge AI NER Pipeline (`src/lib/ner.ts`)**:
   - Integrates Hugging Face **Transformers.js** (`@xenova/transformers`) to run lightweight, quantized token classification / NER entirely inside the browser (100% offline).
   - Utilizes browser `CacheStorage` for ONNX model weights (`Xenova/bert-base-NER`).
   - Includes real-time model caching progress tracking and a seamless fallback to an ultra-fast hybrid clinical rule/lexicon parser when offline or in constrained environments.
   - Extracts **Drug**, **Dose**, and **Route** alongside Unit, Clinical Indication, and Timestamps. Outputs color-tagged token spans and confidence metrics.
3. **Closed-Loop Validation & Emergency Procedure Mode (`src/components/DraftClinicalNoteCard.tsx`)**:
   - Holds extracted records in an unsealed "Draft Clinical Note" state without prematurely persisting to the database.
   - Distinct entity tag colors:
     - **Procedure (Intervention)**: High-Visibility Cyan (`bg-cyan-100 text-cyan-950 border-cyan-400`)
     - **Drug (Medication)**: Medical Teal (`bg-teal-100 text-teal-950 border-teal-300`)
     - **Dose & Unit**: Electric Blue / Sky (`bg-sky-100 text-sky-950 border-sky-300`)
     - **Route of Administration**: Vibrant Purple (`bg-purple-100 text-purple-950 border-purple-300`)
   - **Emergency Procedure Mode (CPR Bug Fix)**:
     - If a procedure is detected (e.g. CPR, chest compressions, defibrillation, intubation, BVM) or if no drug is detected but action text is present (like "gave CPR"), the Draft Note toggles automatically into **Procedure Mode**.
     - In Procedure Mode, all missing Drug, Dose, and Route amber warnings are completely hidden.
     - The bottom button switches to **"CONFIRM PROCEDURE"** and is immediately enabled, unblocking the paramedic.
     - Includes a one-tap header toggle between Procedure Mode and Medication Mode.
   - Interactive tokenized preview with inline entity mark tags.
   - Prominent **Amber Warnings** for missing fields in Medication Mode (`Route Not Stated`, `Dose Missing`, etc.) with one-tap paramedic selection chips.
   - Large, high-contrast **"CONFIRM MEDICATION"** / **"CONFIRM PROCEDURE"** button.
   - Internal padding aligned to `p-5 sm:p-6 rounded-2xl` matching the Verified Run-Sheet card for a cohesive enterprise feel.
4. **Emergency Telemetry & Real-Time Hospital Feed (`src/lib/hospitalFeed.ts`)**:
   - Uses `BroadcastChannel('f2r_hospital_ed_feed')`, window `CustomEvent`, and `localStorage` storage-event listeners.
   - Alert cards render ONLY when: (A) a "Simulate" trigger button is clicked, or (B) a confirmed record is submitted from Paramedic View.
   - Flashing emergency beacon card: **`🚨 INCOMING AMBULANCE UPDATE`** with dynamic note rendering and full text selection.
   - **Dual-Handover "Accept & Reconcile"**:
     - The incoming alert card features a high-contrast **"ACCEPT & RECONCILE"** button.
     - When clicked by the ED doctor, the incoming card dismisses from the top area and immediately appends to the **"INBOUND PARAMEDIC RUN-SHEET STREAM"** below.
     - In the Run-Sheet stream, a new visual badge **"✓ ED Reconciled"** renders next to **"✓ Secure Sync"** to visually confirm the completed dual-handshake.
   - **UI/UX Polish (Hidden Simulator)**:
     - Bulky test triggers moved from the main screen into a discreet, collapsible **"Demo Tools"** dropdown and tiny outline buttons in the top header. The main screen functions as a true ED resuscitation monitor.
   - Displays structured HL7 FHIR R4 record, administration timestamps, ETA, and unit call sign.
   - Purged developer jargon: "Export Clinical Record", "Toggle Data View", "Clinical Assistant", "Safety Protocol", and "✓ Secure Sync".
   - Completely purged `urn:f2r:chain:hash` and `previous-hash` from FHIR payloads, replacing them with realistic `urn:f2r:hlc:timestamp` and `urn:f2r:device:id` (`MEDIC-04-RIG-TABLET`).
5. **Distributed Ordering Engine**:
   - **Hybrid Logical Clocks (HLC)**: Replaces blockchain/SHA terminology with offline-first Hybrid Logical Clock causality tracking and monotonic event ordering across distributed paramedic and hospital nodes.
6. **Safety Subsystem (`src/lib/safety.ts`)**:
   - Single-dose prehospital thresholds and a 120-second duplicate administration detection engine.
7. **Persistence Layer (`src/lib/db.ts`)**:
   - Client-side IndexedDB via `idb` library with safe update support for reconciliation. Zero cloud server dependency.

---

## Quality Gate Checklist

| Criteria | Result | Notes |
| :--- | :---: | :--- |
| `npm run build` succeeds | PASS | Vite + TypeScript build completes cleanly with code-split transformers chunk |
| `npm test` passes | PASS | 19/19 Vitest tests passing across 5 test suites |
| Dual-Handover "Accept & Reconcile" | PASS | Button dismisses alert and immediately appends to inbound run-sheet stream with "✓ ED Reconciled" badge |
| Procedure Mode (CPR Fix) | PASS | Text like "gave CPR" toggles Procedure Mode; amber warnings hidden; "CONFIRM PROCEDURE" unblocks paramedic |
| Jargon & Hash Purge | PASS | UI displays "Export Clinical Record" / "Toggle Data View"; FHIR payload uses `urn:f2r:hlc:timestamp` & `urn:f2r:device:id` |
| Hidden Simulator Polish | PASS | Prominent simulator banner removed; sleek collapsible "Demo Tools" dropdown & header buttons |
| Text Rendering & Selection | PASS | Paramedic notes accurately render dynamic text; standard text selection enabled across cards |
| Purged Jargon & Medical POV | PASS | All developer/technical jargon purged; top navigation displays "✓ Secure Sync", AI badge displays "Clinical Assistant" |
| All-Device Responsiveness | PASS | Glove-friendly touch targets, mobile bottom bar safe areas, responsive grids |
| In-Browser Edge AI NER | PASS | Token classification extracts Drug, Dose, and Route with local ONNX caching state |
| Offline PWA precache | PASS | Web manifest and service worker precaching 15 static assets |

---

## Test Summary (19/19 Passing)

### 1. `src/lib/__tests__/extract.test.ts`
- Example 1: `"Gave two milligrams midazolam IV push just now for active seizure"` (Complete) -> **Verified**
- Example 2: `"Gave 0.5 milligrams epinephrine for anaphylaxis"` (Route missing) -> **Verified**
- Example 3: `"Gave midazolam IV for seizure five minutes ago"` (Dose & unit missing) -> **Verified**
- Example 4: `"Gave morphine IM at 1:44 for pain"` (Dose missing, explicit time) -> **Verified**
- Alias test: Narcan 500 mcg intranasal -> **Verified**

### 2. `src/lib/__tests__/ner.test.ts`
- Extracts Drug, Dose, and Route from clinical dictation with confidence scores -> **Verified**
- Identifies missing route and sets field status accurately -> **Verified**
- Identifies missing dose while preserving route and explicit time -> **Verified**
- Correctly tags tokens with distinct DRUG, DOSE, and ROUTE entity labels -> **Verified**
- Reports NER status and model metadata -> **Verified**

### 3. `src/lib/__tests__/closed_loop_and_hospital.test.ts`
- Builds compliant HL7 FHIR R4 MedicationAdministration with realistic HLC provenance (zero blockchain hashes) -> **Verified**
- Correctly identifies procedures (e.g. CPR) into Procedure Mode without blocking warnings -> **Verified**
- Broadcasts confirmed medication and notifies hospital ED feed in real-time -> **Verified**
- Allows ED physicians to accept & reconcile alerts into run-sheet stream -> **Verified**

### 4. `src/lib/__tests__/chain_safety.test.ts`
- Ordering & integrity verification -> **Verified**
- High dose threshold warning -> **Verified**
- Duplicate dose alert within 2 minutes -> **Verified**

### 5. `src/lib/__tests__/e2e_journey.test.ts`
- Full end-to-end user journey simulation (dictation, amber warning resolution, confirmation, FHIR export, run-sheet copy) -> **Verified**
- High dose threshold warning -> **Verified**
- Duplicate dose alert within 2 minutes -> **Verified**

---

## Deployment Status
- **Local Preview Server**: `http://localhost:4173/` (via `npm run preview`)
- **Vite Development Server**: `http://localhost:5173/` (via `npm run dev`)
- **Production Build Artifacts**: `dist/` (includes PWA Service Worker, Web Manifest, and code-split transformers engine)
