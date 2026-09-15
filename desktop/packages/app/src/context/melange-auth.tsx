import { createSimpleContext } from "@opencode-ai/ui/context"
import { createResource, createSignal, type ParentProps } from "solid-js"
import { usePlatform } from "./platform"
import type { MelangeAuthState } from "../melange-auth"

export const { use: useMelangeAuth, provider: MelangeAuthProvider } = createSimpleContext({
  name: "MelangeAuth",
  init: (_props: ParentProps) => {
    const platform = usePlatform()
    const api = platform.melangeAuth
    const [state, controls] = createResource(() => api?.status())
    const [busy, setBusy] = createSignal<"browser" | "token" | "logout">()

    const run = async (kind: "browser" | "token" | "logout", task: () => Promise<MelangeAuthState>) => {
      setBusy(kind)
      try {
        const next = await task()
        controls.mutate(next)
        return next
      } finally {
        setBusy()
      }
    }

    return {
      state,
      busy,
      recheck: () => controls.refetch(),
      loginBrowser: () => run("browser", () => api!.loginBrowser()),
      loginToken: (token: string) => run("token", () => api!.loginToken(token)),
      cancelLogin: () => api?.cancelLogin() ?? Promise.resolve(),
      logout: () => run("logout", () => api!.logout()),
      available: Boolean(api),
    }
  },
})
