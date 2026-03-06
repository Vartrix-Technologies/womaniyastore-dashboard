'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { COLOR_PALETTES, useThemeColor, type PaletteId } from '@/context/ThemeColorContext';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface ThemePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const palettes = Object.values(COLOR_PALETTES);

export function ThemePickerDialog({ open, onOpenChange }: ThemePickerDialogProps) {
  const { paletteId, setPalette } = useThemeColor();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Theme Color</DialogTitle>
          <p className="text-sm text-muted-foreground">Choose a color palette for the interface</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 pt-2">
          {palettes.map((p) => {
            const isActive = p.id === paletteId;
            return (
              <button
                key={p.id}
                onClick={() => setPalette(p.id as PaletteId)}
                className={cn(
                  'group relative flex flex-col items-center gap-2.5 rounded-xl p-3.5 transition-all duration-200',
                  'border-2 cursor-pointer',
                  'hover:scale-[1.03] active:scale-[0.97]',
                  isActive
                    ? 'border-foreground/30 bg-accent shadow-md'
                    : 'border-transparent bg-muted/50 hover:bg-muted hover:border-border',
                )}
              >
                {/* Gradient swatch */}
                <div
                  className={cn(
                    'relative h-10 w-10 rounded-full shadow-sm transition-shadow',
                    isActive && 'ring-2 ring-offset-2 ring-offset-background',
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]})`,
                    ...(isActive ? { boxShadow: `0 0 0 2px ${p.swatch[0]}40` } : {}),
                  }}
                >
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="h-5 w-5 text-white drop-shadow-md" strokeWidth={3} />
                    </div>
                  )}
                </div>

                {/* Label */}
                <div className="text-center">
                  <p className={cn(
                    'text-xs font-semibold leading-tight',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {p.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">
                    {p.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Preview bar */}
        <div className="mt-3 rounded-xl overflow-hidden border">
          <div
            className="h-2 transition-all duration-500"
            style={{
              background: `linear-gradient(90deg, ${COLOR_PALETTES[paletteId].swatch[0]}, ${COLOR_PALETTES[paletteId].swatch[1]})`,
            }}
          />
          <div className={cn(
            'px-4 py-3 flex items-center justify-between text-xs',
            isDark ? 'bg-card' : 'bg-muted/30',
          )}>
            <span className="text-muted-foreground">Preview</span>
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded-full"
                style={{ background: COLOR_PALETTES[paletteId].colors[500] }}
              />
              <span className="font-medium" style={{ color: COLOR_PALETTES[paletteId].colors[isDark ? 400 : 600] }}>
                {COLOR_PALETTES[paletteId].label}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
