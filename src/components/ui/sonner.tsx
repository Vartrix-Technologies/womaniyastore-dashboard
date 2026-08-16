"use client"

import { useEffect, useRef } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, toast, useSonner, type ToasterProps } from "sonner"

/** Matches the `duration` passed to <Toaster /> in app/layout.tsx. */
const DEFAULT_DURATION = 4000
/** How long past a toast's own duration before we force it off screen. */
const GRACE_MS = 2500
const CHECK_MS = 1000

/**
 * Safety net for Sonner's auto-dismiss timer.
 *
 * Sonner pauses a toast's dismiss timer whenever `expanded || interacting ||
 * isDocumentHidden` is true. All three can latch permanently on touch devices:
 * `expanded` is set on mouseenter and only reset when the toast count drops to
 * <= 1, `interacting` is set on pointerdown and only cleared on pointerup (there
 * is no pointercancel handler, and Android fires pointercancel when the OS takes
 * over a gesture), and `isDocumentHidden` stays true if the resume
 * visibilitychange never lands — which is what happens when the installed PWA is
 * backgrounded by the system download handler. Once latched, *every* toast in the
 * app is frozen until a full reload.
 *
 * This guard tracks how long each toast has actually been on screen and dismisses
 * anything that outlives its duration. `toast.dismiss()` bypasses the timer
 * entirely, so it works even while Sonner is stuck in a paused state.
 */
type TrackedToast = { seenAt: number; type?: string; title: string }

/** Titles can be ReactNodes; only string titles are comparable for "was this updated?". */
const titleKey = (title: unknown) => (typeof title === "string" ? title : "")

function useStuckToastGuard(defaultDuration = DEFAULT_DURATION) {
  const { toasts } = useSonner()
  const trackedRef = useRef(new Map<string | number, TrackedToast>())
  const dismissedRef = useRef(new Set<string | number>())

  useEffect(() => {
    const tracked = trackedRef.current
    const liveIds = new Set(toasts.map((t) => t.id))

    for (const id of Array.from(tracked.keys())) {
      if (!liveIds.has(id)) tracked.delete(id)
    }
    for (const id of Array.from(dismissedRef.current)) {
      if (!liveIds.has(id)) dismissedRef.current.delete(id)
    }

    for (const t of toasts) {
      const previous = tracked.get(t.id)
      const title = titleKey(t.title)
      // A toast updated in place (loading -> success on the same id) restarts its
      // lifetime, exactly as Sonner's own timer does — otherwise we would age the
      // replacement from when the original appeared and cut it short.
      if (!previous || previous.type !== t.type || previous.title !== title) {
        tracked.set(t.id, { seenAt: Date.now(), type: t.type, title })
      }
    }
  }, [toasts])

  useEffect(() => {
    if (toasts.length === 0) return

    const interval = window.setInterval(() => {
      // Honour a deliberate hover-to-read, but only where hover is real —
      // touch devices latch :hover, which is part of the bug we're guarding against.
      if (
        window.matchMedia("(hover: hover)").matches &&
        document.querySelector("[data-sonner-toaster]:hover")
      ) {
        return
      }

      const now = Date.now()
      for (const t of toasts) {
        if (t.type === "loading") continue // intentionally indefinite
        if (dismissedRef.current.has(t.id)) continue // dismiss once — onDismiss can be destructive
        const duration = typeof t.duration === "number" ? t.duration : defaultDuration
        if (!Number.isFinite(duration)) continue // Infinity = sticky by design

        const tracked = trackedRef.current.get(t.id)
        if (tracked && now - tracked.seenAt > duration + GRACE_MS) {
          dismissedRef.current.add(t.id)
          toast.dismiss(t.id)
        }
      }
    }, CHECK_MS)

    return () => window.clearInterval(interval)
  }, [toasts, defaultDuration])
}

const Toaster = ({ ...props }: ToasterProps) => {
  useStuckToastGuard(typeof props.duration === "number" ? props.duration : DEFAULT_DURATION)

  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "premium-toast",
          title: "premium-toast-title",
          description: "premium-toast-description",
          actionButton: "premium-toast-action",
          cancelButton: "premium-toast-cancel",
          closeButton: "premium-toast-close",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
