import { spawn } from "node:child_process"
import type { MelangeAuthenticatedState, MelangeAuthPlatform, MelangeAuthState } from "@opencode-ai/app"

const MAX_TOKEN_LENGTH = 4096
const MAX_OUTPUT_LENGTH = 64 * 1024
const TOKEN_PROMPT = /paste your personal access token/i

type AuthJSON = {
  host?: unknown
  account?: unknown
  scopes?: unknown
  token_name?: unknown
  token_source?: unknown
  storage?: unknown
  auth_type?: unknown
  plan?: unknown
  expiry?: unknown
}

function message(stderr: string, fallback: string) {
  return stderr.trim().slice(0, 1000) || fallback
}

export function parseAuthenticatedState(output: string, env: NodeJS.ProcessEnv): MelangeAuthenticatedState {
  let value: AuthJSON
  try {
    const line = output
      .split(/\r?\n/)
      .map((item) => item.trim())
      .findLast((item) => item.startsWith("{") && item.endsWith("}"))
    value = JSON.parse(line ?? output)
  } catch {
    throw new Error("Qualcomm Melange CLI returned invalid authentication data")
  }
  if (
    typeof value.host !== "string" ||
    typeof value.account !== "string" ||
    !Array.isArray(value.scopes) ||
    !value.scopes.every((scope) => typeof scope === "string") ||
    typeof value.token_name !== "string" ||
    typeof value.token_source !== "string" ||
    typeof value.storage !== "string" ||
    typeof value.auth_type !== "string"
  ) {
    throw new Error("Qualcomm Melange CLI returned invalid authentication data")
  }
  return {
    status: "authenticated",
    host: value.host,
    account: value.account,
    scopes: value.scopes as string[],
    authenticationType: value.auth_type,
    tokenName: value.token_name,
    tokenSource: value.token_source,
    storage: value.storage,
    ...(typeof value.plan === "string" ? { plan: value.plan } : {}),
    ...(typeof value.expiry === "string" ? { expiry: value.expiry } : {}),
    environmentManaged: Boolean(env.MELANGE_API_KEY || env.MELANGE_API_KEY_FILE),
  }
}

export function mapAuthResult(
  code: number,
  stdout: string,
  stderr: string,
  env: NodeJS.ProcessEnv = process.env,
): MelangeAuthState {
  if (code === 4) return { status: "unauthenticated" }
  if (code === 1)
    return { status: "unavailable", message: message(stderr, "Qualcomm Melange is unavailable"), retryable: true }
  if (code === 2)
    return { status: "error", message: message(stderr, "Qualcomm Melange integration error"), retryable: false }
  if (code === 130) return { status: "error", message: "Sign-in canceled", retryable: true }
  if (code !== 0)
    return {
      status: "error",
      message: message(stderr, `Qualcomm Melange CLI exited with code ${code}`),
      retryable: true,
    }
  try {
    return parseAuthenticatedState(stdout, env)
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error), retryable: false }
  }
}

export function validateMelangeToken(value: string) {
  const token = value.trim()
  if (!token.startsWith("ztp_")) throw new Error("Personal access token must start with ztp_")
  if (token.length > MAX_TOKEN_LENGTH) throw new Error("Personal access token is too long")
  return token
}

function stripTerminal(value: string) {
  return value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
}

function commandEnv(base: NodeJS.ProcessEnv) {
  const env = { ...base }
  if (base.MELANGE_AGENT_XDG_STATE_HOME_SET === "1") env.XDG_STATE_HOME = base.MELANGE_AGENT_XDG_STATE_HOME
  else delete env.XDG_STATE_HOME
  delete env.MELANGE_AGENT_XDG_STATE_HOME
  delete env.MELANGE_AGENT_XDG_STATE_HOME_SET
  return env
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv, input?: string, signal?: AbortSignal) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, { env: commandEnv(env), stdio: ["pipe", "pipe", "pipe"], signal })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (data) => (stdout = (stdout + data).slice(-MAX_OUTPUT_LENGTH)))
    child.stderr.on("data", (data) => (stderr = (stderr + data).slice(-MAX_OUTPUT_LENGTH)))
    child.stdin.on("error", () => undefined)
    child.once("error", (error) => resolve({ code: 1, stdout, stderr: error.message }))
    child.once("close", (code) => resolve({ code: code ?? 1, stdout, stderr }))
    if (input) child.stdin.end(input)
    else child.stdin.end()
  })
}

