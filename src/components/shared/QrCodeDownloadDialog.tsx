'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { PickerDialog } from '@/components/shared/PickerDialog';
import type { PickerItem } from '@/components/shared/PickerDialog';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  Loader2,
  CheckCircle,
  Palette,
  Filter,
  Eye,
  QrCode as QrCodeIcon,
  Image as ImageIcon,
  Tag,
  RefreshCw,
  ChevronRight,
  Sun,
  Moon,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import type { QrPrefix } from '@/types';
import Link from 'next/link';
import {
  type QrStyleOptions,
  type DotStyle,
  DEFAULT_QR_STYLE,
  QR_COLOR_PRESETS,
  BADGE_PRESETS,
  renderQrToCanvas,
} from '@/lib/qr-styles';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;

// ── Types ────────────────────────────────────────────────────────────────────

interface QrCodeDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Codes passed in from the page (current page / selection) */
  codes: string[];
  /** Available QR prefixes for the "Custom Range" source */
  prefixes?: QrPrefix[];
  /** Title shown in the dialog */
  title?: string;
}

type SourceMode = 'passed' | 'custom';
type OutputFormat = 'pdf' | 'zip';
type PaperSize = 'a3' | 'a4' | 'letter' | 'a5' | '12x18land';
// CDR print size: 1.754" (height) × 1.38" (width) at fixed 400 DPI
const CDR_INCHES = { w: 1.38, h: 1.754 };
const CDR_DPI = 400;

const DOT_STYLE_CONFIG: { key: DotStyle; label: string; desc: string }[] = [
  { key: 'square',  label: 'Square',  desc: 'Sharp edges' },
  { key: 'rounded', label: 'Rounded', desc: 'Soft corners' },
  { key: 'dots',    label: 'Dots',    desc: 'Circle modules' },
  { key: 'classy',  label: 'Classy',  desc: 'Connected flow' },
];

interface LayoutSettings {
  cols: number;
  rows: number;
  qrSizeMm: number;
  paperSize: PaperSize;
}

const PAPER_DIMENSIONS: Record<PaperSize, { w: number; h: number; label: string }> = {
  a3:        { w: 297,   h: 420,   label: 'A3 (297 × 420 mm)' },
  a4:        { w: 210,   h: 297,   label: 'A4 (210 × 297 mm)' },
  letter:    { w: 216,   h: 279,   label: 'Letter (216 × 279 mm)' },
  a5:        { w: 148,   h: 210,   label: 'A5 (148 × 210 mm)' },
  '12x18land': { w: 457.2, h: 304.8, label: '12 × 18 in Landscape' },
};

const LAYOUT_PRESETS: { label: string; cols: number; rows: number; qrMm: number; paperSize?: PaperSize }[] = [
  { label: '3 × 5 (Large)',         cols: 3,  rows: 5,  qrMm: 50 },
  { label: '4 × 6 (Medium)',         cols: 4,  rows: 6,  qrMm: 40 },
  { label: '5 × 8 (Compact)',        cols: 5,  rows: 8,  qrMm: 30 },
  { label: '6 × 9 (Dense)',          cols: 6,  rows: 9,  qrMm: 25 },
  { label: '8 × 11 (Tiny)',          cols: 8,  rows: 11, qrMm: 18 },
  { label: '12×18 in — 66 up 🗈',   cols: 11, rows: 6,  qrMm: 36, paperSize: '12x18land' },
];

// ── Component ────────────────────────────────────────────────────────────────

/**
 * QrCodeDownloadDialog – Premium QR print & download dialog.
 *
 * Tabs:
 *  Source  – choose current‑selection or custom prefix / range
 *  Layout  – output format, paper size, grid presets, custom grid
 *  Style   – colour themes, festival badges, logo overlay, branding
 *  Preview – live single‑QR preview with summary stats
 */
