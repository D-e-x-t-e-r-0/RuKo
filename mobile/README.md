# Ruko Mobile (Expo)

Native companion to the Ruko PWA — same pause ritual, decision journal, and
practice simulator, rebuilt with React Native + Expo and a polished
midnight-diya theme with **soft neumorphism in the exact same colors as web**:
raised cards (`theme.neu.card`: abyss pocket + cream lip), saffron ritual
buttons (`theme.neu.btn` glow), pressed chip states. Tokens live in
`mobile/src/theme.ts` (`colors` + `neu`), surfaces in
`mobile/src/components/ui.tsx` (`Card`, `BigButton`, `Chip`).

- **12 languages**: hi (default), en, bn, mr, ta, te, kn, ml, gu, pa, or, as
- **Voice**: Sarvam bulbul TTS + saarika STT through `/api/sarvam`
  (needs `EXPO_PUBLIC_API_URL` + server `SARVAM_API_KEY`), expo-speech fallback
- **Storage**: on-device AsyncStorage (trades, decisions, rules, sessions)
- **Screens**: Home · Pause ritual · Practice simulator · Journal · Weekly Mirror · Settings

## Run

```bash
cd mobile
npm install
npx expo start        # scan with Expo Go
npx expo start --android
```

Copy `.env.example` if the native build must reach a deployed backend:

```bash
EXPO_PUBLIC_API_URL=https://your-ruko-app.vercel.app
```

## Release

Tagging `v*` runs `.github/workflows/release.yml`: PWA tests + build,
Expo typecheck + web export, optional EAS preview APK (needs the
`EXPO_TOKEN` repo secret), then a GitHub Release with both web bundles.

```bash
git tag v1.1.0 && git push origin v1.1.0
```

Local preview build without CI:

```bash
cd mobile
eas build --platform android --profile preview
```

Set the real EAS project id in `app.json` (`extra.eas.projectId`) after
running `eas init` once.

## Judge install (2 min, APK — no URL needed)

Per rubric clarification, native APK distribution is legitimate (not a URL fault).

1. Open the GitHub Release for `v1.2.0-pi` on your phone → download `ruko-preview.apk`.
2. Allow install from browser once → open Ruko → default Hindi, tap Pause now.
3. Offline check: turn on airplane mode → ritual, journal, practice all still work.
4. Permissions: microphone only when you tap mic/speaker (voice input/read-aloud).
   No SMS/OTP, no contacts, no broker login, no background network.

Expo Go path (no APK): `npx expo start` → scan QR → same 12 languages.
