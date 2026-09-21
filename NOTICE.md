# NOTICE — attributions (all MIT)

This package unifies two previously separate DSH plugins and adopts ideas
from the public ecosystem. All referenced works are MIT-licensed; their
copyright notices are preserved below. Ported code keeps the original
headers in its source files.

## Ported code

- `src/circuit.ts` — ported from **dsh-model-failover**
  (https://github.com/Letter2025/dsh-model-failover),
  MIT License, Copyright (c) 2026 Letter2025.
  Additions here: `retryAfterMs` hold, `hasHealthyFallback`.
- `src/continue-core.ts`, `src/continue-engine.ts` — ported from
  **dsh-client-auto-continue** v0.11.5
  (https://github.com/HsiangNianian/dsh-auto-continue),
  MIT License, Copyright (c) 2025 HsiangNianian.
  Adaptations: RU/EN locales (was ZH/EN), live-tuned defaults, `continuable`
  seam for breaker-aware continuation, unified settings namespace.
- `src/client/FailoverContinueCard.tsx` (+ CSS) — ported from
  **dsh-model-failover-settings** `ModelFailoverCard`
  (local project, MIT), extended with the auto-continue section.

## Adopted ideas (independent implementations)

- **omdsh-dev/dsh-llm-fallbacks** (MIT) — open `triggerCodes` set,
  request-scoped `CONTEXT_WINDOW_EXCEEDED` switching without cooldown,
  `maxSwitchesPerStep` safety valve, "never write durable switch events",
  `{ kind: 'plugin' }` notices.
- **aosi526/dsh-workbuddy-xdpool** (MIT) — per-route cooldown display in the
  card, committed `lib/` build output, status-first UX.
- **dsh-external/dsh-session-health** (MIT) — read-only multi-frame zstd
  session validation (used in our QA step).
- **dsh-external/dsh-harness-ops** (`dsh-restart-recover`, MIT) — the
  `agent/created` post-restart continuation trigger idea.
- **weibaohui/dsh-continue** (evaluated as a dependency, rejected: too young,
  402-as-stop contradicts our failover policy) — ordered rule-table UX
  informed the card layout.
