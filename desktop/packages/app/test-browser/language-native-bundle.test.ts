import { expect, test } from "bun:test"
import { appKorean } from "../src/i18n/ko"
import {
  createDesktopNativeBundle,
  DESKTOP_NATIVE_ENGLISH,
  parseDesktopNativeBundle,
} from "../src/i18n/desktop-native"

test("builds a valid Korean native menu bundle from the shipped dictionary", () => {
  const bundle = createDesktopNativeBundle("ko", (key) => appKorean[key] ?? DESKTOP_NATIVE_ENGLISH[key])

  expect(bundle.locale).toBe("ko")
  expect(parseDesktopNativeBundle(bundle)).toEqual(bundle)
  expect(bundle.messages["desktop.menu.newSession"]).toBe("새 세션")
  expect(bundle.messages["desktop.menu.settings"]).toBe("설정")
})
