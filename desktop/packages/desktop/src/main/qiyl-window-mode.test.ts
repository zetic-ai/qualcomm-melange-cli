import { expect, test } from "bun:test"
import { qiylSetupMode, qiylWindowURL } from "./qiyl-window-mode"

test("QIYL setup and presentation switches preserve the current page and other URL state", () => {
  expect(qiylSetupMode(["agent.exe"])).toBeUndefined()
  expect(qiylSetupMode(["agent.exe", "--qiyl-setup"])).toBe(true)
  expect(qiylSetupMode(["agent.exe", "--qiyl-setup", "--qiyl-demo"])).toBe(false)
  const page = "oc://renderer/project/session/example?other=1#review"
  const setup = qiylWindowURL(page, true)
  expect(new URL(setup).searchParams.get("qiylSetup")).toBe("1")
  expect(qiylWindowURL(setup, false)).toBe(page)
})
