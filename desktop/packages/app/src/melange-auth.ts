export type MelangeAuthenticatedState = {
  status: "authenticated"
  host: string
  account: string
  scopes: string[]
  authenticationType: string
  tokenName: string
  tokenSource: string
  storage: string
  plan?: string
  expiry?: string
  environmentManaged: boolean
}

export type MelangeAuthState =
  | MelangeAuthenticatedState
  | { status: "unauthenticated" }
  | { status: "unavailable"; message: string; retryable: true }
  | { status: "error"; message: string; retryable: boolean }

export type MelangeAuthPlatform = {
  status(): Promise<MelangeAuthState>
  loginBrowser(): Promise<MelangeAuthState>
  loginToken(token: string): Promise<MelangeAuthState>
  cancelLogin(): Promise<void>
  logout(): Promise<MelangeAuthState>
}
