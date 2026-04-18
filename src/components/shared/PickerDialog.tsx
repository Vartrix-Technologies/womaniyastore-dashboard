'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { ArrowLeft, Check, Loader2, Plus } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
  /** Render label in monospace (e.g. QR prefix codes) */
  mono?: boolean;
}

export interface PickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  searchPlaceholder?: string;
  items: PickerItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Show "Create / Use …" button when search text doesn't match any item */
  allowCreate?: boolean;
  /** Label for the create button — defaults to "Create" */
  createLabel?: string;
  /** Called when user clicks "Create". Parent should insert record, then close picker. */
  onCreateNew?: (name: string) => void;
  /** True while create is in-flight (shows spinner) */
  creating?: boolean;
  /** Optional heading above the items list */
  groupHeading?: string;
  /** Pre-populate search field on open */
  initialSearchValue?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PickerDialog({
  open,
  onOpenChange,
  title,
  searchPlaceholder = 'Search…',
  items,
  selectedId,
  onSelect,
  allowCreate = false,
  createLabel = 'Create',
  onCreateNew,
  creating = false,
  groupHeading,
  initialSearchValue = '',
}: PickerDialogProps) {
  const [search, setSearch] = useState('');

  // Reset search when dialog opens
  useEffect(() => {
    if (open) setSearch(initialSearchValue);
  }, [open, initialSearchValue]);

  // Back-button interception via URL hash (not history state).
  // URL hashes are not intercepted by Next.js App Router, so they don't
  // cause the router to navigate away and close any parent Sheets/dialogs.
  useEffect(() => {
    if (!open) return;

    const hashId = `picker-${Math.random().toString(36).slice(2)}`;
    const originalHref = window.location.href;
    history.pushState(history.state, '', `${window.location.pathname}${window.location.search}#${hashId}`);

    const onPopState = () => {
      if (window.location.hash === `#${hashId}`) return;
      onOpenChange(false);
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      // If the parent closed us directly (e.g. after a create callback),
      // restore the URL without adding a new history step.
      if (window.location.hash === `#${hashId}`) {
        history.replaceState(history.state, '', originalHref);
      }
    };
  }, [open, onOpenChange]);

  // Close via UI controls (back arrow, item select, dismiss, Escape).
  // Calls history.back() which triggers popstate → handler → onOpenChange(false).
  const close = useCallback(() => {
    history.back();
  }, []);

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) close();
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    close();
  };

  const handleCreate = () => {
    onCreateNew?.(search.trim());
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent dismissible className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={close}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>

        <Command className="border rounded-md">
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[55dvh]">
            <CommandEmpty>
              {allowCreate && search.trim() ? (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded flex items-center gap-2"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Plus className="h-3 w-3" />}
                  {createLabel} &quot;{search.trim()}&quot;
                </button>
              ) : (
                <span className="text-muted-foreground text-xs px-3">
                  {allowCreate ? 'Type to search or create' : 'No results found'}
                </span>
              )}
            </CommandEmpty>
            <CommandGroup heading={groupHeading}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label + (item.sublabel ? ` ${item.sublabel}` : '')}
                  onSelect={() => handleSelect(item.id)}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      selectedId === item.id ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <span className={item.mono ? 'font-mono font-bold' : ''}>
                    {item.label}
                  </span>
                  {item.sublabel && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      ({item.sublabel})
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
