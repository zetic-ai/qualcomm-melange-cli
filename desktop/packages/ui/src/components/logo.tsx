import type { ComponentProps } from "solid-js"
import bora from "../assets/images/bora-in-app-main.svg"

type ImageProps = Pick<ComponentProps<"img">, "ref" | "class">

const Bora = (props: ImageProps & { component: string }) => (
  <img
    ref={props.ref}
    data-component={props.component}
    src={bora}
    class={props.class}
    alt=""
    aria-hidden="true"
    draggable={false}
  />
)

export const Mark = (props: ImageProps) => <Bora {...props} component="logo-mark" />
export const Splash = (props: ImageProps) => <Bora {...props} component="logo-splash" />
export const Logo = (props: ImageProps) => <Bora {...props} component="logo" />
