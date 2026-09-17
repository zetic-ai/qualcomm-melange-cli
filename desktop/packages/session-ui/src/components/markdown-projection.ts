import type { Block, Projection } from "./markdown-stream"
import { marked } from "marked"

export function completedProjection(text: string): Projection {
  if (/^[ \t]*```benchmark-chart\b/m.test(text)) {
    return {
      text,
      blocks: marked
        .lexer(text)
        .map(
          (token): Block =>
            token.type === "code" && token.lang === "benchmark-chart"
              ? { raw: token.raw, src: token.text, mode: "code", language: token.lang, complete: true }
              : { raw: token.raw, src: token.raw, mode: "full" },
        ),
    }
  }
  return { text, blocks: [{ raw: text, src: text, mode: "full" }] }
}

export function canReusePendingBlock(current: Pick<Block, "mode" | "raw"> | undefined, next: Block) {
  if (!current || current.mode !== next.mode) return false
  if (next.mode === "code" || next.mode === "live") return next.raw.startsWith(current.raw)
  return current.raw === next.raw
}
