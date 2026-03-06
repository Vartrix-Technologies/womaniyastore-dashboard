'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { Shop } from '@/types';

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------
interface ShopTabProps {
  shopId: string;
  shop: Shop;
  onRefresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// ShopDetailsTab
// ---------------------------------------------------------------------------
export function ShopDetailsTab({ shopId, shop, onRefresh }: ShopTabProps) {
  const [form, setForm] = useState({
    shop_name: shop.shop_name,
    address: shop.address || '',
    phone: shop.phone || '',
    bill_prefix: shop.bill_prefix,
  });

  // Sync form when shop prop changes (e.g. after tax tab saves)
  useEffect(() => {
    setForm({
      shop_name: shop.shop_name,
      address: shop.address || '',
      phone: shop.phone || '',
      bill_prefix: shop.bill_prefix,
    });
  }, [shop]);

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('shops')
        .update({
          shop_name: form.shop_name,
          address: form.address || null,
          phone: form.phone || null,
          bill_prefix: form.bill_prefix,
        })
        .eq('id', shopId);

      if (error) throw error;
      toast.success('Shop settings updated successfully');
      await onRefresh();
    } catch (error: any) {
      console.error('Error updating shop:', error);
      toast.error(error.message || 'Failed to update shop settings');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Shop Information</CardTitle>
        <CardDescription>Update your shop details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shop_name" className="text-sm font-medium">Shop Name *</Label>
            <Input
              id="shop_name"
              value={form.shop_name}
              onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              placeholder="Enter shop name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Contact number"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="address" className="text-sm font-medium">Address</Label>
          <Input
            id="address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Shop address"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bill_prefix" className="text-sm font-medium">Bill Number Prefix</Label>
          <Input
            id="bill_prefix"
            value={form.bill_prefix}
            onChange={(e) => setForm({ ...form, bill_prefix: e.target.value })}
            placeholder="e.g., WMY"
          />
        </div>
        <Button
          onClick={handleSave}
          className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105 active:scale-95 transition-all"
        >
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TaxSettingsTab
// ---------------------------------------------------------------------------
export function TaxSettingsTab({ shopId, shop, onRefresh }: ShopTabProps) {
  const [taxRate, setTaxRate] = useState(shop.tax_rate);

  useEffect(() => {
    setTaxRate(shop.tax_rate);
  }, [shop]);

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('shops')
        .update({ tax_rate: taxRate })
        .eq('id', shopId);

      if (error) throw error;
      toast.success('Tax settings updated successfully');
      await onRefresh();
    } catch (error: any) {
      console.error('Error updating tax:', error);
      toast.error(error.message || 'Failed to update tax settings');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tax Configuration</CardTitle>
        <CardDescription>Set tax rate for sales</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tax_rate" className="text-sm font-medium">Tax Rate (%) *</Label>
          <Input
            id="tax_rate"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={taxRate}
            onChange={(e) => setTaxRate(parseFloat(e.target.value))}
            placeholder="0.00"
          />
          <p className="text-xs text-muted-foreground">Enter the tax percentage applied to sales</p>
        </div>
        <Button
          onClick={handleSave}
          className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105 active:scale-95 transition-all"
        >
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
