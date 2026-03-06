'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Store, Phone, MapPin, Hash, Percent, Loader2, Check, AlertTriangle } from 'lucide-react';
import { FieldError, fieldErrorClass, useFormErrors } from '@/components/shared/FieldError';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { Shop } from '@/types';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

interface ShopTabProps {
  shopId: string;
  shop: Shop;
  onRefresh: () => Promise<void>;
}

// ─── ShopDetailsTab ──────────────────────────────────────────────────────────

export function ShopDetailsTab({ shopId, shop, onRefresh }: ShopTabProps) {
  const [form, setForm] = useState({
    shop_name: shop.shop_name,
    address: shop.address || '',
    phone: shop.phone || '',
    bill_prefix: shop.bill_prefix,
  });
  const [saving, setSaving] = useState(false);
  const { errors, validateFields, clearFieldError } = useFormErrors<'shop_name'>();

  useEffect(() => {
    setForm({
      shop_name: shop.shop_name,
      address: shop.address || '',
      phone: shop.phone || '',
      bill_prefix: shop.bill_prefix,
    });
  }, [shop]);

  const isDirty =
    form.shop_name !== shop.shop_name ||
    form.address !== (shop.address || '') ||
    form.phone !== (shop.phone || '') ||
    form.bill_prefix !== shop.bill_prefix;

  const handleSave = async () => {
    const valid = validateFields({
      shop_name: [!form.shop_name.trim(), 'Shop name is required'],
    });
    if (!valid) return;
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('shops')
        .update({
          shop_name: form.shop_name.trim(),
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          bill_prefix: form.bill_prefix.trim(),
        })
        .eq('id', shopId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Update failed — you may not have permission to edit shop details');
      toast.success('Shop details saved');
      await onRefresh();
    } catch (error: any) {
      console.error('Error updating shop:', error);
      toast.error(error.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Shop Information</CardTitle>
        <CardDescription>Your store&apos;s profile used on bills and receipts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Shop Name & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shop_name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5" /> Shop Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="shop_name"
              value={form.shop_name}
              onChange={(e) => { setForm({ ...form, shop_name: e.target.value }); clearFieldError('shop_name'); }}
              placeholder="Enter shop name"
              className={`h-11 ${fieldErrorClass(errors.shop_name)}`}
            />
            <FieldError message={errors.shop_name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Phone
            </Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Contact number"
              className="h-11"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label htmlFor="address" className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Address
          </Label>
          <Input
            id="address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Shop address"
            className="h-11"
          />
        </div>

        {/* Bill Prefix */}
        <div className="space-y-2">
          <Label htmlFor="bill_prefix" className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5" /> Bill Prefix
          </Label>
          <Input
            id="bill_prefix"
            value={form.bill_prefix}
            onChange={(e) => setForm({ ...form, bill_prefix: e.target.value })}
            placeholder="e.g., WMY"
            className="h-11 max-w-xs font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Prefixes your bill numbers (e.g. <span className="font-mono font-medium">{form.bill_prefix || 'WMY'}-001</span>)
          </p>
        </div>

        {/* Save bar — only visible when dirty */}
        {isDirty && (
          <div className="flex items-center gap-3 pt-3 border-t">
            <div className="flex-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
              You have unsaved changes
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setForm({
                  shop_name: shop.shop_name,
                  address: shop.address || '',
                  phone: shop.phone || '',
                  bill_prefix: shop.bill_prefix,
                })
              }
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className={`${s.primaryGradient} ${s.primaryGradientHover}`}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── TaxSettingsTab ──────────────────────────────────────────────────────────

export function TaxSettingsTab({ shopId, shop, onRefresh }: ShopTabProps) {
  const [taxRate, setTaxRate] = useState(shop.tax_rate);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { errors, validateFields, clearFieldError } = useFormErrors<'tax_rate'>();

  useEffect(() => {
    setTaxRate(shop.tax_rate);
  }, [shop]);

  const isDirty = taxRate !== shop.tax_rate;

  const handleSave = async () => {
    const valid = validateFields({
      tax_rate: [taxRate < 0 || taxRate > 100, 'Tax rate must be between 0 and 100'],
    });
    if (!valid) return;
    setShowConfirm(true);
  };

  const confirmSave = async () => {
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('shops')
        .update({ tax_rate: taxRate })
        .eq('id', shopId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Update failed — you may not have permission to edit tax settings');
      toast.success('Tax settings saved');
      await onRefresh();
    } catch (error: any) {
      console.error('Error updating tax:', error);
      toast.error(error.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Tax Configuration</CardTitle>
        <CardDescription>Set the default tax rate applied to all sales</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-end gap-3 max-w-xs">
          <div className="flex-1 space-y-2">
            <Label htmlFor="tax_rate" className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5" /> Tax Rate <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Input
                id="tax_rate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={taxRate}
                onChange={(e) => { setTaxRate(parseFloat(e.target.value) || 0); clearFieldError('tax_rate'); }}
                className={`h-11 pr-8 text-lg font-semibold ${fieldErrorClass(errors.tax_rate)}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
            </div>
          </div>
        </div>
        <FieldError message={errors.tax_rate} />
        <p className="text-xs text-muted-foreground">
          This percentage is automatically applied to every sale at the POS
        </p>

        {isDirty && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Changing the tax rate only affects <strong>future sales</strong>. Existing transactions will keep their original tax amounts.
            </p>
          </div>
        )}

        {isDirty && (
          <div className="flex items-center gap-3 pt-3 border-t">
            <div className="flex-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
              You have unsaved changes
            </div>
            <Button variant="ghost" size="sm" onClick={() => setTaxRate(shop.tax_rate)}>
              Discard
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className={`${s.primaryGradient} ${s.primaryGradientHover}`}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

    <ConfirmDialog
      open={showConfirm}
      onOpenChange={setShowConfirm}
      onConfirm={confirmSave}
      title="Change Tax Rate"
      description={`Update tax from ${shop.tax_rate}% to ${taxRate}%? This only affects future sales — existing transactions keep their original tax.`}
      confirmText={saving ? 'Saving...' : 'Confirm'}
    />
    </>
  );
}
