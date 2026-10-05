// Adapted from shadcn/ui (MIT). Styling is namespaced for embeddable use.
import * as React from "react"

import { cn } from "./utils.ts"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "db-input",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
