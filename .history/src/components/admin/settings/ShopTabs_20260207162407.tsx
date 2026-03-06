'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Store, Phone, MapPin, Hash, Percent, Loader2, Check } from 'lucide-react';
import type { Shop } from '@/types';

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
    if (!form.shop_name.trim()) {
      toast.error('Shop name is required');
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase
        .from('shops')
        .update({
          shop_name: form.shop_name.trim(),
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          bill_prefix: form.bill_prefix.trim(),
        })
        .eq('id', shopId);
      if (error) throw error;
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
              onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              placeholder="Enter shop name"
              className="h-11"
            />
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
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
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

  useEffect(() => {
    setTaxRate(shop.tax_rate);
  }, [shop]);

  const isDirty = taxRate !== shop.tax_rate;

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('shops')
        .update({ tax_rate: taxRate })
        .eq('id', shopId);
      if (error) throw error;
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
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="h-11 pr-8 text-lg font-semibold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          This percentage is automatically applied to every sale at the POS
        </p>

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
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
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
