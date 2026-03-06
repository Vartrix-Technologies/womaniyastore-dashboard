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
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--success-bg": "hsl(142.1 76.2% 92.6%)",
          "--success-text": "hsl(142.1 76.2% 36.3%)",
          "--success-border": "hsl(142.1 76.2% 80%)",
          "--error-bg": "hsl(0 84.2% 92.6%)",
          "--error-text": "hsl(0 84.2% 60.2%)",
          "--error-border": "hsl(0 84.2% 80%)",
          "--warning-bg": "hsl(45 100% 92.6%)",
          "--warning-text": "hsl(45 100% 35%)",
          "--warning-border": "hsl(45 100% 80%)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
