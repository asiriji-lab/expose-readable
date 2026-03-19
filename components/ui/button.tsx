"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-border bg-background hover:bg-surface-alt hover:text-foreground aria-expanded:bg-surface-alt",
        secondary:
          "bg-surface-alt text-foreground border border-border hover:bg-border aria-expanded:bg-surface-alt",
        ghost:
          "hover:bg-surface-alt text-foreground-muted hover:text-foreground aria-expanded:bg-surface-alt",
        destructive:
          "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/30",
        success:
          "bg-success text-white hover:bg-success/90 focus-visible:ring-success/30",
        danger:
          "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-4 text-sm",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs",
        sm: "h-8 gap-1 px-3 text-xs",
        lg: "h-11 gap-1.5 px-6 font-semibold",
        full: "w-full py-3 rounded-xl font-semibold text-sm gap-2",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)]",
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)]",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
