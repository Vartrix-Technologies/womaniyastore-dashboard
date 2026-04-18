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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  ChevronRight,
  ChevronsUpDown,
  Check,
  Sun,
  Moon,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import type { QrPrefix } from '@/types';
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
type PaperSize = 'a3' | 'a4' | 'letter' | 'a5';
type ZipResolution = 'standard' | 'high' | 'ultra';

const ZIP_RESOLUTION_PX: Record<ZipResolution, { px: number; label: string; desc: string }> = {
  standard: { px: 400,  label: 'Standard (400 px)', desc: 'Digital sharing' },
  high:     { px: 800,  label: 'High (800 px)',      desc: 'Print quality' },
  ultra:    { px: 1200, label: 'Ultra HD (1200 px)',  desc: 'Large format' },
};

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
  a3:     { w: 297, h: 420, label: 'A3 (297 × 420 mm)' },
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
  const [sourceMode, setSourceMode] = useState<SourceMode>('custom');
  const [customPrefix, setCustomPrefix] = useState('');
  const [customStart, setCustomStart] = useState<number | ''>('');
  const [customCount, setCustomCount] = useState<number | ''>('');
  const [prefixPopoverOpen, setPrefixPopoverOpen] = useState(false);

  // ── Layout tab state
  const [layoutPresetIdx, setLayoutPresetIdx] = useState(1); // default 4×6
  const [layout, setLayout] = useState<LayoutSettings>({
    cols: 4,
    rows: 6,
    qrSizeMm: 40,
    paperSize: 'a4',
  });
  const [zipResolution, setZipResolution] = useState<ZipResolution>('high');

  // ── Style tab state
  const [style, setStyle] = useState<QrStyleOptions>({ ...DEFAULT_QR_STYLE });
  const [colorPresetIdx, setColorPresetIdx] = useState(0);
  const [badgePresetIdx, setBadgePresetIdx] = useState(0);

  // ── Output
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('zip');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  // ── Preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Track active tab — generate only enabled on Preview
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
      if (outputFormat === 'zip') {
        const resPx = ZIP_RESOLUTION_PX[zipResolution].px;
        await generateImagesZip(finalCodes, style, setProgress, resPx);
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

  const TAB_ORDER = ['source', 'layout', 'style', 'preview'] as const;

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
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <QrCodeIcon className={`h-5 w-5 ${a.textMuted}`} />
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
              {/* Custom range config — always shown */}
              <div className="space-y-3">
                <Label className="font-semibold">Custom Range</Label>
                <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prefix</Label>
                    {prefixes.length > 0 ? (
                      <Popover open={prefixPopoverOpen} onOpenChange={setPrefixPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={prefixPopoverOpen}
                            className="w-full justify-between font-normal text-sm"
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
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search prefixes…" />
                            <CommandList>
                              <CommandEmpty>No prefix found.</CommandEmpty>
                              <CommandGroup>
                                {prefixes.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.prefix} ${p.description || ''}`}
                                    onSelect={() => {
                                      setCustomPrefix(p.prefix);
                                      setPrefixPopoverOpen(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${customPrefix === p.prefix ? 'opacity-100' : 'opacity-0'}`} />
                                    <span className="font-mono font-bold">{p.prefix}</span>
                                    {p.description && (
                                      <span className="ml-2 text-muted-foreground text-xs">
                                        ({p.description})
                                      </span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                        placeholder="e.g. 1"
                        onChange={(e) => {
                          const v = e.target.value;
                          setCustomStart(v === '' ? '' : Math.max(1, parseInt(v) || 1));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Total Codes</Label>
                      <Input
                        type="number"
                        min={1}
                        max={9999}
                        value={customCount}
                        placeholder="e.g. 100"
                        onChange={(e) => {
                          const v = e.target.value;
                          setCustomCount(v === '' ? '' : Math.max(1, parseInt(v) || 1));
                        }}
                      />
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

            {/* ━━━━━━━━ LAYOUT ━━━━━━━━ */}
            <TabsContent value="layout" className="space-y-4 pb-4">
              {/* PDF layout settings — available but not the default path */}
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
                              ? `${a.borderStrong} ${a.bg} font-semibold ${a.bgDarkSolid}`
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

              {/* ZIP resolution settings */}
              {outputFormat === 'zip' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Image Resolution</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(ZIP_RESOLUTION_PX) as [ZipResolution, typeof ZIP_RESOLUTION_PX[ZipResolution]][]).map(([key, val]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setZipResolution(key)}
                        className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                          zipResolution === key
                            ? `${a.borderStrong} ${a.bg} font-semibold ${a.bgDarkSolid}`
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="text-xs font-medium">{val.px} px</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{val.desc}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Higher resolution = sharper print but larger file size
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ━━━━━━━━ STYLE ━━━━━━━━ */}
            <TabsContent value="style" className="space-y-4 pb-4">
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
                      <div className="text-xs font-medium">{label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{desc}</div>
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
                          logoUrl: v ? '/womaniya_logo_lightbg.png' : s.logoUrl,
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
                          onClick={() => setStyle((s) => ({ ...s, logoUrl: '/womaniya_logo_lightbg.png' }))}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all ${
                            style.logoUrl === '/womaniya_logo_lightbg.png'
                              ? `${a.borderStrong} ${a.bg} ${a.bgDarkSolid}`
                              : 'border-muted hover:border-muted-foreground/30'
                          }`}
                        >
                          <div className="h-8 w-8 rounded-full bg-white border flex items-center justify-center overflow-hidden">
                            <img src="/womaniya_logo_lightbg.png" alt="Light" className="h-7 w-7 object-cover rounded-full" />
                          </div>
                          <div>
                            <div className="text-xs font-medium flex items-center gap-1"><Sun className="h-3 w-3" /> Light</div>
                            <div className="text-[10px] text-muted-foreground">For light QR backgrounds</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStyle((s) => ({ ...s, logoUrl: '/womaniya_logo_darkbg.png' }))}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all ${
                            style.logoUrl === '/womaniya_logo_darkbg.png'
                              ? `${a.borderStrong} ${a.bg} ${a.bgDarkSolid}`
                              : 'border-muted hover:border-muted-foreground/30'
                          }`}
                        >
                          <div className="h-8 w-8 rounded-full bg-gray-900 border flex items-center justify-center overflow-hidden">
                            <img src="/womaniya_logo_darkbg.png" alt="Dark" className="h-7 w-7 object-cover rounded-full" />
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
                            max={32}
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

              <div className="flex items-center justify-center p-6 bg-muted/30 rounded-xl min-h-[260px]">
                {previewLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="QR Preview"
                    className="max-h-[300px] rounded-lg shadow-lg border"
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
                    {outputFormat === 'pdf' ? 'PDF Sheet' : 'Images (ZIP)'}
                  </span>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Style:</span>{' '}
                  <span className="font-semibold capitalize">{style.dotStyle ?? 'rounded'}</span>
                </div>
                {outputFormat === 'pdf' ? (
                  <>
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Grid:</span>{' '}
                      <span className="font-semibold">
                        {layout.cols} × {layout.rows}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Resolution:</span>{' '}
                    <span className="font-semibold">{ZIP_RESOLUTION_PX[zipResolution].px} px</span>
                  </div>
                )}
                {outputFormat === 'pdf' && (
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Pages:</span>{' '}
                    <span className="font-semibold">{totalPages}</span>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

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
                    {outputFormat === 'pdf'
                      ? `PDF with ${totalPages} page(s) and ${finalCodes.length} QR codes`
                      : `ZIP with ${finalCodes.length} QR code image(s)`}
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
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            Cancel
          </Button>
          {activeTab !== 'preview' ? (
            <Button
              onClick={handleNext}
              disabled={activeTab === 'source' && (typeof customStart !== 'number' || typeof customCount !== 'number' || customCount < 1)}
              className={`${s.primaryGradient} ${s.primaryGradientHover} text-white`}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={processing || completed || finalCodes.length === 0}
              className={`${s.primaryGradient} ${s.primaryGradientHover} text-white`}
            >
              <Download className="h-4 w-4 mr-2" />
              Generate
            </Button>
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
  const marginX = Math.max(5, (paper.w - totalGridW) / 2);
  const marginY = Math.max(5, (paper.h - totalGridH) / 2);
  const cellW = qrSizeMm;
  const cellH = qrSizeMm;

  // px size for canvas rendering – 5× resolution for crisp print
  const qrPx = Math.round(qrSizeMm * 5);

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

// ── ZIP of individual PNG images ────────────────────────────────────────────

async function generateImagesZip(
  codes: string[],
  style: QrStyleOptions,
  onProgress: (p: number) => void,
  resolution: number = 800,
): Promise<void> {
  // Single code → direct PNG download (no ZIP wrapper)
  if (codes.length === 1) {
    const canvas = await renderQrToCanvas(codes[0], resolution, style);
    onProgress(80);
    const blob = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), 'image/png'),
    );
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
    const canvas = await renderQrToCanvas(codes[i], resolution, style);
    const blob = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), 'image/png'),
    );
    folder.file(`QR-${codes[i]}.png`, blob);
    onProgress(((i + 1) / codes.length) * 90); // 0–90% for rendering
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
