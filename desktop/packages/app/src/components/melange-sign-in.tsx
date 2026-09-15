import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Splash } from "@opencode-ai/ui/logo"
import { createSignal, Show } from "solid-js"
import { useMelangeAuth } from "@/context/melange-auth"

export function MelangeSignIn(props: { firstLaunch?: boolean; onContinue?: () => void }) {
  const auth = useMelangeAuth()
  const [showToken, setShowToken] = createSignal(false)
  const [token, setToken] = createSignal("")
  const state = () => auth.state()
  const authenticated = () => {
    const current = state()
    return current?.status === "authenticated" ? current : undefined
  }
  const issue = () => {
    const current = state()
    return current?.status === "unavailable" || current?.status === "error" ? current : undefined
  }

  const submitToken = async (event: SubmitEvent) => {
    event.preventDefault()
    const value = token()
    setToken("")
    await auth.loginToken(value)
  }

  return (
    <div class="flex h-full w-full items-center justify-center bg-background-base p-8">
      <div class="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <Splash class="h-32 w-32" />
        <div>
          <h1 class="text-20-medium text-text-strong">Welcome to Melange Agent</h1>
          <p class="mt-2 text-14-regular text-text-weak">
            Sign in to use Qualcomm Melange from the coding agent. You can continue and sign in later.
          </p>
        </div>

        <Show when={state()?.status === "authenticated"}>
          <p class="text-14-regular text-text-base">Signed in as {authenticated()?.account}</p>
        </Show>
        <Show when={state()?.status === "unavailable" || state()?.status === "error"}>
          <p class="rounded-md bg-surface-base px-3 py-2 text-13-regular text-text-base">{issue()?.message}</p>
        </Show>

        <Show when={state()?.status !== "authenticated"}>
          <div class="flex w-full flex-col gap-2">
            <ButtonV2
              size="large"
              variant="contrast"
              disabled={Boolean(auth.busy())}
              onClick={() => void auth.loginBrowser()}
            >
              {auth.busy() === "browser" ? "Waiting for browser…" : "Sign in with browser"}
            </ButtonV2>
            <Show when={auth.busy() === "browser"}>
              <ButtonV2 size="normal" variant="neutral" onClick={() => void auth.cancelLogin()}>
                Cancel
              </ButtonV2>
            </Show>
            <Show
              when={showToken()}
              fallback={
                <ButtonV2 size="normal" variant="neutral" onClick={() => setShowToken(true)}>
                  Use a personal access token
                </ButtonV2>
              }
            >
              <form class="flex flex-col gap-2" onSubmit={submitToken}>
                <input
                  type="password"
                  autocomplete="off"
                  spellcheck={false}
                  value={token()}
                  onInput={(event) => setToken(event.currentTarget.value)}
                  placeholder="ztp_…"
                  aria-label="Qualcomm Melange personal access token"
                  class="h-10 rounded-md border border-border-base bg-background-strong px-3 text-14-regular text-text-strong outline-none focus:border-border-focus"
                />
                <ButtonV2 size="normal" variant="contrast" disabled={Boolean(auth.busy()) || !token()} type="submit">
                  {auth.busy() === "token" ? "Signing in…" : "Sign in with token"}
                </ButtonV2>
              </form>
            </Show>
          </div>
        </Show>

        <Show when={props.firstLaunch}>
          <ButtonV2 size="normal" variant="ghost" onClick={props.onContinue}>
            {state()?.status === "authenticated" ? "Continue" : "Continue without signing in"}
          </ButtonV2>
        </Show>
      </div>
    </div>
  )
}
