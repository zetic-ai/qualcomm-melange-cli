import type { ComponentProps } from "solid-js"
import bora from "../../assets/images/bora-in-app-main.svg"

export function WordmarkV2(props: Pick<ComponentProps<"img">, "class">) {
  return <img src={bora} class={props.class} alt="" aria-hidden="true" draggable={false} />
}
