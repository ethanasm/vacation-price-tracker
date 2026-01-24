"use client"

import type * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "../../lib/utils"
import { buttonVariants } from "./button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex gap-4 flex-col sm:flex-row relative",
        month: "flex flex-col w-full gap-4",
        month_caption: "flex items-center justify-center h-9 w-full relative",
        caption_label: "text-sm font-medium text-foreground dark:text-white",
        nav: "flex items-center gap-1 w-full absolute top-0 inset-x-0 z-10 justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-9 p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-9 p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-gray-500 dark:text-gray-300 rounded-md flex-1 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-2",
        day: "relative flex-1 p-0 text-center text-sm",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-normal w-full text-gray-900 dark:text-white hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring aria-selected:opacity-100"
        ),
        range_start: "rounded-l-md bg-accent",
        range_middle: "rounded-none",
        range_end: "rounded-r-md bg-accent",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground rounded-md",
        outside: "text-muted-foreground aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...props }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("h-4 w-4", className)} {...props} />;
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
