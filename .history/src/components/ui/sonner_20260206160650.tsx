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
        success: <CircleCheckIcon className="size-4 text-emerald-600" />,
        info: <InfoIcon className="size-4 text-blue-600" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-600" />,
        error: <OctagonXIcon className="size-4 text-red-600" />,
        loading: <Loader2Icon className="size-4 animate-spin text-gray-600" />,
      }}
      toastOptions={{
        classNames: {
          toast: "border-l-4 shadow-lg rounded-lg",
          success: "!bg-emerald-50 !text-emerald-900 !border-l-emerald-500 !border-emerald-200",
          error: "!bg-red-50 !text-red-900 !border-l-red-500 !border-red-200",
          warning: "!bg-amber-50 !text-amber-900 !border-l-amber-500 !border-amber-200",
          info: "!bg-blue-50 !text-blue-900 !border-l-blue-500 !border-blue-200",
          title: "font-semibold",
          description: "text-sm opacity-80",
          closeButton: "!bg-white/80 hover:!bg-white !border-gray-200 !text-gray-500 hover:!text-gray-700",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
