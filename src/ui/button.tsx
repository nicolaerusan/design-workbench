// Adapted from shadcn/ui (MIT). Styling is namespaced for embeddable use.
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "./utils.ts"

const buttonVariants = cva(
  "db-button",
  {
    variants: {
      variant: {
        default:
          "db-button-primary",
        destructive:
          "db-button-destructive",
        outline:
          "db-button-outline",
        secondary:
          "db-button-secondary",
        ghost: "db-button-ghost",
        link: "db-button-link",
      },
      size: {
        default: "db-button-size-default",
        sm: "db-button-size-sm",
        lg: "db-button-size-lg",
        icon: "db-button-size-icon",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
