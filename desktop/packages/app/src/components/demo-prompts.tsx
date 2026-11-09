import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { qiylDemo } from "@/utils/qiyl-demo"
import "./demo-prompts.css"

export type DemoApp = "translation" | "image" | "appliance"
type DemoPromptCopy = "label" | "description" | "prompt"
type DemoPromptKey = `prompt.demo.${DemoApp}.${DemoPromptCopy}` | `prompt.demo.qiyl.appliance.${DemoPromptCopy}`

export function demoPromptOptions(demo: boolean): readonly DemoApp[] {
  return demo ? ["appliance"] : ["translation", "image", "appliance"]
}

export function demoPromptTranslationKey(demo: boolean, option: DemoApp, copy: DemoPromptCopy): DemoPromptKey {
  if (demo && option === "appliance") return `prompt.demo.qiyl.appliance.${copy}`
  return `prompt.demo.${option}.${copy}`
}

export function DemoPrompts(props: { disabled: boolean; hidden?: boolean; onSend: (text: string, demo: DemoApp) => void }) {
  const language = useLanguage()
  const options = demoPromptOptions(qiylDemo)
  return (
    <Show when={!props.hidden}>
      <div data-component="demo-prompts" data-qiyl-demo={qiylDemo ? "true" : undefined}>
        <For each={options}>
          {(option) => (
            <button
              type="button"
              data-demo={option}
              disabled={props.disabled}
              onClick={() =>
                props.onSend(language.t(demoPromptTranslationKey(qiylDemo, option, "prompt")), option)
              }
            >
              <span data-slot="demo-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  {option === "translation" ? (
                    <>
                      <path d="M3 5h11M8 3v2M12 5c-1 6-4 9-9 11M5 8c1 3 3 5 6 7M13 21l4-11 4 11M14.5 17h5" />
                    </>
                  ) : option === "image" ? (
                    <>
                      <rect x="3" y="3" width="18" height="18" rx="4" />
                      <circle cx="8" cy="8" r="1.5" />
                      <path d="m3 17 5-5 4 4 4-6 5 7" />
                    </>
                  ) : (
                    <>
                      <path d="m3 10 9-7 9 7M5 9v11h14V9M12 10v5" />
                      <path d="M9 12a4 4 0 1 0 6 0" />
                    </>
                  )}
                </svg>
              </span>
              <span data-slot="demo-copy">
                <strong>
                  {language.t(demoPromptTranslationKey(qiylDemo, option, "label"))}
                </strong>
                <span>
                  {language.t(demoPromptTranslationKey(qiylDemo, option, "description"))}
                </span>
              </span>
              <span data-slot="demo-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          )}
        </For>
      </div>
    </Show>
  )
}
