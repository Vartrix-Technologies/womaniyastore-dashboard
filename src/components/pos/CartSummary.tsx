'use client';

import { formatCurrency } from '@/lib/formatters';
import { Separator } from '@/components/ui/separator';
import type { CartItem } from '@/types/pos.types';

interface CartSummaryProps {
  items: CartItem[];
}

export function CartSummary({ items }: CartSummaryProps) {
  const subtotal = items.reduce((sum, item) => sum + item.originalPrice, 0);
  const total = items.reduce((sum, item) => sum + item.finalPrice, 0);
  const discount = subtotal - total;
  const tax = items.reduce((sum, item) => {
    const taxAmount = (item.finalPrice * item.taxRate) / 100;
    return sum + taxAmount;
  }, 0);
  const grandTotal = total + tax;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal ({items.length} items)</span>
        <span className="font-medium">{formatCurrency(subtotal)}</span>
      </div>

      {discount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Discount</span>
          <span className="font-medium text-green-600">
            -{formatCurrency(discount)}
          </span>
        </div>
      )}

      {tax > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax (GST)</span>
          <span className="font-medium">{formatCurrency(tax)}</span>
        </div>
      )}

      <Separator />

      <div className="flex justify-between text-lg font-bold">
        <span>Total</span>
        <span>{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  );
}
