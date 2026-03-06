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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

import { Separator } from '@/components/ui/separator';
import {
  Download,
  Printer,
  FileImage,
  Loader2,
  CheckCircle,
  Palette,
  LayoutGrid,
  Filter,
  Eye,
  QrCode as QrCodeIcon,
  Image as ImageIcon,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import type { QrPrefix } from '@/types';
import {
  type QrStyleOptions,
  DEFAULT_QR_STYLE,
  QR_COLOR_PRESETS,
  BADGE_PRESETS,
  renderQrToCanvas,
} from '@/lib/qr-styles';

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
type OutputFormat = 'pdf' | 'png';
type PaperSize = 'a4' | 'letter' | 'a5';

interface LayoutSettings {
  cols: number;
  rows: number;
  qrSizeMm: number;
  paperSize: PaperSize;
}

const PAPER_DIMENSIONS: Record<PaperSize, { w: number; h: number; label: string }> = {
  a4:     { w: 210, h: 297, label: 'A4 (210 × 297 mm)' },
  letter: { w: 216, h: 279, label: 'Letter (216 × 279 mm)' },
  a5:     { w: 148, h: 210, label: 'A5 (148 × 210 mm)' },
};

const LAYOUT_PRESETS: { label: string; cols: number; rows: number; qrMm: number }[] = [
  { label: '3 × 5 (Large)',    cols: 3, rows: 5,  qrMm: 50 },
  { label: '4 × 6 (Medium)',   cols: 4, rows: 6,  qrMm: 40 },
  { label: '5 × 8 (Compact)',  cols: 5, rows: 8,  qrMm: 30 },
  { label: '6 × 9 (Dense)',    cols: 6, rows: 9,  qrMm: 25 },
  { label: '8 × 11 (Tiny)',    cols: 8, rows: 11, qrMm: 18 },
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
  const [sourceMode, setSourceMode] = useState<SourceMode>('passed');
  const [customPrefix, setCustomPrefix] = useState('');
  const [customStart, setCustomStart] = useState(1);
  const [customCount, setCustomCount] = useState(100);

  // ── Layout tab state
  const [layoutPresetIdx, setLayoutPresetIdx] = useState(1); // default 4×6
  const [layout, setLayout] = useState<LayoutSettings>({
    cols: 4,
    rows: 6,
    qrSizeMm: 40,
    paperSize: 'a4',
  });

  // ── Style tab state
  const [style, setStyle] = useState<QrStyleOptions>({ ...DEFAULT_QR_STYLE });
  const [colorPresetIdx, setColorPresetIdx] = useState(0);
  const [badgePresetIdx, setBadgePresetIdx] = useState(0);

  // ── Output
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('pdf');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  // ── Preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Derive final code list
  const finalCodes = useMemo(() => {
    if (sourceMode === 'passed') return codes;
    if (!customPrefix) return [];
    const result: string[] = [];
    for (let i = 0; i < customCount; i++) {
      const num = customStart + i;
      result.push(`${customPrefix}-${String(num).padStart(4, '0')}`);
    }
    return result;
  }, [sourceMode, codes, customPrefix, customStart, customCount]);

  const codesPerPage = layout.cols * layout.rows;
  const totalPages = Math.ceil(finalCodes.length / codesPerPage);

  // ── Apply layout preset
  const applyLayoutPreset = useCallback((idx: number) => {
    const p = LAYOUT_PRESETS[idx];
    if (!p) return;
    setLayoutPresetIdx(idx);
    setLayout((prev) => ({ ...prev, cols: p.cols, rows: p.rows, qrSizeMm: p.qrMm }));
  }, []);

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

  // ── Generate live preview (first QR)
  const refreshPreview = useCallback(async () => {
    const sampleCode = finalCodes[0] || 'WA-000-0001';
    setPreviewLoading(true);
    try {
      const canvas = await renderQrToCanvas(sampleCode, 160, style);
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

  // Initialise custom prefix from available prefixes
  useEffect(() => {
    if (prefixes.length > 0 && !customPrefix) {
      setCustomPrefix(prefixes[0].prefix);
    }
  }, [prefixes, customPrefix]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (finalCodes.length === 0) {
      toast.error('No QR codes to process');
      return;
    }
    setProcessing(true);
    setProgress(0);
    setCompleted(false);

    try {
      if (outputFormat === 'png') {
        await downloadIndividualPngs(finalCodes, style, setProgress);
      } else {
        await generatePdf(finalCodes, layout, style, setProgress);
      }
      setCompleted(true);
      toast.success(`Processed ${finalCodes.length} QR codes`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to process QR codes');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (processing) return;
    setCompleted(false);
    setProgress(0);
    onOpenChange(false);
  };

  // ── UI ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <QrCodeIcon className="h-5 w-5 text-teal-500" />
            {title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{finalCodes.length} code(s)</Badge>
              {totalPages > 0 && outputFormat === 'pdf' && (
                <Badge variant="outline">{totalPages} page(s) &bull; {codesPerPage}/page</Badge>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <Tabs defaultValue="source" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="source" className="gap-1 text-xs">
                <Filter className="h-3.5 w-3.5" /> Source
              </TabsTrigger>
              <TabsTrigger value="layout" className="gap-1 text-xs">
                <LayoutGrid className="h-3.5 w-3.5" /> Layout
              </TabsTrigger>
              <TabsTrigger value="style" className="gap-1 text-xs">
                <Palette className="h-3.5 w-3.5" /> Style
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1 text-xs">
                <Eye className="h-3.5 w-3.5" /> Preview
              </TabsTrigger>
            </TabsList>

            {/* ━━━━━━━━ SOURCE ━━━━━━━━ */}
            <TabsContent value="source" className="space-y-4 pb-4">
              {/* Source mode toggle */}
              <div className="space-y-3">
                <Label className="font-semibold">Code Source</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSourceMode('passed')}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      sourceMode === 'passed'
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium text-sm">Current Selection</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Use {codes.length} code(s) from the table
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMode('custom')}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      sourceMode === 'custom'
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium text-sm">Custom Range</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Choose prefix &amp; range
                    </div>
                  </button>
                </div>
              </div>

              {/* Custom range config */}
              {sourceMode === 'custom' && (
                <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prefix</Label>
                    {prefixes.length > 0 ? (
                      <Select value={customPrefix} onValueChange={setCustomPrefix}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select prefix" />
                        </SelectTrigger>
                        <SelectContent>
                          {prefixes.map((p) => (
                            <SelectItem key={p.id} value={p.prefix}>
                              {p.prefix}
                              {p.description && (
                                <span className="ml-2 text-muted-foreground">— {p.description}</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={customPrefix}
                        onChange={(e) => setCustomPrefix(e.target.value.toUpperCase())}
                        placeholder="e.g. WA-499"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Start Number</Label>
                      <Input
                        type="number"
                        min={1}
                        max={9999}
                        value={customStart}
                        onChange={(e) => setCustomStart(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Total Codes</Label>
                      <Input
                        type="number"
                        min={1}
                        max={9999}
                        value={customCount}
                        onChange={(e) => setCustomCount(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>
                  </div>

                  {customPrefix && (
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
              )}
            </TabsContent>

            {/* ━━━━━━━━ LAYOUT ━━━━━━━━ */}
            <TabsContent value="layout" className="space-y-4 pb-4">
              {/* Output format */}
              <div className="space-y-2">
                <Label className="font-semibold">Output Format</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOutputFormat('pdf')}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      outputFormat === 'pdf'
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <Printer className="h-4 w-4 mb-1" />
                    <div className="font-medium text-sm">Print Sheet (PDF)</div>
                    <div className="text-xs text-muted-foreground">Grid layout on paper</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutputFormat('png')}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      outputFormat === 'png'
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <FileImage className="h-4 w-4 mb-1" />
                    <div className="font-medium text-sm">Individual PNGs</div>
                    <div className="text-xs text-muted-foreground">One image per code</div>
                  </button>
                </div>
              </div>

              {/* PDF layout settings */}
              {outputFormat === 'pdf' && (
                <>
                  {/* Paper size */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Paper Size</Label>
                    <Select
                      value={layout.paperSize}
                      onValueChange={(v) =>
                        setLayout((prev) => ({ ...prev, paperSize: v as PaperSize }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAPER_DIMENSIONS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Layout presets */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Layout Preset</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {LAYOUT_PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => applyLayoutPreset(idx)}
                          className={`p-2 rounded-md border text-center text-xs transition-all ${
                            layoutPresetIdx === idx
                              ? 'border-teal-500 bg-teal-50 font-semibold dark:bg-teal-950'
                              : 'border-muted hover:border-muted-foreground/30'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom grid fine-tune */}
                  <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                    <Label className="text-xs font-medium">Fine-tune Grid</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Columns</Label>
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          value={layout.cols}
                          onChange={(e) => {
                            setLayout((prev) => ({
                              ...prev,
                              cols: Math.max(1, parseInt(e.target.value) || 1),
                            }));
                            setLayoutPresetIdx(-1);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Rows</Label>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={layout.rows}
                          onChange={(e) => {
                            setLayout((prev) => ({
                              ...prev,
                              rows: Math.max(1, parseInt(e.target.value) || 1),
                            }));
                            setLayoutPresetIdx(-1);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">QR size (mm)</Label>
                        <Input
                          type="number"
                          min={10}
                          max={80}
                          value={layout.qrSizeMm}
                          onChange={(e) => {
                            setLayout((prev) => ({
                              ...prev,
                              qrSizeMm: Math.max(10, parseInt(e.target.value) || 10),
                            }));
                            setLayoutPresetIdx(-1);
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {codesPerPage} codes per page &bull; {totalPages} page(s) total
                    </p>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ━━━━━━━━ STYLE ━━━━━━━━ */}
            <TabsContent value="style" className="space-y-4 pb-4">
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
                          ? 'border-teal-500 ring-2 ring-teal-200'
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
                          ? 'border-teal-500 ring-2 ring-teal-200'
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
                        }))
                      }
                    />
                    <span className="text-sm">Logo in QR centre</span>
                  </label>
                  {style.showLogo && (
                    <p className="text-xs text-amber-600 ml-6">
                      Error-correction auto-raised to High for logo overlay
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ━━━━━━━━ PREVIEW ━━━━━━━━ */}
            <TabsContent value="preview" className="space-y-4 pb-4">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Live Preview</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshPreview}
                  disabled={previewLoading}
                  className="h-7 text-xs"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1 ${previewLoading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
              </div>

              <div className="flex items-center justify-center p-6 bg-muted/30 rounded-xl min-h-[200px]">
                {previewLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="QR Preview"
                    className="max-h-[240px] rounded-md shadow-md"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No preview available</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Showing first code:{' '}
                <span className="font-mono font-semibold">{finalCodes[0] || '—'}</span>
              </p>

              {/* Quick summary */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Codes:</span>{' '}
                  <span className="font-semibold">{finalCodes.length}</span>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Format:</span>{' '}
                  <span className="font-semibold">
                    {outputFormat === 'pdf' ? 'PDF Sheet' : 'PNG Images'}
                  </span>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Grid:</span>{' '}
                  <span className="font-semibold">
                    {layout.cols} × {layout.rows}
                  </span>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Pages:</span>{' '}
                  <span className="font-semibold">{totalPages}</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Progress / completion ── */}
        {(processing || completed) && (
          <div className="px-6 pb-2">
            {processing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Processing…</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
            {completed && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span>
                  {outputFormat === 'pdf'
                    ? `PDF with ${totalPages} page(s) downloaded!`
                    : `${finalCodes.length} image(s) downloaded!`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="px-6 pb-6 pt-2 shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            {completed ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={processing || completed || finalCodes.length === 0}
            className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing…
              </>
            ) : (
              <>
                {outputFormat === 'pdf' ? (
                  <Printer className="h-4 w-4 mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {outputFormat === 'pdf' ? 'Generate PDF' : 'Download All'}
              </>
            )}
          </Button>
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

  const marginX = Math.max(5, (paper.w - cols * qrSizeMm) / 2);
  const marginY = Math.max(5, (paper.h - rows * qrSizeMm) / 2);
  const cellW = qrSizeMm;
  const cellH = qrSizeMm;

  // px size for canvas rendering – 3× resolution for crisp print
  const qrPx = Math.round(qrSizeMm * 3);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [paper.w, paper.h],
  });

  const totalPages = Math.ceil(codes.length / codesPerPage);
  let idx = 0;

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    for (let row = 0; row < rows && idx < codes.length; row++) {
      for (let col = 0; col < cols && idx < codes.length; col++) {
        const canvas = await renderQrToCanvas(codes[idx], qrPx, style);
        const dataUrl = canvas.toDataURL('image/png');

        const x = marginX + col * cellW;
        const y = marginY + row * cellH;

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

// ── Individual PNG download ─────────────────────────────────────────────────

async function downloadIndividualPngs(
  codes: string[],
  style: QrStyleOptions,
  onProgress: (p: number) => void,
): Promise<void> {
  for (let i = 0; i < codes.length; i++) {
    const canvas = await renderQrToCanvas(codes[i], 200, style);
    const blob = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), 'image/png'),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR-${codes[i]}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await new Promise((r) => setTimeout(r, 80));
    onProgress(((i + 1) / codes.length) * 100);
  }
}