export function createMelangeAuth(
  command: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
  loadPty = () => import("@lydell/node-pty").catch(() => undefined),
): MelangeAuthPlatform {
  let active: { cancel(): void } | undefined

  const status = async () => {
    const result = await run(command, ["auth", "status", "--json"], baseEnv)
    return mapAuthResult(result.code, result.stdout, result.stderr, baseEnv)
  }

  return {
    status,
    async loginBrowser() {
      if (active) return { status: "error", message: "A Melange sign-in is already running", retryable: true }
      let canceledBeforeStart = false
      active = { cancel: () => (canceledBeforeStart = true) }
      const pty = await loadPty()
      if (!pty) {
        active = undefined
        return { status: "unavailable", message: "Browser sign-in is unavailable", retryable: true }
      }
      if (canceledBeforeStart) {
        active = undefined
        return { status: "error", message: "Sign-in canceled", retryable: true }
      }
      return new Promise<MelangeAuthState>((resolve) => {
        let output = ""
        let canceled = false
        let fellBack = false
        let settled = false
        let child: ReturnType<typeof pty.spawn>
        const finish = (state: MelangeAuthState) => {
          if (settled) return
          settled = true
          active = undefined
          resolve(state)
        }
        try {
          child = pty.spawn(command, ["auth", "login", "--json"], {
            env: commandEnv(baseEnv) as Record<string, string>,
            cwd: process.cwd(),
            cols: 100,
            rows: 30,
            name: "xterm-256color",
          })
        } catch (error) {
          finish({
            status: "unavailable",
            message: error instanceof Error ? error.message : String(error),
            retryable: true,
          })
          return
        }
        active = {
          cancel() {
            canceled = true
            child.kill()
            finish({ status: "error", message: "Sign-in canceled", retryable: true })
          },
        }
        child.onData((data) => {
          output = (output + stripTerminal(data)).slice(-MAX_OUTPUT_LENGTH)
          if (!TOKEN_PROMPT.test(output) || fellBack) return
          fellBack = true
          child.kill()
          finish({
            status: "unavailable",
            message: "Browser sign-in could not complete. Use a personal access token instead.",
            retryable: true,
          })
        })
        child.onExit(({ exitCode }) => {
          if (canceled) return finish({ status: "error", message: "Sign-in canceled", retryable: true })
          if (fellBack) {
            return finish({
              status: "unavailable",
              message: "Browser sign-in could not complete. Use a personal access token instead.",
              retryable: true,
            })
          }
          if (exitCode === 0) void status().then(finish)
          else finish(mapAuthResult(exitCode, output, output, baseEnv))
        })
      })
    },
    async loginToken(value) {
      if (active) return { status: "error", message: "A Melange sign-in is already running", retryable: true }
      let token: string
      try {
        token = validateMelangeToken(value)
      } catch (error) {
        return { status: "error", message: error instanceof Error ? error.message : String(error), retryable: false }
      }
      let canceled = false
      const abort = new AbortController()
      const task = run(command, ["auth", "login", "--with-token", "--json"], baseEnv, `${token}\n`, abort.signal)
      active = {
        cancel: () => {
          canceled = true
          abort.abort()
        },
      }
      const result = await task
      active = undefined
      if (canceled) return { status: "error", message: "Sign-in canceled", retryable: true }
      const clean = (text: string) => text.replaceAll(token, "[REDACTED]")
      if (result.code === 0) return status()
      return mapAuthResult(result.code, clean(result.stdout), clean(result.stderr), baseEnv)
    },
    async cancelLogin() {
      active?.cancel()
    },
    async logout() {
      if (baseEnv.MELANGE_API_KEY || baseEnv.MELANGE_API_KEY_FILE) return status()
      const result = await run(command, ["auth", "logout"], baseEnv)
      if (result.code !== 0) return mapAuthResult(result.code, result.stdout, result.stderr, baseEnv)
      return status()
    },
  }
}
