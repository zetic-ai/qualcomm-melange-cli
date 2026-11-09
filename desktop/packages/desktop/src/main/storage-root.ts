import { join } from "node:path"

/**
 * Root directory for every OpenCode file the sidecar server keeps: database,
 * config, auth, cache and state. It lives inside the app's own user-data
 * directory so that an upstream OpenCode installed on the same machine (a
 * customer's laptop ran OpenCode 2.0.11, whose database has no `session`
 * table) is never opened by Melange Agent, and its global AGENTS.md, skills
 * and auth never leak into a demo session. An explicit OPENCODE_STORAGE_ROOT
 * in the environment wins, for tests and development.
 */
export function opencodeStorageRoot(userDataPath: string, env: Record<string, string | undefined> = process.env) {
  const explicit = env.OPENCODE_STORAGE_ROOT?.trim()
  return explicit || join(userDataPath, "opencode")
}
