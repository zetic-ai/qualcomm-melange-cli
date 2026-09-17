import zeticLogo from "@/assets/brand/zetic.png"
import qualcommLogo from "@/assets/brand/qualcomm.png"

export function BrandHeader() {
  return (
    <div
      data-component="brand-header"
      class="flex shrink-0 items-center justify-between gap-6 bg-white px-5 py-4 sm:px-8"
    >
      <img src={zeticLogo} alt="ZETIC" class="h-8 sm:h-10 w-auto object-contain" draggable={false} />
      <img src={qualcommLogo} alt="Qualcomm" class="h-auto w-32 sm:w-40 object-contain" draggable={false} />
    </div>
  )
}
