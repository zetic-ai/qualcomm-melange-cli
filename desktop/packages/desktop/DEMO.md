# Demo builds

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
# Snapdragon X / X2 Elite laptops (Windows on ARM)
MELANGE_DEMO_PAT_FILE=... MELANGE_DEMO_ANTHROPIC_KEY_FILE=... bun run build:demo win32
```

The output is `dist/melange-agent-win-x64.exe` or `dist/melange-agent-win-arm64.exe`.
An x64 installer does not run correctly on a Snapdragon laptop; ship the arm64 one there.
