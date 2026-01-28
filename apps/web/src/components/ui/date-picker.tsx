"use client"

import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

interface DatePickerProps {
  date: Date | undefined
  onSelect: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  fromDate?: Date
  toDate?: Date
  defaultMonth?: Date
  className?: string
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Pick a date",
  disabled = false,
  fromDate,
  toDate,
  defaultMonth,
  className,
}: DatePickerProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full !justify-start text-left font-normal !bg-white/60 dark:!bg-white/10 !border-border/60 dark:!border-white/30 text-gray-900 dark:text-white relative !pl-10",
            !date && "!text-gray-400 dark:!text-gray-300",
            className
          )}
        >
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px]" style={{ color: 'var(--ink-muted, #6b7280)' }} />
          {isHydrated && date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={defaultMonth}
          onSelect={(nextDate) => {
            onSelect(nextDate)
            if (nextDate) {
              setOpen(false)
            }
          }}
          disabled={(date) => {
            if (fromDate && date < fromDate) return true
            if (toDate && date > toDate) return true
            return false
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
