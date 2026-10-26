# F2R – Field-to-Record (Hackathon Prototype)
> **Speak once. Get a safe, timestamped record.**
> An offline-first Progressive Web App (PWA) designed for prehospital first responders and paramedics to convert spoken or typed on-scene clinical notes into structured, cryptographically sealed medication records.

[![Vitest](https://img.shields.io/badge/tests-10%2F10%20passing-teal)](https://github.com/rishika526/Vice-Versa)
[![PWA](https://img.shields.io/badge/PWA-offline--ready-emerald)](https://github.com/rishika526/Vice-Versa)
[![SHA-256](https://img.shields.io/badge/audit%20chain-SHA--256%20intact-blue)](https://github.com/rishika526/Vice-Versa)
[![License](https://img.shields.io/badge/license-MIT-slate)](LICENSE)

---

## 1. Public Prototype Link

- **Live HTTPS Demo**: [https://6b1805eb2888e8.lhr.life](https://6b1805eb2888e8.lhr.life)  
  *(Public HTTPS URL with TLS termination; microphone & PWA service worker enabled)*
- **GitHub Repository**: [https://github.com/rishika526/Vice-Versa](https://github.com/rishika526/Vice-Versa)
- **Local Preview**: `http://localhost:4173/` (via `npm run preview`)
- **One-line Deploy to Netlify / Vercel**:
  ```bash
  # Deploy to Netlify
  npx -y netlify-cli deploy --dir=dist --prod

  # Deploy to Vercel
  npx -y vercel deploy --prod --yes

  # Deploy to Cloudflare Pages
  npx -y wrangler pages deploy dist --project-name=f2r-field-to-record
  ```

---

## 2. Tech Stack & Library Versions

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **React** | `^19.3.1` | Modern reactive UI runtime |
| **TypeScript** | `~6.0.3` | Strict type safety and verbatim module syntax |
| **Vite** | `^8.3.4` | Build tool and fast HMR bundler |
| **Tailwind CSS** | `^3.4.19` | Light-theme utility styling with medical teal palette |
| **vite-plugin-pwa** | `^2.0.0` | Precaching service worker, web manifest, offline PWA |
| **idb** | `^8.0.4` | IndexedDB promise wrapper for client-side storage |
| **lucide-react** | `^1.61.0` | Accessible clinical iconography |
| **vitest** | `^5.0.5` | Unit and end-to-end integration test runner |
| **Web Crypto API** | Built-in | `crypto.subtle` SHA-256 tamper-evident hash chaining |
| **Web Speech API** | Built-in | On-device voice dictation with typed fallback |

---

## 3. Working Features

1. **Two-Tab Architecture (Capture & Run-sheet)**:
   - Zero login, zero backend, pure client-side execution.
   - Glove-friendly mobile bottom tab bar (<768px) and desktop left sidebar (≥768px).
2. **Tab 1: Capture Flow**:
   - **Glove-friendly Mic Button**: 84px touch target with active pulse animation ring.
   - **Browser Voice Input**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) with graceful error handling and automatic fallback.
   - **Typed Input Fallback**: Real-time editable textbox with "Process note" action.
   - **One-Tap Demo Chips**:
     - *"Gave two milligrams midazolam IV push just now for active seizure"* (Complete)
     - *"Gave 0.5 milligrams epinephrine for anaphylaxis"* (Route missing)
     - *"Gave midazolam IV for seizure five minutes ago"* (Dose & unit missing)
     - *"Gave morphine IM at 1:44 for pain"* (Dose missing, explicit time parsed)
   - **Local Rule-Based Extractor (`/src/lib/extract.ts`)**:
     - Extracts Drug, Dose, Unit, Route, Clinical Indication/Reason, and Timestamps.
     - Spoken word normalization (e.g. "two milligrams" $\to$ `2 mg`, "point five" $\to$ `0.5`).
     - Time normalization ("just now", relative "N minutes ago", explicit "at 1:44").
     - Records both `administeredAt` and `capturedAt` ISO timestamps.
   - **Missing-Data Flow (Core Paramedic Protocol)**:
     - Amber highlight with `"Not stated"` badge for missing fields.
     - Active confirmation prompt: One-tap chips for Route (IV push, IV, IM, IO, etc.), Reason (seizure, anaphylaxis, etc.), and numeric dose + unit chips (`mg`, `mcg`, `ml`, `g`).
     - Strict lock: "Seal record" remains disabled until every required field is confirmed.
   - **Clinical Safety Engine (`/src/lib/safety.ts`)**:
     - Look-up table checking doses against prehospital sane single-dose thresholds.
     - Duplicate detection: Flags identical drug/dose within 120 seconds.
     - Mandatory acknowledgement banner before sealing.
   - **Cryptographic Hash Sealing (`/src/lib/chain.ts`)**:
     - SHA-256 block hash calculated using `crypto.subtle`.
     - Links to `previousHash` (genesis block: 64 zeroes), creating a tamper-evident audit ledger.
3. **Tab 2: Run-sheet**:
   - Reverse chronological timeline of sealed medication records.
   - Displays administered time (HH:MM), medication details, route badge, clinical reason, raw quote, block hash, and green `"Verified ✓"` seal.
   - **Verify Chain**: Recalculates the entire SHA-256 chain from genesis to head and outputs a clear pass/fail confirmation.
   - **Export FHIR-lite JSON**: Generates and downloads standard HL7 FHIR R4 `MedicationAdministration` bundle.
   - **Copy Run-sheet**: Copies formatted textual handover report to clipboard with confirmation toast.
   - **Reset Run-sheet**: Allows clearing records with a confirmation dialog for testing new calls.
4. **PWA & Offline Capability**:
   - Header indicator pill: `"Offline-ready"` (green) when connected, `"Offline mode"` (amber) when disconnected.
   - Service worker precaches all application assets, fonts, and HTML.

---

## 4. Partial, Mocked, or Browser-Dependent Features

- **Web Speech API**: In Chromium and Safari, the browser's speech recognition engine may depend on cloud assistance unless offline language packs are installed on the OS. If offline or blocked, F2R catches the event immediately, displays a friendly message (`"Voice isn't available right now, type your note instead"`), and allows typed input without interrupting the workflow.
- **Microphone Permissions in Non-HTTPS**: Browsers strictly require HTTPS (or localhost) to grant microphone access. When deploying, use HTTPS.
- **HL7 FHIR Export**: Generates local FHIR R4 `MedicationAdministration` JSON bundles compliant with HL7 structure. Push to hospital EHR REST endpoints is intentionally out of scope for this offline prototype.

---

## 5. Known Limitations

- **Speech Recognition Dialects**: Native Web Speech API accuracy varies with loud siren noise or heavy accents.
- **Single Incident Scope**: The prototype stores the active patient encounter in local IndexedDB. A full production version will feature multi-incident triage archiving.

---

## 6. How to Install, Run, Build, and Test

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
# Opens at http://localhost:5173/
```

### Run Full Test Suite (Vitest)
```bash
npm test
# Executes 10 unit and E2E journey tests
```

### Production Build & PWA Precache
```bash
npm run build
npm run preview -- --port 4173 --host
```

### Testing Offline Mode
1. Open Chrome DevTools (`F12` $\to$ **Application** $\to$ **Service Workers**).
2. Check **Offline** in the Network tab or DevTools.
3. Reload the page: Notice the header status pill shifts to `"Offline mode"`, all assets load instantly from cache, and medication sealing and cryptographic verification continue to operate with 100% functionality.

---

## 7. Roadmap (Next-Gen Production Architecture)

| Phase | Milestone | Technology | Impact |
| :--- | :--- | :--- | :--- |
| **Q1** | **On-Device Offline ASR** | `Whisper.cpp` (WebAssembly / WebGPU) | Eliminates any browser speech API dependency; 100% on-device speech-to-text without network. |
| **Q1** | **Voice Activity Detection** | `Silero VAD` | Low-latency voice activation that filters out ambient sirens, engine noise, and bystanders. |
| **Q2** | **Clinical NER & Tokenization** | `ClinicalBERT` / On-device ONNX | Robust clinical entity recognition for complex compound medical phrases. |
| **Q2** | **Terminology Linking** | RxNorm & SNOMED CT | Automatic ontological coding of prehospital drugs, contraindications, and routes. |
| **Q3** | **Hardware Key Signing** | WebAuthn / ECDSA (P-256) | Legally binding digital signatures signed via hardware security keys / Biometric TouchID. |
| **Q3** | **P2P Crew Mesh Sync** | WebRTC / CRDTs (Yjs) | Real-time peer-to-peer sync between primary paramedic, driver, and triage nurse without internet. |
| **Q4** | **Multilingual Voice Support** | Multilingual Whisper (Hindi, Telugu, Spanish) | Full prehospital translation and transcription for regional healthcare squads. |

---

## 8. Git Repository & Push Instructions

To push this codebase to a fresh GitHub repository:

```bash
# Add all files and make the commit
git add .
git commit -m "feat: F2R offline voice-to-record prototype"

# Push to your GitHub repository
git branch -M main
git remote add origin https://github.com/rishika526/Vice-Versa.git
git push -u origin main
```
