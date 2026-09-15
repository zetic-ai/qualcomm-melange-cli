import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"
import { createMelangeAuth, mapAuthResult, parseAuthenticatedState, validateMelangeToken } from "./melange-auth"

const status = JSON.stringify({
  host: "https://api.zetic.ai",
  account: "demo@zetic.ai",
  scopes: ["models:read", "operations:write"],
  token_name: "desktop-demo",
  token_source: "keyring",
  storage: "keyring",
  auth_type: "oauth",
  plan: "developer",
  expiry: "2027-01-01T00:00:00Z",
})

async function command(body: string) {
  const dir = await mkdtemp(join(tmpdir(), "melange-auth-test-"))
  const file = join(dir, "melange-qcom")
  await writeFile(file, `#!/bin/sh\n${body}`)
  await chmod(file, 0o755)
  return { file, dir }
}

function pty(result: { data?: string; exitCode?: number } = {}) {
  return async () =>
    ({
      spawn() {
        let onData = (_data: string) => undefined
        let onExit = (_event: { exitCode: number }) => undefined
        return {
          kill() {
            queueMicrotask(() => onExit({ exitCode: 130 }))
          },
          onData(callback: typeof onData) {
            onData = callback
          },
          onExit(callback: typeof onExit) {
            onExit = callback
            queueMicrotask(() => {
              if (result.data) onData(result.data)
              if (result.exitCode !== undefined) onExit({ exitCode: result.exitCode })
            })
          },
        }
      },
    }) as never
}

describe("Melange authentication boundary", () => {
  test("maps authenticated status without losing CLI metadata", () => {
    expect(mapAuthResult(0, status, "")).toEqual({
      status: "authenticated",
      host: "https://api.zetic.ai",
      account: "demo@zetic.ai",
      scopes: ["models:read", "operations:write"],
      authenticationType: "oauth",
      tokenName: "desktop-demo",
      tokenSource: "keyring",
      storage: "keyring",
      plan: "developer",
      expiry: "2027-01-01T00:00:00Z",
      environmentManaged: false,
    })
  })

  test("does not report network, integration, or malformed output as logout", () => {
    expect(mapAuthResult(4, "", "not logged in")).toEqual({ status: "unauthenticated" })
    expect(mapAuthResult(1, "", "network down")).toEqual({
      status: "unavailable",
      message: "network down",
      retryable: true,
    })
    expect(mapAuthResult(2, "", "bad invocation")).toEqual({
      status: "error",
      message: "bad invocation",
      retryable: false,
    })
    expect(mapAuthResult(130, "", "")).toEqual({ status: "error", message: "Sign-in canceled", retryable: true })
    expect(mapAuthResult(0, "not-json", "")).toEqual({
      status: "error",
      message: "Qualcomm Melange CLI returned invalid authentication data",
      retryable: false,
    })
  })

  test("marks environment credentials and rejects incomplete JSON", () => {
    expect(parseAuthenticatedState(status, { MELANGE_API_KEY: "managed" }).environmentManaged).toBe(true)
    expect(() => parseAuthenticatedState('{"host":"https://api.zetic.ai"}', {})).toThrow("invalid authentication data")
  })

  test("validates PATs before they cross IPC", () => {
    expect(validateMelangeToken("  ztp_example-token  ")).toBe("ztp_example-token")
    expect(() => validateMelangeToken("secret")).toThrow("must start with ztp_")
    expect(() => validateMelangeToken(`ztp_${"x".repeat(4093)}`)).toThrow("too long")
  })

  test("redacts token failures, rejects concurrent login, and cancels without persisting the token", async () => {
    const fixture = await command(`
if [ "$*" = "auth login --with-token --json" ]; then
  IFS= read -r token
  case "$token" in ztp_long_*) sleep 5;; esac
  printf 'rejected %s' "$token" >&2
  exit 2
fi
exit 4
`)
    try {
      const auth = createMelangeAuth(fixture.file, {})
      const first = auth.loginToken("ztp_long_private")
      expect(await auth.loginToken("ztp_other")).toEqual({
        status: "error",
        message: "A Melange sign-in is already running",
        retryable: true,
      })
      await auth.cancelLogin()
      expect(await first).toEqual({ status: "error", message: "Sign-in canceled", retryable: true })
      expect(await auth.loginToken("ztp_redact")).toEqual({
        status: "error",
        message: "rejected [REDACTED]",
        retryable: false,
      })
      expect(await readFile(fixture.file, "utf8")).not.toContain("ztp_long_private")
    } finally {
      await rm(fixture.dir, { recursive: true, force: true })
    }
  })

  test("completes browser OAuth", async () => {
    const complete = await command(`
if [ "$*" = "auth login --json" ]; then exit 0; fi
if [ "$*" = "auth status --json" ]; then printf '%s\\n' '${status}'; exit 0; fi
exit 2
`)
    try {
      expect(await createMelangeAuth(complete.file, {}, pty({ exitCode: 0 })).loginBrowser()).toMatchObject({
        status: "authenticated",
      })
    } finally {
      await rm(complete.dir, { recursive: true, force: true })
    }
  })

  test("stops at an interactive token fallback", async () => {
    const fallback = await command(`
if [ "$*" = "auth login --json" ]; then
  printf 'Paste your personal access token\\n'
  sleep 1
fi
exit 2
`)
    try {
      expect(
        await createMelangeAuth(fallback.file, {}, pty({ data: "Paste your personal access token" })).loginBrowser(),
      ).toEqual({
        status: "unavailable",
        message: "Browser sign-in could not complete. Use a personal access token instead.",
        retryable: true,
      })
    } finally {
      await rm(fallback.dir, { recursive: true, force: true })
    }
  })

  test("allows only one browser login and supports cancellation", async () => {
    const fixture = await command(`
if [ "$*" = "auth login --json" ]; then sleep 5; fi
exit 2
`)
    try {
      const auth = createMelangeAuth(fixture.file, {}, pty())
      const first = auth.loginBrowser()
      expect(await auth.loginBrowser()).toEqual({
        status: "error",
        message: "A Melange sign-in is already running",
        retryable: true,
      })
      await Bun.sleep(50)
      await auth.cancelLogin()
      expect(await first).toEqual({ status: "error", message: "Sign-in canceled", retryable: true })
    } finally {
      await rm(fixture.dir, { recursive: true, force: true })
    }
  })

  test("logs out stored credentials but preserves environment-managed credentials", async () => {
    const fixture = await command(`
marker="$0.logged-out"
if [ "$*" = "auth logout" ]; then touch "$marker"; exit 0; fi
if [ "$*" = "auth status --json" ]; then
  if [ -e "$marker" ]; then exit 4; fi
  printf '%s\\n' '${status}'
  exit 0
fi
exit 2
`)
    try {
      expect(await createMelangeAuth(fixture.file, {}).logout()).toEqual({ status: "unauthenticated" })
      await rm(`${fixture.file}.logged-out`, { force: true })
      expect(await createMelangeAuth(fixture.file, { MELANGE_API_KEY: "managed" }).logout()).toMatchObject({
        status: "authenticated",
        environmentManaged: true,
      })
      expect(await Bun.file(`${fixture.file}.logged-out`).exists()).toBe(false)
    } finally {
      await rm(fixture.dir, { recursive: true, force: true })
    }
  })
})
