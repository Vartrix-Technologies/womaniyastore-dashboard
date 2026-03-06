"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          title: "group-[.toast]:text-foreground group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm",
          closeButton: "group-[.toast]:bg-background group-[.toast]:text-muted-foreground group-[.toast]:border-border group-[.toast]:hover:bg-muted group-[.toast]:hover:text-foreground",
          success: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-emerald-500 group-[.toaster]:bg-emerald-50 group-[.toaster]:text-emerald-900 dark:group-[.toaster]:bg-emerald-950 dark:group-[.toaster]:text-emerald-100",
          error: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-red-500 group-[.toaster]:bg-red-50 group-[.toaster]:text-red-900 dark:group-[.toaster]:bg-red-950 dark:group-[.toaster]:text-red-100",
          warning: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-amber-500 group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-900 dark:group-[.toaster]:bg-amber-950 dark:group-[.toaster]:text-amber-100",
          info: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-blue-500 group-[.toaster]:bg-blue-50 group-[.toaster]:text-blue-900 dark:group-[.toaster]:bg-blue-950 dark:group-[.toaster]:text-blue-100",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