export function QrCodeDownloadDialog({
  open,
  onOpenChange,
  codes,
  prefixes = [],
  title = 'Print / Download QR Codes',
}: QrCodeDownloadDialogProps) {
  // ── Source tab state
  const [sourceMode, setSourceMode] = useState<SourceMode>('custom');
  const [customPrefix, setCustomPrefix] = useState('');
  const [customStart, setCustomStart] = useState<number | ''>('');
  const [customCount, setCustomCount] = useState<number | ''>('');
  const [prefixPickerOpen, setPrefixPickerOpen] = useState(false);

  // ── Layout tab state
  // ── Style tab state
  const [style, setStyle] = useState<QrStyleOptions>({ ...DEFAULT_QR_STYLE });
  const [colorPresetIdx, setColorPresetIdx] = useState(0);
  const [badgePresetIdx, setBadgePresetIdx] = useState(0);

  // ── Output
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  // ── Preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // ── Active tab
  const [activeTab, setActiveTab] = useState('source');

  // ── Derive final code list
  const finalCodes = useMemo(() => {
    if (sourceMode === 'passed') return codes;
    if (!customPrefix) return [];
    const start = typeof customStart === 'number' ? customStart : 1;
    const count = typeof customCount === 'number' ? customCount : 0;
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const num = start + i;
      result.push(`${customPrefix}-${String(num).padStart(4, '0')}`);
    }
    return result;
  }, [sourceMode, codes, customPrefix, customStart, customCount]);

  // ── Apply colour preset
  const applyColorPreset = useCallback((idx: number) => {
    const p = QR_COLOR_PRESETS[idx];
    if (!p) return;
    setColorPresetIdx(idx);
    setStyle((prev) => ({ ...prev, fgColor: p.fg, bgColor: p.bg }));
  }, []);

  // ── Apply badge preset
  const applyBadgePreset = useCallback((idx: number) => {
    const p = BADGE_PRESETS[idx];
    if (!p) return;
    setBadgePresetIdx(idx);
    setStyle((prev) => ({
      ...prev,
      badgeText: p.text,
      badgeColor: p.bg,
      badgeTextColor: p.fg,
    }));
  }, []);

  // ── Generate live preview (first QR) — higher res for crisp display
  const refreshPreview = useCallback(async () => {
    const sampleCode = finalCodes[0] || 'WA-000-0001';
    setPreviewLoading(true);
    try {
      const canvas = await renderQrToCanvas(sampleCode, 260, style);
      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch {
      setPreviewUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [finalCodes, style]);

  // Auto-refresh preview when style changes
  useEffect(() => {
    if (open) refreshPreview();
  }, [open, style, refreshPreview]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (finalCodes.length === 0) {
      toast.error('No QR codes to process');
      return;
    }
    setShowFullPreview(false);
    setProcessing(true);
    setProgress(0);
    setCompleted(false);

    try {
      const targetW = Math.round(CDR_INCHES.w * CDR_DPI);
      const targetH = Math.round(CDR_INCHES.h * CDR_DPI);
      const internalRes = Math.max(targetW, targetH, 800);
      await generateImagesZip(finalCodes, style, setProgress, internalRes, { w: targetW, h: targetH }, CDR_DPI);
      setCompleted(true);
      toast.success(`Processed ${finalCodes.length} QR codes`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to process QR codes');
    } finally {
      setProcessing(false);
    }
  };

  const TAB_ORDER = ['source', 'style'] as const;

  const handleNext = () => {
    const idx = TAB_ORDER.indexOf(activeTab as typeof TAB_ORDER[number]);
    if (idx >= 0 && idx < TAB_ORDER.length - 1) {
      setActiveTab(TAB_ORDER[idx + 1]);
    }
  };

  const handleClose = () => {
    if (processing) return;
    setCompleted(false);
    setProgress(0);
    setActiveTab('source');
    onOpenChange(false);
  };

  // ── UI ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] !flex !flex-col !gap-0 p-0 overflow-hidden">
        <div className={`bg-gradient-to-r ${s.primaryGradient} px-4 py-2.5 flex-shrink-0`}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
              <QrCodeIcon className="h-4 w-4 text-white" />
            </div>
            <DialogHeader className="p-0 space-y-0 text-left">
              <DialogTitle className="text-white text-base font-bold">
                {title}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px]">{finalCodes.length} code(s)</Badge>
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px]">CDR · 400 DPI</Badge>
                </div>
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="source" className="gap-1 text-xs">
                <Filter className="h-3.5 w-3.5" /> 1. Source
              </TabsTrigger>
              <TabsTrigger value="style" className="gap-1 text-xs">
                <Palette className="h-3.5 w-3.5" /> 2. Style
              </TabsTrigger>
            </TabsList>

            {/* ━━━━━━━━ SOURCE ━━━━━━━━ */}
            <TabsContent value="source" className="space-y-4 pb-4">
              {/* Custom range config — always shown */}
              <div className="space-y-3">
                <Label className="font-semibold">Custom Range</Label>
                <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Prefix</Label>
                      <Link href="/settings?tab=qr-prefixes" className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
                        <Settings2 className="h-3 w-3" /> Manage
                      </Link>
                    </div>
                    {prefixes.length > 0 ? (
                      <>
                        <Button
                          variant="outline"
                          className="w-full justify-between font-normal text-sm"
                          onClick={() => setPrefixPickerOpen(true)}
                        >
                          {customPrefix ? (
                            <span>
                              <span className="font-mono font-bold">{customPrefix}</span>
                              {prefixes.find(p => p.prefix === customPrefix)?.description && (
                                <span className="ml-2 text-muted-foreground text-xs">
                                  ({prefixes.find(p => p.prefix === customPrefix)?.description})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Select prefix…</span>
                          )}
                        </Button>
                        <PickerDialog
                          open={prefixPickerOpen}
                          onOpenChange={setPrefixPickerOpen}
                          title="Select QR Prefix"
                          searchPlaceholder="Search prefixes…"
                          items={prefixes.map((p): PickerItem => ({
                            id: p.prefix,
                            label: p.prefix,
                            sublabel: p.description || undefined,
                            mono: true,
                          }))}
                          selectedId={customPrefix}
                          onSelect={(id) => setCustomPrefix(id)}
                        />
                      </>
                    ) : (
                      <Input
                        value={customPrefix}
                        onChange={(e) => setCustomPrefix(e.target.value.toUpperCase())}
                        placeholder="e.g. WA-499"
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Number</Label>
                    <Input
                      type="number"
                      min={1}
                      max={9999}
                      value={customStart}
                      placeholder="e.g. 1"
                      onChange={(e) => {
                        const v = e.target.value;
                        setCustomStart(v === '' ? '' : Math.max(1, parseInt(v) || 1));
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Total Codes</Label>
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        max={9999}
                        value={customCount}
                        placeholder="e.g. 100"
                        className="flex-1 min-w-0"
                        onChange={(e) => {
                          const v = e.target.value;
                          setCustomCount(v === '' ? '' : Math.max(1, parseInt(v) || 1));
                        }}
                      />
                      <select
                        className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground cursor-pointer"
                        value=""
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (v) setCustomCount(v);
                        }}
                      >
                        <option value="" disabled>Sheets</option>
                        <option value="66">1 sheet (66)</option>
                        <option value="132">2 sheets (132)</option>
                        <option value="198">3 sheets (198)</option>
                        <option value="264">4 sheets (264)</option>
                        <option value="330">5 sheets (330)</option>
                      </select>
                    </div>
                  </div>

                  {customPrefix && typeof customStart === 'number' && typeof customCount === 'number' && customCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Range:{' '}
                      <span className="font-mono font-semibold">
                        {customPrefix}-{String(customStart).padStart(4, '0')}
                      </span>
                      {' → '}
                      <span className="font-mono font-semibold">
                        {customPrefix}-{String(customStart + customCount - 1).padStart(4, '0')}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ━━━━━━━━ STYLE ━━━━━━━━ */}
            <TabsContent value="style" className="space-y-4 pb-4">
              {/* ── Inline live preview thumbnail ── */}
              <div className="relative flex items-center justify-center p-3 bg-muted/40 rounded-xl border min-h-[160px]">
                {previewLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : previewUrl ? (
                  <img src={previewUrl} alt="QR Preview" className="max-h-[150px] max-w-[150px] object-contain rounded-lg shadow border bg-white" />
                ) : (
                  <QrCodeIcon className="h-12 w-12 text-muted-foreground" />
                )}
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-60 hover:opacity-100" onClick={refreshPreview} disabled={previewLoading}>
                  <RefreshCw className={`h-3 w-3 ${previewLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Module Style */}
              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-1.5">
                  <QrCodeIcon className="h-3.5 w-3.5" /> Module Style
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {DOT_STYLE_CONFIG.map(({ key, label, desc }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStyle((s) => ({ ...s, dotStyle: key }))}
                      className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                        style.dotStyle === key
                          ? `${a.borderStrong} ${a.bg} ring-2 ${a.ringLight} ${a.bgDarkSolid}`
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      {/* Mini preview grid */}
                      <div className="flex justify-center mb-1.5">
                        {key === 'square' && (
                          <div className="grid grid-cols-3 gap-[2px] w-7 h-7">
                            {[1,0,1,1,1,0,0,1,1].map((v, i) => (
                              <div key={i} className={v ? 'bg-foreground' : ''} />
                            ))}
                          </div>
                        )}
                        {key === 'rounded' && (
                          <div className="grid grid-cols-3 gap-[2px] w-7 h-7">
                            {[1,0,1,1,1,0,0,1,1].map((v, i) => (
                              <div key={i} className={v ? 'bg-foreground rounded-[2px]' : ''} />
                            ))}
                          </div>
                        )}
                        {key === 'dots' && (
                          <div className="grid grid-cols-3 gap-[2px] w-7 h-7">
                            {[1,0,1,1,1,0,0,1,1].map((v, i) => (
                              <div key={i} className={v ? 'bg-foreground rounded-full' : ''} />
                            ))}
                          </div>
                        )}
                        {key === 'classy' && (
                          <div className="grid grid-cols-3 w-7 h-7 overflow-hidden rounded-[3px]">
                            {[1,1,0,1,1,0,0,0,1].map((v, i) => (
                              <div key={i} className={v ? 'bg-foreground' : ''} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] font-medium leading-tight truncate w-full">{label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight truncate w-full">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Colour presets */}
              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" /> Colour Theme
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {QR_COLOR_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyColorPreset(idx)}
                      className={`p-2 rounded-md border text-center transition-all ${
                        colorPresetIdx === idx
                          ? `${a.borderStrong} ring-2 ${a.ringLight}`
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: p.fg }}
                        />
                        <span
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: p.bg }}
                        />
                      </div>
                      <span className="text-[10px] leading-none">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom colours */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Foreground</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={style.fgColor}
                      onChange={(e) => {
                        setStyle((s) => ({ ...s, fgColor: e.target.value }));
                        setColorPresetIdx(-1);
                      }}
                      className="h-8 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={style.fgColor}
                      onChange={(e) => {
                        setStyle((s) => ({ ...s, fgColor: e.target.value }));
                        setColorPresetIdx(-1);
                      }}
                      className="font-mono text-xs h-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Background</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={style.bgColor}
                      onChange={(e) => {
                        setStyle((s) => ({ ...s, bgColor: e.target.value }));
                        setColorPresetIdx(-1);
                      }}
                      className="h-8 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={style.bgColor}
                      onChange={(e) => {
                        setStyle((s) => ({ ...s, bgColor: e.target.value }));
                        setColorPresetIdx(-1);
                      }}
                      className="font-mono text-xs h-8"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Festival / Badge */}
              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> Festival / Promo Badge
                </Label>
                <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                  {BADGE_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyBadgePreset(idx)}
                      className={`p-2 rounded-md border text-center text-xs transition-all ${
                        badgePresetIdx === idx
                          ? `${a.borderStrong} ring-2 ${a.ringLight}`
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* Custom badge text */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Custom Badge Text</Label>
                  <Input
                    value={style.badgeText}
                    onChange={(e) => {
                      setStyle((s) => ({ ...s, badgeText: e.target.value }));
                      setBadgePresetIdx(-1);
                    }}
                    placeholder='e.g. 🎉 Grand Opening'
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <Separator />

              {/* Logo & Header toggles */}
              <div className="space-y-3">
                <Label className="font-semibold flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" /> Branding
                </Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={style.showHeader}
                      onCheckedChange={(v) =>
                        setStyle((s) => ({ ...s, showHeader: !!v }))
                      }
                    />
                    <span className="text-sm">Show brand header bar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={style.showLogo}
                      onCheckedChange={(v) =>
                        setStyle((s) => ({
                          ...s,
                          showLogo: !!v,
                          ecLevel: v ? 'H' : s.ecLevel,
                          // Default to light variant when enabling
                          logoUrl: v ? appConfig.billing.logoPath : s.logoUrl,
                        }))
                      }
                    />
                    <span className="text-sm">Logo in QR centre</span>
                  </label>
                  {style.showLogo && (
                    <div className="ml-6 space-y-3">
                      <p className="text-xs text-amber-600">
                        Error-correction auto-raised to High for logo overlay
                      </p>
                      <Label className="text-xs font-medium">Logo Variant</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setStyle((s) => ({ ...s, logoUrl: appConfig.billing.logoPath }))}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all ${
                            style.logoUrl === appConfig.billing.logoPath
                              ? `${a.borderStrong} ${a.bg} ${a.bgDarkSolid}`
                              : 'border-muted hover:border-muted-foreground/30'
                          }`}
                        >
                          <div className="h-8 w-8 rounded-full bg-white border flex items-center justify-center overflow-hidden">
                            <img src={appConfig.billing.logoPath} alt="Light" className="h-7 w-7 object-cover rounded-full" />
                          </div>
                          <div>
                            <div className="text-xs font-medium flex items-center gap-1"><Sun className="h-3 w-3" /> Light</div>
                            <div className="text-[10px] text-muted-foreground">For light QR backgrounds</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStyle((s) => ({ ...s, logoUrl: appConfig.billing.logoDarkPath }))}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all ${
                            style.logoUrl === appConfig.billing.logoDarkPath
                              ? `${a.borderStrong} ${a.bg} ${a.bgDarkSolid}`
                              : 'border-muted hover:border-muted-foreground/30'
                          }`}
                        >
                          <div className="h-8 w-8 rounded-full bg-gray-900 border flex items-center justify-center overflow-hidden">
                            <img src={appConfig.billing.logoDarkPath} alt="Dark" className="h-7 w-7 object-cover rounded-full" />
                          </div>
                          <div>
                            <div className="text-xs font-medium flex items-center gap-1"><Moon className="h-3 w-3" /> Dark</div>
                            <div className="text-[10px] text-muted-foreground">For dark QR backgrounds</div>
                          </div>
                        </button>
                      </div>

                      {/* Logo size slider */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Logo Size</Label>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground w-3 text-center">S</span>
                          <input
                            type="range"
                            min={16}
                            max={28}
                            step={1}
                            value={Math.round((style.logoSize ?? 0.24) * 100)}
                            onChange={(e) => setStyle((s) => ({ ...s, logoSize: parseInt(e.target.value) / 100 }))}
                            className="flex-1 h-1.5 accent-brand-500 cursor-pointer"
                          />
                          <span className="text-[10px] text-muted-foreground w-3 text-center">L</span>
                          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                            {Math.round((style.logoSize ?? 0.24) * 100)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

          </Tabs>
        </div>

        {/* ── Full-size preview overlay ── */}
        {showFullPreview && !processing && !completed && (
          <div className="absolute inset-0 z-40 bg-background/97 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-lg p-6">
            <div className="flex items-center justify-between w-full max-w-xs">
              <p className="text-sm font-semibold">Preview</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowFullPreview(false)}>
                ✕ Close
              </Button>
            </div>
            <div className="flex items-center justify-center rounded-xl bg-muted/30 p-4">
              {previewLoading ? (
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              ) : previewUrl ? (
                <img src={previewUrl} alt="QR Preview" className="max-h-[280px] max-w-[280px] rounded-xl shadow-lg border" />
              ) : (
                <p className="text-sm text-muted-foreground">No preview</p>
              )}
            </div>
            <div className="text-center space-y-0.5">
              <p className="text-xs font-mono font-semibold">{finalCodes[0] || '—'}</p>
              <p className="text-[10px] text-muted-foreground">{finalCodes.length} code(s) · CDR · 400 DPI · 1.754 × 1.38 in</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowFullPreview(false)}>Back</Button>
              <Button
                onClick={handleGenerate}
                disabled={processing || completed || finalCodes.length === 0}
                className={`${s.primaryGradient} ${s.primaryGradientHover} text-white`}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate {finalCodes.length} QR{finalCodes.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* ── Progress / completion overlay ── */}
        {(processing || completed) && (
          <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-lg">
            {processing && (
              <div className="w-64 space-y-4 text-center">
                <div className="relative mx-auto h-16 w-16">
                  <Loader2 className={`h-16 w-16 animate-spin ${a.textMuted}`} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Generating {finalCodes.length} QR codes…</p>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
                </div>
              </div>
            )}
            {completed && (
              <div className="text-center space-y-3">
                <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-base font-semibold">Download Complete!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {`ZIP with ${finalCodes.length} CDR-ready QR image(s) · 400 DPI`}
                  </p>
                </div>
                <Button onClick={handleClose} className={`${s.primaryGradient} ${s.primaryGradientHover} text-white mt-2`}>
                  Done
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCompleted(false);
                    setProgress(0);
                    setActiveTab('source');
                  }}
                  className="mx-2"
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Print More
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="px-6 pb-6 pt-2 shrink-0">
          {activeTab === 'source' ? (
            <Button
              onClick={handleNext}
              disabled={typeof customStart !== 'number' || typeof customCount !== 'number' || customCount < 1}
              className={`${s.primaryGradient} ${s.primaryGradientHover} text-white w-full`}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => { refreshPreview(); setShowFullPreview(true); }}
                disabled={previewLoading || finalCodes.length === 0}
                className="flex-1 gap-1.5"
              >
                <Eye className="h-4 w-4" /> Preview
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={processing || completed || finalCodes.length === 0}
                className={`flex-1 ${s.primaryGradient} ${s.primaryGradientHover} text-white`}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── PDF generation ──────────────────────────────────────────────────────────

async function generatePdf(
  codes: string[],
  layout: LayoutSettings,
  style: QrStyleOptions,
  onProgress: (p: number) => void,
): Promise<void> {
  const { cols, rows, qrSizeMm, paperSize } = layout;
  const paper = PAPER_DIMENSIONS[paperSize];
  const codesPerPage = cols * rows;

  // Add 2mm gap between cells for readability
  const gap = 2;
  const totalGridW = cols * qrSizeMm + (cols - 1) * gap;
  const totalGridH = rows * qrSizeMm + (rows - 1) * gap;
  const marginX = (paper.w - totalGridW) / 2;
  const marginY = (paper.h - totalGridH) / 2;
  const cellW = qrSizeMm;
  const cellH = qrSizeMm;

  // 15.75 px/mm ≈ 400 DPI — crisp print output
  const qrPx = Math.round(qrSizeMm * 15.75);

  const isLandscape = paper.w > paper.h;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: isLandscape ? [paper.h, paper.w] : [paper.w, paper.h],
  });

  const totalPages = Math.ceil(codes.length / codesPerPage);
  let idx = 0;

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    for (let row = 0; row < rows && idx < codes.length; row++) {
      for (let col = 0; col < cols && idx < codes.length; col++) {
        const canvas = await renderQrToCanvas(codes[idx], qrPx, style);
        const dataUrl = canvas.toDataURL('image/png');

        const x = marginX + col * (cellW + gap);
        const y = marginY + row * (cellH + gap);

        // Maintain aspect ratio within cell
        const aspect = canvas.height / canvas.width;
        const imgW = cellW - 1;
        const imgH = Math.min(cellH - 1, imgW * aspect);

        pdf.addImage(dataUrl, 'PNG', x + 0.5, y + 0.5, imgW, imgH);

        idx++;
        onProgress((idx / codes.length) * 100);
      }
    }
  }

  const ts = new Date().toISOString().slice(0, 10);
  pdf.save(`QR-Codes-${ts}.pdf`);
}

// ── PNG DPI metadata injection (pHYs chunk) ─────────────────────────────────

// CRC32 lookup table (PNG spec requires CRC on each chunk)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function pngCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Injects a pHYs chunk into a PNG blob so apps like CorelDRAW auto-size the
 * image to the correct physical dimensions at the given DPI.
 */
async function injectPngDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // PNG: 8-byte signature + 25-byte IHDR chunk = insert after byte 33
  const insertAt = 33;
  const ppm = Math.round(dpi / 0.0254); // pixels per metre

  // pHYs chunk: 4 (length) + 4 (type) + 9 (data) + 4 (CRC) = 21 bytes
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9, false);                             // length = 9
  chunk[4] = 0x70; chunk[5] = 0x48; chunk[6] = 0x59; chunk[7] = 0x73; // 'pHYs'
  dv.setUint32(8,  ppm, false);                          // X pixels per unit
  dv.setUint32(12, ppm, false);                          // Y pixels per unit
  chunk[16] = 1;                                         // unit = metre
  dv.setUint32(17, pngCrc32(chunk.slice(4, 17)), false); // CRC

  const result = new Uint8Array(bytes.length + 21);
  result.set(bytes.slice(0, insertAt));
  result.set(chunk, insertAt);
  result.set(bytes.slice(insertAt), insertAt + 21);
  return new Blob([result], { type: 'image/png' });
}

// ── ZIP of individual PNG images ─────────────────────────────────────────────

/** Resize a rendered canvas to exact target dimensions (letter-box fit) */
function resizeCanvas(source: HTMLCanvasElement, targetW: number, targetH: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext('2d')!;

  // Fill with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);

  // Scale source to fit within target, maintaining aspect ratio
  const srcAspect = source.width / source.height;
  const tgtAspect = targetW / targetH;
  let drawW: number, drawH: number, drawX: number, drawY: number;
  if (srcAspect > tgtAspect) {
    drawW = targetW;
    drawH = targetW / srcAspect;
    drawX = 0;
    drawY = (targetH - drawH) / 2;
  } else {
    drawH = targetH;
    drawW = targetH * srcAspect;
    drawX = (targetW - drawW) / 2;
    drawY = 0;
  }
  ctx.drawImage(source, drawX, drawY, drawW, drawH);
  return out;
}

async function generateImagesZip(
  codes: string[],
  style: QrStyleOptions,
  onProgress: (p: number) => void,
  resolution: number = 800,
  targetSize?: { w: number; h: number },
  dpi?: number,
): Promise<void> {
  const toFinalBlob = async (code: string): Promise<Blob> => {
    const canvas = await renderQrToCanvas(code, resolution, style);
    const sized = targetSize ? resizeCanvas(canvas, targetSize.w, targetSize.h) : canvas;
    let blob = await new Promise<Blob>((res) => sized.toBlob((b) => res(b!), 'image/png'));
    if (dpi) blob = await injectPngDpi(blob, dpi);
    return blob;
  };

  // Single code → direct PNG download (no ZIP wrapper)
  if (codes.length === 1) {
    onProgress(80);
    const blob = await toFinalBlob(codes[0]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR-${codes[0]}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onProgress(100);
    return;
  }

  // Multiple codes → ZIP
  const zip = new JSZip();
  const folder = zip.folder('QR-Codes')!;

  for (let i = 0; i < codes.length; i++) {
    const blob = await toFinalBlob(codes[i]);
    folder.file(`QR-${codes[i]}.png`, blob);
    onProgress(((i + 1) / codes.length) * 90);
  }

  // 90–100% for ZIP compression
  onProgress(92);
  const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
    onProgress(90 + (meta.percent / 100) * 10);
  });

  // Download the ZIP file
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 10);
  a.download = `QR-Codes-${ts}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
