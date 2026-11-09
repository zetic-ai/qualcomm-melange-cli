export function qiylSetupMode(args: string[]) {
  const mode = args.findLast((arg) => arg === "--qiyl-setup" || arg === "--qiyl-demo")
  if (mode) return mode === "--qiyl-setup"
}

export function qiylWindowURL(value: string, setup: boolean) {
  const url = new URL(value)
  if (setup) url.searchParams.set("qiylSetup", "1")
  else url.searchParams.delete("qiylSetup")
  return url.href
}
