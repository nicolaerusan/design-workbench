// Adapted from shadcn/ui (MIT). Styling is namespaced for embeddable use.
import * as React from "react"

import { cn } from "./utils.ts"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "db-textarea",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
