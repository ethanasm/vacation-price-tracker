import * as React from "react"

import { cn } from "../../lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-border/60 dark:border-white/30 bg-white/60 dark:bg-white/10 backdrop-blur-sm px-4 py-2 text-sm text-gray-900 dark:text-white shadow-sm transition-all placeholder:text-gray-400 dark:placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-border dark:focus:border-white/50 focus:bg-white/80 dark:focus:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50",
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
