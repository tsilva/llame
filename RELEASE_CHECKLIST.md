# Release Checklist

## Automated gates

- `npm run lint`
- `npm test`
- `npm run test:e2e`
- `npm run build`
- `npm run smoke`

## Manual browser/device matrix

- Chrome latest on desktop: WebGPU path, model load, send, stop, image attach, reload persistence.
- Edge latest on desktop: WebGPU path, model switch, fallback banner handling.
- Safari latest on macOS: WASM fallback, basic chat, settings, persistence, layout.
- Mobile Safari: layout, sidebar, settings, persistence, non-WebGPU messaging.
- Mobile Chrome: layout, sidebar, settings, persistence, non-WebGPU messaging.

## Deployment checks

- `NEXT_PUBLIC_SENTRY_DSN` is set for production if error reporting is desired.
- `NEXT_PUBLIC_SENTRY_ENABLED=true` is set only when you intentionally want Sentry enabled outside production.
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` is set only if you need to override the default production tracing sample rate.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are present in CI/CD or `.env.sentry-build-plugin` if source map upload is desired.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set only if analytics should be enabled.
- `vercel.json` contains COOP/COEP, CSP, referrer, content-type, and permissions headers.
- The live deployment serves the static export and preserves `SharedArrayBuffer` support.

## Production support rules

- Curated presets are the only supported production models.
- Community search results remain experimental and should not be treated as support commitments.
- Prompt text, raw model output, and image payloads must not be sent to telemetry providers.
