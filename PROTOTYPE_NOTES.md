# F2R – Field-to-Record: Prototype Technical Notes & Audit

## Architecture Overview
The application follows a strictly decoupled client-side prehospital architecture:
1. **Presentation Layer**: Light-theme medical interface constructed with React 19, Tailwind CSS, and Lucide React. Designed for glove-friendly interaction with high-contrast amber/teal indicators and minimum 48px touch targets.
2. **Extraction Engine (`src/lib/extract.ts`)**: Plain TypeScript rule-based natural language parser that operates entirely without external API calls. Features regex tokens, phonetic word-to-number normalizers, time delta calculations, and clinical lexicon matching.
3. **Safety Subsystem (`src/lib/safety.ts`)**: Look-up thresholds for sane maximum single-dose prehospital administrations and a 120-second duplicate check.
4. **Cryptographic Ledger (`src/lib/chain.ts`)**: Web Crypto API `crypto.subtle.digest('SHA-256')` generates a tamper-evident blockchain-style hash chain linking each record back to genesis.
5. **Persistence Layer (`src/lib/db.ts`)**: IndexedDB via `idb` library. Data is kept locally on the device with zero network synchronization calls.
6. **Interoperability (`src/lib/fhir.ts`)**: In-memory builder for HL7 FHIR R4 `MedicationAdministration` JSON bundles.

## Quality Gate Checklist

| Criteria | Result | Notes |
| :--- | :---: | :--- |
| `npm run build` succeeds | PASS | Output bundle created in `dist/` with zero TS errors |
| `npm test` passes | PASS | 10/10 Vitest tests passing across 3 test suites |
| Missing-data flow | PASS | Unstated fields trigger amber cards with one-tap choice chips |
| Seal record disabled | PASS | Disabled until all required fields confirmed + safety acknowledged |
| Cryptographic verification | PASS | `verifyChain` validates all record hashes & backlinks |
| Offline PWA precache | PASS | Manifest and service worker precaching 14 static assets |
| Light theme compliance | PASS | Strictly `#F7FAFC` and white backgrounds, no dark mode |

## Test Summary
- `src/lib/__tests__/extract.test.ts`:
  - Example 1: `"Gave two milligrams midazolam IV push just now for active seizure"` (Complete) -> Verified
  - Example 2: `"Gave 0.5 milligrams epinephrine for anaphylaxis"` (Route missing) -> Verified
  - Example 3: `"Gave midazolam IV for seizure five minutes ago"` (Dose & unit missing) -> Verified
  - Example 4: `"Gave morphine IM at 1:44 for pain"` (Dose missing, explicit time) -> Verified
  - Alias test: Narcan 500 mcg intranasal -> Verified
- `src/lib/__tests__/chain_safety.test.ts`:
  - Genesis block creation & backlink validation -> Verified
  - Chain tampering detection -> Verified
  - High dose threshold warning -> Verified
  - Duplicate dose alert within 2 minutes -> Verified
- `src/lib/__tests__/e2e_journey.test.ts`:
  - Full end-to-end user journey simulation -> Verified

## Deployment Status
- **Temporary Live HTTPS URL**: `https://petite-lies-warn.loca.lt`
- **Local Preview Server**: `http://localhost:4173/`
- **Render / Cloudflare / Netlify / Vercel**: Ready for production deployment using `dist/`.
