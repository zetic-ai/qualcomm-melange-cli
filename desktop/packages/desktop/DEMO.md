# Demo builds

## QIYL: review an app plan before building

Build the Snapdragon Windows installer from an Apple Silicon Mac:

```sh
OPENCODE_CHANNEL=prod VITE_QIYL_DEMO=1 bun run dist:win
```

This mode needs no bundled credentials. Sign into Melange and configure the
planning assistant before rehearsal. The renderer hides the assistant's provider,
agent, and configured-model controls; the models recommended for the generated app
remain visible. Configure the assistant through the backstage setup flow before
using the event UI; an unconfigured event profile shows a neutral setup notice.

On Windows, run `"Melange Agent.exe" --qiyl-setup` to show the existing provider
connection UI backstage. Connect the planning assistant using the existing OpenAI
account and select its runtime model. Then run `"Melange Agent.exe" --qiyl-demo`
to return to the presentation interface. These switches reload only the renderer;
the running app and backend stay in place, and backend planning-only restrictions
remain active in both modes. The setup screen must be closed before presenting.

Start with: `집에 있는 가전제품을 보다 편리하게 관리할 수 있는 앱을 만들어줘.`
The assistant proposes features, asks for confirmation, recommends an available
LFM3 or D1 model from Melange, waits for the user's choice, and presents the app plan.
Only `zetic/LFM3-1.7B`, `zetic/LFM3-VL-2B`, `zetic/LFM3-Audio-2B`,
`zetic/LFM3-Omni-2B`, `zetic/d1-2B`, and `zetic/d1-Omni-2B` are eligible.
D1 is a decision model, not a token-generating chat model. Missing performance
reports must remain unavailable rather than borrowing another model's measurements.

The packaged `qiyl-plan-only` resource activates `MELANGE_QIYL_DEMO=1` in the
backend. That mode exposes planning tools only and prevents app implementation,
model downloads, and builds. Finish the Agent segment at the plan-review card,
then show the separately prepared appliance-control and home-camera apps.
Catalog queries and the planning assistant still need a network connection.

Without `VITE_QIYL_DEMO=1`, the existing interface and implementation workflow apply.

## Legacy build-through demo with bundled credentials

Run `MELANGE_DEMO_PAT_FILE=/absolute/path/to/token-file bun run build:demo` from this directory.
Alternatively set `MELANGE_DEMO_PAT` in your build environment. Do not commit either credential.

To lock the demo to Claude Opus 5, also set
`MELANGE_DEMO_ANTHROPIC_KEY_FILE=/absolute/path/to/anthropic-key-file`.
This embeds `melange-qcom/demo-anthropic` and forces Anthropic Claude Opus 5,
including requests from sessions that previously selected another model.
Without this variable, the provider and model remain user-selectable.
The bundled Anthropic key is recoverable from the distributed app; use demo-only credentials.

The build embeds the token in `melange-qcom/demo-pat` and packages the desktop app for the current OS.
On startup, the app configures `MELANGE_API_KEY_FILE` for the CLI and
`ORG_GRADLE_PROJECT_MELANGE_API_KEY` for generated Android builds. Generated Gradle scripts
must read `providers.gradleProperty("MELANGE_API_KEY")` and pass it to SDK initialization.
An explicitly configured Melange credential takes precedence over the bundled demo token.

The distributed app and generated Android apps contain the demo credential. Use a demo-only,
expiring token and do not publish demo packages as normal releases.
A normal `bun run build` without any demo credential variables removes the bundled credential before packaging.

## Windows builds

Windows installers are cross-built from an Apple Silicon Mac by the same
single-target pipeline as `dist:win`:

```sh
# Intel / AMD laptops
MELANGE_DEMO_PAT_FILE=... MELANGE_DEMO_ANTHROPIC_KEY_FILE=... bun run build:demo win32 --arch x64
# Snapdragon X / X2 Elite laptops (Windows on ARM), with QIYL event UI
VITE_QIYL_DEMO=1 MELANGE_DEMO_PAT_FILE=... MELANGE_DEMO_ANTHROPIC_KEY_FILE=... bun run build:demo win32
```

The output is `dist/melange-agent-win-x64.exe` or `dist/melange-agent-win-arm64.exe`.
An x64 installer does not run correctly on a Snapdragon laptop; ship the arm64 one there.
