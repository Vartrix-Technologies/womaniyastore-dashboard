'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Printer, Download, ChevronDown } from 'lucide-react';
import { formatCurrency, formatDate, formatTime } from '@/lib/formatters';
import { appConfig } from '@/lib/config';

const s = appConfig.styles;
import type { Sale, SaleForList } from '@/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

interface BillPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | SaleForList | null;
}

export function BillPreviewDialog({ open, onOpenChange, sale }: BillPreviewDialogProps) {
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [fullSaleData, setFullSaleData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const billContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sale?.id) {
      fetchFullSaleData();
      if (sale?.shop_id) {
        fetchShopDetails(sale.shop_id);
      }
    }
  }, [sale?.id, sale?.shop_id]);

  const fetchFullSaleData = async () => {
    try {
      setLoading(true);
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            *,
            inventory_items!sale_items_inventory_item_id_fkey (
              id,
              qr_codes (
                code
              ),
              lots (
                categories (
                  name
                ),
                sizes (
                  size_name
                ),
                free_text_size
              )
            )
          )
        `)
        .eq('id', sale!.id)
        .single();

      if (error) throw error;
      setFullSaleData(data);

      // If shop_id wasn't on the initial sale prop (e.g. POS flow),
      // use the fetched data's shop_id to load shop details
      if (!sale?.shop_id && data?.shop_id) {
        fetchShopDetails(data.shop_id);
      }
    } catch (error) {
      console.error('Error fetching full sale data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShopDetails = async (shopId: string) => {
    try {
      setLoading(true);
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();

      if (error) throw error;
      setShopDetails(data);
    } catch (error) {
      console.error('Error fetching shop details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (layoutType: 'a4' | 'thermal-80mm' | 'thermal-58mm' = 'a4') => {
    if (!sale) return;

    const displaySale = fullSaleData || sale;
    const billNumber = `${(displaySale as any).bill_prefix || ''}${displaySale.bill_number}`;
    const saleItems = (displaySale as any).sale_items || [];

    // Calculate sale type savings
    const festivalItems = saleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'festival');
    const clearanceItems = saleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'clearance');
    const promotionItems = saleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'promotion');

    const festivalSavings = festivalItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);
    const clearanceSavings = clearanceItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);
    const promotionSavings = promotionItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);

    // Generate items HTML
    const itemsHTML = saleItems.map((item: any, index: number) => {
      const hasSaleType = item.sold_on_sale && item.sale_type;
      const saleTypeColor =
        item.sale_type === 'festival' ? 'background: #f0fdf4; border-color: #bbf7d0; color: #15803d;' :
          item.sale_type === 'clearance' ? 'background: #fef2f2; border-color: #fecaca; color: #991b1b;' :
            item.sale_type === 'promotion' ? 'background: #eff6ff; border-color: #bfdbfe; color: #1e40af;' :
              'background: #f9fafb;';

      const isManual = !item.inventory_item_id;
      const itemName = isManual
        ? `${item.category_name || 'Item'} - ${item.size_name || 'One Size'}`
        : `${item.inventory_items?.lots?.categories?.name || 'Item'} - ${item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || 'One Size'}`;
      const qrCode = isManual ? '' : (item.inventory_items?.qr_codes?.code || item.qr_code || 'N/A');

      const priceHTML = item.original_price !== item.final_price ? `
        <p style="font-size: 0.875rem; color: #6b7280; text-decoration: line-through; margin: 0;">
          ${formatCurrency(item.original_price)}
        </p>
        <p style="font-size: 1.125rem; font-weight: bold; color: #16a34a; margin: 0;">
          ${formatCurrency(item.final_price)}
        </p>
        <p style="font-size: 0.75rem; color: #ea580c; margin: 0;">
          Save ${formatCurrency(item.original_price - item.final_price)}
        </p>
      ` : `
        <p style="font-size: 1.125rem; font-weight: 600; margin: 0;">
          ${formatCurrency(item.final_price)}
        </p>
      `;

      const saleTypeBadge = hasSaleType ? `
        <div style="margin-left: 20px; margin-top: 4px;">
          <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; border: 1px solid; ${item.sale_type === 'festival' ? 'background: #dcfce7; border-color: #86efac;' :
          item.sale_type === 'clearance' ? 'background: #fee2e2; border-color: #fca5a5;' :
            'background: #dbeafe; border-color: #93c5fd;'
        }">
            ${item.sale_type === 'festival' ? '🟢' : item.sale_type === 'clearance' ? '🔴' : '🔵'}
            ${item.sale_type}
          </span>
        </div>
      ` : '';

      const discountReason = (item.discount_reason && !isManual) ? `
        <p style="font-size: 0.75rem; color: #ea580c; margin-left: 20px; margin-top: 4px;">
          Reason: ${item.discount_reason}
        </p>
      ` : '';

      return `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; ${saleTypeColor}">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 600;">${index + 1}.</span>
                <span style="font-weight: 500;">${itemName}</span>
              </div>
              ${qrCode ? `<p style="font-size: 0.75rem; color: #6b7280; font-family: monospace; margin-left: 20px; margin-top: 4px; margin-bottom: 0;">QR: ${qrCode}</p>` : ''}
              ${saleTypeBadge}
              ${discountReason}
            </div>
            <div style="text-align: right;">
              ${priceHTML}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Generate savings section HTML
    const savingsHTML = (festivalSavings > 0 || clearanceSavings > 0 || promotionSavings > 0) ? `
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;"></div>
      <div style="background: linear-gradient(to right, #f0fdf4, #ecfeff); border: 2px solid #86efac; border-radius: 8px; padding: 16px; margin-top: 16px;">
        <p style="font-weight: 600; color: #15803d; display: flex; align-items: center; gap: 8px; margin: 0 0 12px 0;">
          <span style="font-size: 1.125rem;">🎉</span>
          Your Savings
        </p>
        ${festivalSavings > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 8px;">
            <span style="color: #16a34a;">Festival Sale</span>
            <span style="font-weight: bold; color: #15803d;">${formatCurrency(festivalSavings)}</span>
          </div>
        ` : ''}
        ${clearanceSavings > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 8px;">
            <span style="color: #dc2626;">Clearance</span>
            <span style="font-weight: bold; color: #991b1b;">${formatCurrency(clearanceSavings)}</span>
          </div>
        ` : ''}
        ${promotionSavings > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 8px;">
            <span style="color: #2563eb;">Promotion</span>
            <span style="font-weight: bold; color: #1e40af;">${formatCurrency(promotionSavings)}</span>
          </div>
        ` : ''}
        <div style="border-top: 1px solid #86efac; padding-top: 8px; margin-top: 8px;"></div>
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>Total Saved</span>
          <span style="color: #15803d;">${formatCurrency(festivalSavings + clearanceSavings + promotionSavings)}</span>
        </div>
      </div>
    ` : '';

    // Generate full HTML based on layout type
    let printHTML = '';

    if (layoutType === 'a4') {
      // A4 Layout — rose-branded design matching the bill image
      const a4ItemsHTML = saleItems.map((item: any, index: number) => {
        const hasSaleType = item.sold_on_sale && item.sale_type;
        const isManual = !item.inventory_item_id;
        const itemName = isManual
          ? `${item.category_name || 'Item'} - ${item.size_name || 'One Size'}`
          : `${item.inventory_items?.lots?.categories?.name || 'Item'} - ${item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || 'One Size'}`;
        const qrCode = isManual ? '' : (item.inventory_items?.qr_codes?.code || item.qr_code || '');
        const hasDiscount = item.original_price !== item.final_price;
        const isLast = index === saleItems.length - 1;
        const pricePart = hasDiscount
          ? `<p style="font-size:0.875rem;color:#c4869c;text-decoration:line-through;margin:0;">${formatCurrency(item.original_price)}</p><p style="font-size:1.125rem;font-weight:bold;color:#16a34a;margin:0;">${formatCurrency(item.final_price)}</p><p style="font-size:0.75rem;color:#ea580c;margin:0;">–${formatCurrency(item.original_price - item.final_price)}</p>`
          : `<p style="font-size:1.125rem;font-weight:600;color:#3d0a19;margin:0;">${formatCurrency(item.final_price)}</p>`;
        const saleBadge = hasSaleType
          ? `<span style="display:inline-block;font-size:0.75rem;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:4px;border:1px solid;margin-top:5px;${item.sale_type === 'festival' ? 'background:#dcfce7;border-color:#86efac;color:#15803d;' : item.sale_type === 'clearance' ? 'background:#fee2e2;border-color:#fca5a5;color:#991b1b;' : 'background:#fce7f3;border-color:#f9a8c4;color:#9d174d;'}">${item.sale_type === 'festival' ? '✦ Festival' : item.sale_type === 'clearance' ? '✦ Clearance' : '✦ Promotion'}</span>` : '';
        const discountReason = (item.discount_reason && !isManual) ? `<p style="font-size:0.75rem;color:#ea580c;margin-top:4px;">${item.discount_reason}</p>` : '';
        return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;${isLast ? '' : 'border-bottom:1px solid #fce4ec;'}"><div style="flex:1;padding-right:16px;"><div style="display:flex;align-items:baseline;gap:8px;"><span style="font-weight:600;color:#8c2e56;">${index + 1}.</span><span style="font-weight:500;color:#3d0a19;">${itemName}</span></div>${qrCode ? `<p style="font-size:0.75rem;color:#c4869c;font-family:'Courier New',monospace;margin-top:4px;margin-bottom:0;">${qrCode}</p>` : ''}${saleBadge}${discountReason}</div><div style="text-align:right;flex-shrink:0;">${pricePart}</div></div>`;
      }).join('');

      const a4SavingsHTML = (festivalSavings > 0 || clearanceSavings > 0 || promotionSavings > 0) ? `
        <div style="background:linear-gradient(135deg,#f0fdf4,#f0fff4);border:1.5px solid #86efac;border-radius:10px;padding:16px 18px;margin:0 20px 20px;">
          <p style="font-weight:700;color:#15803d;font-size:0.875rem;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px 0;">🎉 Your Savings</p>
          ${festivalSavings > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:8px;"><span style="color:#16a34a;">Festival Sale</span><span style="font-weight:bold;color:#15803d;">${formatCurrency(festivalSavings)}</span></div>` : ''}
          ${clearanceSavings > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:8px;"><span style="color:#dc2626;">Clearance</span><span style="font-weight:bold;color:#991b1b;">${formatCurrency(clearanceSavings)}</span></div>` : ''}
          ${promotionSavings > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:8px;"><span style="color:#9d174d;">Promotion</span><span style="font-weight:bold;color:#9d174d;">${formatCurrency(promotionSavings)}</span></div>` : ''}
          <div style="border-top:1px dashed #86efac;padding-top:8px;margin-top:8px;display:flex;justify-content:space-between;font-weight:bold;">
            <span style="color:#15803d;">Total Saved</span>
            <span style="font-size:1.125rem;color:#15803d;">${formatCurrency(festivalSavings + clearanceSavings + promotionSavings)}</span>
          </div>
        </div>
      ` : '';

      printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${billNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            background: #fdf0f3;
          }
          @media print {
            body { padding: 8mm; background: white; }
            @page { margin: 8mm; }
          }
        </style>
      </head>
      <body>
        <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(94,26,56,0.15);">

          <!-- Rose branded header -->
          <div style="background:linear-gradient(135deg,#5e1a38 0%,#8c2e56 55%,#5e1a38 100%);padding:28px 32px 22px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
              <div style="flex:1;">
                <div style="font-size:30px;font-weight:800;letter-spacing:3px;color:#ffffff;line-height:1;">${appConfig.billing.receiptHeader}</div>
                <div style="font-size:11px;color:#e8a0b8;margin-top:6px;letter-spacing:2px;text-transform:uppercase;font-weight:500;">Fashion Forward. Always.</div>
                ${shopDetails ? `<div style="font-size:12px;color:#d4869f;margin-top:8px;line-height:1.8;">${shopDetails.address ? `<span>${shopDetails.address}</span>` : ''}${shopDetails.phone ? `<span style="margin-left:12px;">${shopDetails.phone}</span>` : ''}${shopDetails.gst_number ? `<span style="margin-left:12px;">GST: ${shopDetails.gst_number}</span>` : ''}</div>` : ''}
              </div>
              <div style="flex-shrink:0;margin-left:24px;">
                <div style="width:88px;height:88px;background:#fff5f7;border-radius:12px;border:2px solid #f9a8c4;overflow:hidden;padding:7px;display:flex;align-items:center;justify-content:center;">
                  <img src="${appConfig.billing.logoPath}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                  <span style="display:none;font-size:2.25rem;font-weight:800;color:#5e1a38;">${appConfig.brand.logoLetter}</span>
                </div>
              </div>
            </div>
            <!-- Invoice + date strip -->
            <div style="border-top:1px solid #7a2547;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <div style="font-size:10px;color:#e8a0b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:5px;">Invoice</div>
                <div style="font-size:20px;font-weight:700;color:#ffffff;font-family:'Courier New',monospace;letter-spacing:1px;">${billNumber}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:10px;color:#e8a0b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:5px;">Date</div>
                <div style="font-size:14px;font-weight:600;color:#ffe4ef;">${formatDate(displaySale.created_at)}</div>
                <div style="font-size:12px;color:#d4869f;margin-top:3px;">${formatTime(displaySale.created_at)}</div>
              </div>
            </div>
          </div>

          <!-- Customer (if present) -->
          ${(displaySale.customer_name || displaySale.customer_phone) ? `
          <div style="padding:14px 32px;background:#fff5f7;border-bottom:1px solid #fce4ec;">
            <p style="font-size:10px;font-weight:700;color:#c4869c;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Billed To</p>
            ${displaySale.customer_name ? `<p style="font-size:16px;font-weight:600;color:#3d0a19;margin-bottom:3px;">${displaySale.customer_name}</p>` : ''}
            ${displaySale.customer_phone ? `<p style="font-size:13px;color:#9a6070;">${displaySale.customer_phone}</p>` : ''}
          </div>
          ` : ''}

          <!-- Items -->
          <div style="padding:20px 32px 8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:2px solid #8c2e56;margin-bottom:4px;">
              <div style="font-size:10px;font-weight:700;color:#8c2e56;text-transform:uppercase;letter-spacing:1.5px;">Description</div>
              <div style="font-size:10px;font-weight:700;color:#8c2e56;text-transform:uppercase;letter-spacing:1.5px;">Amount</div>
            </div>
            ${a4ItemsHTML}
          </div>

          <!-- Totals -->
          <div style="margin:8px 20px 20px;background:#fff5f7;border-radius:12px;padding:16px 18px;border:1px solid #fce4ec;">
            ${displaySale.subtotal_amount !== displaySale.total_amount ? `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-bottom:10px;">
              <span style="color:#9a6070;">Subtotal</span>
              <span style="font-weight:600;color:#3d0a19;">${formatCurrency(displaySale.subtotal_amount)}</span>
            </div>` : ''}
            ${displaySale.total_discount > 0 ? `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-bottom:10px;">
              <span style="color:#9a6070;">Discount</span>
              <span style="font-weight:600;color:#ea580c;">–${formatCurrency(displaySale.total_discount)}</span>
            </div>` : ''}
            ${displaySale.total_tax > 0 ? `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-bottom:10px;">
              <span style="color:#9a6070;">GST (${shopDetails?.tax_rate || 5}%)</span>
              <span style="font-weight:600;color:#3d0a19;">${formatCurrency(displaySale.total_tax)}</span>
            </div>` : ''}
            <div style="background:linear-gradient(135deg,#5e1a38,#8c2e56);border-radius:9px;padding:14px 16px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
              <span style="color:#fecdd3;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">Total Paid</span>
              <span style="color:#ffffff;font-size:1.625rem;font-weight:800;">${formatCurrency(displaySale.total_amount)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid #fce4ec;">
              <span style="font-size:13px;color:#9a6070;">Payment Method</span>
              <span style="font-size:13px;font-weight:700;text-transform:uppercase;color:#7c1342;letter-spacing:0.5px;">${displaySale.payment_method}</span>
            </div>
          </div>

          <!-- Savings -->
          ${a4SavingsHTML}

          <!-- Rose footer -->
          <div style="background:linear-gradient(135deg,#5e1a38,#8c2e56);padding:24px 32px;text-align:center;">
            <div style="font-size:16px;font-weight:700;color:#ffffff;margin-bottom:6px;">Thank you for shopping with us!</div>
            <div style="font-size:13px;color:#e8a0b8;letter-spacing:0.5px;margin-bottom:16px;">We look forward to seeing you again.</div>
            <div style="display:inline-block;border:1px dashed #7a2547;padding:7px 22px;border-radius:6px;">
              <span style="font-family:'Courier New',monospace;font-size:12px;color:#d4869f;letter-spacing:2px;">${billNumber}</span>
            </div>
          </div>

        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
            setTimeout(function() {
              window.close();
            }, 2000);
          };
        </script>
      </body>
      </html>
    `;
    } else if (layoutType === 'thermal-80mm' || layoutType === 'thermal-58mm') {
      // Thermal Receipt Layout (80mm or 58mm) — brand-updated
      const width = layoutType === 'thermal-80mm' ? '302px' : '219px';
      const fontSize = layoutType === 'thermal-80mm' ? '12px' : '10px';

      const thermalItemsHTML = saleItems.map((item: any, index: number) => {
        const isManual = !item.inventory_item_id;
        const itemName = isManual
          ? `${item.category_name || 'Item'} - ${item.size_name || 'One Size'}`
          : `${item.inventory_items?.lots?.categories?.name || 'Item'} - ${item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || 'One Size'}`;
        const qrCode = isManual ? '' : (item.inventory_items?.qr_codes?.code || item.qr_code || '');
        const saleLabel = item.sale_type === 'festival' ? '[FESTIVAL]' : item.sale_type === 'clearance' ? '[CLEARANCE]' : item.sale_type === 'promotion' ? '[PROMO]' : '';

        return `
          <div style="border-bottom: 1px dashed #ccc; padding: 6px 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1; font-size: ${fontSize};">
                <strong>${index + 1}. ${itemName}</strong>
                ${saleLabel ? `<span style="font-size:${layoutType === 'thermal-80mm' ? '9px' : '8px'};font-weight:bold;"> ${saleLabel}</span>` : ''}
                ${qrCode ? `<div style="font-size: ${layoutType === 'thermal-80mm' ? '9px' : '8px'}; color: #555; margin-top: 2px;">${qrCode}</div>` : ''}
              </div>
              <div style="text-align: right; margin-left: 8px; font-size: ${fontSize};">
                ${item.original_price !== item.final_price
            ? `<div style="text-decoration: line-through; color: #888; font-size: ${layoutType === 'thermal-80mm' ? '10px' : '9px'};">${formatCurrency(item.original_price)}</div><strong>${formatCurrency(item.final_price)}</strong>`
            : `<strong>${formatCurrency(item.final_price)}</strong>`}
              </div>
            </div>
          </div>
        `;
      }).join('');

      const thermalSavingsHTML = (festivalSavings > 0 || clearanceSavings > 0 || promotionSavings > 0) ? `
        <div style="margin: 8px 0; padding: 6px 4px; border: 1px dashed #000; font-size: ${layoutType === 'thermal-80mm' ? '11px' : '9px'};">
          <div style="font-weight:bold;text-align:center;margin-bottom:4px;">** YOUR SAVINGS **</div>
          ${festivalSavings > 0 ? `<div style="display:flex;justify-content:space-between;">Festival: <strong>${formatCurrency(festivalSavings)}</strong></div>` : ''}
          ${clearanceSavings > 0 ? `<div style="display:flex;justify-content:space-between;">Clearance: <strong>${formatCurrency(clearanceSavings)}</strong></div>` : ''}
          ${promotionSavings > 0 ? `<div style="display:flex;justify-content:space-between;">Promotion: <strong>${formatCurrency(promotionSavings)}</strong></div>` : ''}
          <div style="border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; display:flex;justify-content:space-between;"><strong>Total Saved:</strong><strong>${formatCurrency(festivalSavings + clearanceSavings + promotionSavings)}</strong></div>
        </div>
      ` : '';

      printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt ${billNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            width: ${width};
            padding: 8px;
            background: white;
            font-size: ${fontSize};
          }
          @media print {
            body { padding: 0; }
            @page { margin: 0; size: ${layoutType === 'thermal-80mm' ? '80mm auto' : '58mm auto'}; }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div style="text-align: center; padding: 8px 0 10px; border-bottom: 2px solid #000;">
          <div style="font-size: ${layoutType === 'thermal-80mm' ? '20px' : '15px'}; font-weight: bold; letter-spacing: 3px; margin-bottom: 4px;">${appConfig.billing.receiptHeader}</div>
          <div style="font-size: ${layoutType === 'thermal-80mm' ? '10px' : '8px'}; font-style: italic; letter-spacing: 1px;">— Fashion Forward. Always. —</div>
          ${shopDetails ? `
            <div style="font-size: ${layoutType === 'thermal-80mm' ? '9px' : '8px'}; margin-top: 6px; line-height: 1.5;">
              ${shopDetails.address ? `<div>${shopDetails.address}</div>` : ''}${shopDetails.phone ? `<div>${shopDetails.phone}</div>` : ''}${shopDetails.gst_number ? `<div>GST: ${shopDetails.gst_number}</div>` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Bill Details -->
        <div style="margin: 8px 0; font-size: ${layoutType === 'thermal-80mm' ? '11px' : '9px'};">
          <div style="display: flex; justify-content: space-between;">
            <span>Bill: <strong>${billNumber}</strong></span>
            <span>${formatDate(displaySale.created_at)}</span>
          </div>
          <div style="text-align: right; font-size: ${layoutType === 'thermal-80mm' ? '9px' : '8px'};">${formatTime(displaySale.created_at)}</div>
          ${displaySale.customer_name ? `<div style="margin-top: 4px; border-top: 1px dashed #ccc; padding-top: 4px;">Customer: <strong>${displaySale.customer_name}</strong></div>` : ''}
        </div>

        <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 6px 0; text-align: center; font-weight: bold; letter-spacing: 1px; font-size: ${layoutType === 'thermal-80mm' ? '11px' : '9px'};">
          — ITEMS —
        </div>

        <!-- Items -->
        ${thermalItemsHTML}

        <!-- Totals -->
        <div style="border-top: 2px solid #000; margin-top: 8px; padding-top: 8px; font-size: ${fontSize};">
          <div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span>Subtotal:</span>
            <span>${formatCurrency(displaySale.subtotal_amount)}</span>
          </div>
          ${displaySale.total_discount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin: 4px 0;">
              <span>Discount:</span>
              <span>-${formatCurrency(displaySale.total_discount)}</span>
            </div>
          ` : ''}
          ${displaySale.total_tax > 0 ? `
            <div style="display: flex; justify-content: space-between; margin: 4px 0;">
              <span>GST (${shopDetails?.tax_rate || 5}%):</span>
              <span>${formatCurrency(displaySale.total_tax)}</span>
            </div>
          ` : ''}
          <div style="border-top: 2px solid #000; margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between; font-size: ${layoutType === 'thermal-80mm' ? '14px' : '12px'};">
            <strong>TOTAL PAID:</strong>
            <strong>${formatCurrency(displaySale.total_amount)}</strong>
          </div>
          <div style="text-align: center; margin-top: 4px; font-size: ${layoutType === 'thermal-80mm' ? '10px' : '9px'}; font-weight: bold;">
            [ ${displaySale.payment_method.toUpperCase()} ]
          </div>
        </div>

        <!-- Savings -->
        ${thermalSavingsHTML}

        <!-- Footer -->
        <div style="text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #000; font-size: ${layoutType === 'thermal-80mm' ? '10px' : '8px'};">
          <div style="font-weight: bold; margin-bottom: 3px;">Thank you for shopping with us!</div>
          <div style="font-style: italic;">Fashion Forward. Always.</div>
          <div style="margin-top: 8px; padding: 3px 10px; border: 1px dashed #000; display: inline-block;">${billNumber}</div>
        </div>

        <!-- Cut Line -->
        <div style="text-align: center; margin: 12px 0;">- - - ✂ - - - - - - - ✂ - - -</div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
            setTimeout(function() {
              window.close();
            }, 2000);
          };
        </script>
      </body>
      </html>
      `;
    }

    // Open new window and print
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
    }
  };

  const handleEmailBill = async () => {
    if (!sale) return;

    try {
      const displaySale = fullSaleData || sale;
      const billNumber = `${(displaySale as any).bill_prefix || ''}${displaySale.bill_number}`;
      const saleItems = (displaySale as any).sale_items || [];

      // Calculate sale type savings
      const festivalItems = saleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'festival');
      const clearanceItems = saleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'clearance');
      const promotionItems = saleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'promotion');

      const festivalSavings = festivalItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);
      const clearanceSavings = clearanceItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);
      const promotionSavings = promotionItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);

      // Generate items HTML (reuse from print function)
      const itemsHTML = saleItems.map((item: any, index: number) => {
        const hasSaleType = item.sold_on_sale && item.sale_type;
        const saleTypeColor =
          item.sale_type === 'festival' ? 'background: #f0fdf4; border-color: #bbf7d0; color: #15803d;' :
            item.sale_type === 'clearance' ? 'background: #fef2f2; border-color: #fecaca; color: #991b1b;' :
              item.sale_type === 'promotion' ? 'background: #eff6ff; border-color: #bfdbfe; color: #1e40af;' :
                'background: #f9fafb;';

        const isManual = !item.inventory_item_id;
        const itemName = isManual
          ? `${item.category_name || 'Item'} - ${item.size_name || 'One Size'}`
          : `${item.inventory_items?.lots?.categories?.name || 'Item'} - ${item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || 'One Size'}`;
        const qrCode = isManual ? '' : (item.inventory_items?.qr_codes?.code || item.qr_code || 'N/A');

        const priceHTML = item.original_price !== item.final_price ? `
          <p style="font-size: 0.875rem; color: #6b7280; text-decoration: line-through; margin: 0;">
            ${formatCurrency(item.original_price)}
          </p>
          <p style="font-size: 1.125rem; font-weight: bold; color: #16a34a; margin: 0;">
            ${formatCurrency(item.final_price)}
          </p>
          <p style="font-size: 0.75rem; color: #ea580c; margin: 0;">
            Save ${formatCurrency(item.original_price - item.final_price)}
          </p>
        ` : `
          <p style="font-size: 1.125rem; font-weight: 600; margin: 0;">
            ${formatCurrency(item.final_price)}
          </p>
        `;

        const saleTypeBadge = hasSaleType ? `
          <div style="margin-left: 20px; margin-top: 4px;">
            <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; border: 1px solid; ${item.sale_type === 'festival' ? 'background: #dcfce7; border-color: #86efac;' :
            item.sale_type === 'clearance' ? 'background: #fee2e2; border-color: #fca5a5;' :
              'background: #dbeafe; border-color: #93c5fd;'
          }">
              ${item.sale_type === 'festival' ? '🟢' : item.sale_type === 'clearance' ? '🔴' : '🔵'}
              ${item.sale_type}
            </span>
          </div>
        ` : '';

        const discountReason = (item.discount_reason && !isManual) ? `
          <p style="font-size: 0.75rem; color: #ea580c; margin-left: 20px; margin-top: 4px;">
            Reason: ${item.discount_reason}
          </p>
        ` : '';

        return `
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; ${saleTypeColor}">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 600;">${index + 1}.</span>
                  <span style="font-weight: 500;">${itemName}</span>
                </div>
                ${qrCode ? `<p style="font-size: 0.75rem; color: #6b7280; font-family: monospace; margin-left: 20px; margin-top: 4px; margin-bottom: 0;">QR: ${qrCode}</p>` : ''}
                ${saleTypeBadge}
                ${discountReason}
              </div>
              <div style="text-align: right;">
                ${priceHTML}
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Generate savings section HTML
      const savingsHTML = (festivalSavings > 0 || clearanceSavings > 0 || promotionSavings > 0) ? `
        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;"></div>
        <div style="background: linear-gradient(to right, #f0fdf4, #ecfeff); border: 2px solid #86efac; border-radius: 8px; padding: 16px; margin-top: 16px;">
          <p style="font-weight: 600; color: #15803d; display: flex; align-items: center; gap: 8px; margin: 0 0 12px 0;">
            <span style="font-size: 1.125rem;">🎉</span>
            Your Savings
          </p>
          ${festivalSavings > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 8px;">
              <span style="color: #16a34a;">Festival Sale</span>
              <span style="font-weight: bold; color: #15803d;">${formatCurrency(festivalSavings)}</span>
            </div>
          ` : ''}
          ${clearanceSavings > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 8px;">
              <span style="color: #dc2626;">Clearance</span>
              <span style="font-weight: bold; color: #991b1b;">${formatCurrency(clearanceSavings)}</span>
            </div>
          ` : ''}
          ${promotionSavings > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 8px;">
              <span style="color: #2563eb;">Promotion</span>
              <span style="font-weight: bold; color: #1e40af;">${formatCurrency(promotionSavings)}</span>
            </div>
          ` : ''}
          <div style="border-top: 1px solid #86efac; padding-top: 8px; margin-top: 8px;"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Total Saved</span>
            <span style="color: #15803d;">${formatCurrency(festivalSavings + clearanceSavings + promotionSavings)}</span>
          </div>
        </div>
      ` : '';

      // Create clean HTML for PDF (no Tailwind CSS)
      const pdfHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              padding: 20px; 
              max-width: 800px; 
              margin: 0 auto;
              background: white;
            }
          </style>
        </head>
        <body>
          <!-- Header with Logo -->
          <div style="text-align: center; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px;">
            <div style="display: flex; justify-content: center; margin-bottom: 12px;">
              <div style="width: 128px; height: 128px; display: flex; align-items: center; justify-content: center;">
                <div style="width: 128px; height: 128px; background: black; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                  <span style="color: white; font-size: 2.25rem; font-weight: bold;">${appConfig.brand.logoLetter}</span>
                </div>
              </div>
            </div>
            <h1 style="font-size: 1.875rem; font-weight: bold; letter-spacing: 0.1em; margin-bottom: 8px;">${appConfig.billing.receiptHeader}</h1>
            <p style="font-size: 0.875rem; color: #6b7280; font-style: italic;">Fashion Forward. Always.</p>
            ${shopDetails ? `
              <div style="font-size: 0.875rem; color: #6b7280; margin-top: 12px;">
                ${shopDetails.address ? `<p>${shopDetails.address}</p>` : ''}
                ${shopDetails.phone ? `<p>Phone: ${shopDetails.phone}</p>` : ''}
                ${shopDetails.gst_number ? `<p>GST: ${shopDetails.gst_number}</p>` : ''}
              </div>
            ` : ''}
          </div>

          <!-- Invoice Details -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 12px 16px; background: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
            <div>
              <p style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Invoice</p>
              <p style="font-family: monospace; font-size: 1.125rem; font-weight: bold;">${billNumber}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Date & Time</p>
              <p style="font-weight: 600;">${formatDate(displaySale.created_at)}</p>
              <p style="font-size: 0.875rem; color: #6b7280;">${formatTime(displaySale.created_at)}</p>
            </div>
          </div>

          <!-- Customer Details -->
          ${(displaySale.customer_name || displaySale.customer_phone) ? `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #eff6ff; margin-bottom: 24px;">
              <p style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Customer Details</p>
              ${displaySale.customer_name ? `<p style="font-weight: 600; margin-bottom: 4px;">${displaySale.customer_name}</p>` : ''}
              ${displaySale.customer_phone ? `<p style="font-size: 0.875rem; color: #6b7280;">Phone: ${displaySale.customer_phone}</p>` : ''}
            </div>
          ` : ''}

          <!-- Items -->
          <div style="margin-bottom: 24px;">
            <p style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; margin-bottom: 12px;">Items</p>
            ${itemsHTML}
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;"></div>

          <!-- Totals -->
          <div style="margin-top: 16px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 8px;">
              <span style="color: #6b7280;">Subtotal</span>
              <span style="font-weight: 600;">${formatCurrency(displaySale.subtotal_amount)}</span>
            </div>
            ${displaySale.total_discount > 0 ? `
              <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 8px;">
                <span style="color: #6b7280;">Discount</span>
                <span style="font-weight: 600; color: #ea580c;">-${formatCurrency(displaySale.total_discount)}</span>
              </div>
            ` : ''}
            ${displaySale.total_tax > 0 ? `
              <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 8px;">
                <span style="color: #6b7280;">GST (${shopDetails?.tax_rate || 5}%)</span>
                <span style="font-weight: 600;">${formatCurrency(displaySale.total_tax)}</span>
              </div>
            ` : ''}
            <div style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 1.25rem; font-weight: bold; margin-top: 12px;">
              <span>TOTAL</span>
              <span style="color: #16a34a;">${formatCurrency(displaySale.total_amount)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
              <span style="font-size: 0.875rem; color: #6b7280;">Payment Method</span>
              <span style="font-size: 0.875rem; font-weight: 600; text-transform: uppercase; padding: 4px 12px; background: #f3f4f6; border-radius: 6px;">
                ${displaySale.payment_method}
              </span>
            </div>
          </div>

          <!-- Savings Summary -->
          ${savingsHTML}

          <!-- Footer -->
          <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; margin-top: 24px;">
            <p style="font-weight: 600; font-size: 1.125rem; margin-bottom: 8px;">Thank you for shopping with us!</p>
            <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 16px;">Visit again. Fashion Forward. Always.</p>
            <div style="display: inline-block; border: 2px dashed #d1d5db; padding: 8px 16px; border-radius: 4px;">
              <p style="font-family: monospace; font-size: 0.75rem; color: #6b7280;">${billNumber}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Create hidden iframe to render HTML
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '800px';
      iframe.style.height = '1200px';
      document.body.appendChild(iframe);

      // Write HTML to iframe
      iframe.contentDocument!.open();
      iframe.contentDocument!.write(pdfHTML);
      iframe.contentDocument!.close();

      // Wait for iframe to load
      // await new Promise(resolve => setTimeout(resolve, 500));

      await new Promise((resolve) => {
        const images = iframe.contentDocument!.images;

        const check = () => {
          const allLoaded = Array.from(images).every(img => img.complete);
          if (allLoaded) resolve(true);
          else setTimeout(check, 100);
        };

        check();
      });

      // Generate canvas from iframe
      const target =
        (iframe.contentDocument!.body.firstElementChild as HTMLElement) ||
        iframe.contentDocument!.body;

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 540,
      });

      // Clean up iframe
      document.body.removeChild(iframe);

      // Convert canvas to PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // 10mm margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);

      // Convert PDF to blob
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `Invoice_${billNumber}.pdf`, { type: 'application/pdf' });

      // Try Web Share API first (works great on mobile/PWA)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Invoice ${billNumber}`,
          text: `Invoice from ${appConfig.brand.name} - ${billNumber}\nTotal: ${formatCurrency(displaySale.total_amount)}\nDate: ${formatDate(displaySale.created_at)}`,
          files: [pdfFile]
        });
      } else {
        // Fallback: Download PDF and open mailto
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = `Invoice_${billNumber}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);

        // Open mailto with bill details
        const emailSubject = encodeURIComponent(`Invoice ${billNumber} - ${appConfig.brand.name}`);
        const emailBody = encodeURIComponent(
          `Dear Customer,\n\n` +
          `Please find attached your invoice from ${appConfig.brand.name}.\n\n` +
          `Invoice Number: ${billNumber}\n` +
          `Date: ${formatDate(displaySale.created_at)}\n` +
          `Total Amount: ${formatCurrency(displaySale.total_amount)}\n` +
          `Payment Method: ${displaySale.payment_method.toUpperCase()}\n\n` +
          `The PDF invoice has been downloaded to your device. Please attach it to this email.\n\n` +
          `Thank you for shopping with us!\n\n` +
          `Regards,\n` +
          `${appConfig.brand.name}\n` +
          `Fashion Forward. Always.`
        );

        const customerEmail = displaySale.customer_phone ? '' : ''; // Add customer email if available
        window.open(`mailto:${customerEmail}?subject=${emailSubject}&body=${emailBody}`, '_blank');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  const handleBillImageShare = async () => {
    if (!sale) return;

    // --- Generate a bill image using an isolated iframe ---
    // html2canvas cannot handle oklch()/lab() colours that cascade from
    // Tailwind's global `*` selector. Rendering inside an iframe gives us
    // a completely isolated document with zero inherited stylesheets.
    try {
      toast.info('Generating bill image…');

      const imgSaleItems = saleItems;
      const festivalItems = imgSaleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'festival');
      const clearanceItems = imgSaleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'clearance');
      const promotionItems = imgSaleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'promotion');
      const festivalSavings = festivalItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);
      const clearanceSavings = clearanceItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);
      const promotionSavings = promotionItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);

      const imgItemsHTML = imgSaleItems.map((item: any, index: number) => {
        const hasSaleType = item.sold_on_sale && item.sale_type;
        const isManual = !item.inventory_item_id;
        const itemName = isManual
          ? `${item.category_name || 'Item'} — ${item.size_name || 'One Size'}`
          : `${item.inventory_items?.lots?.categories?.name || 'Item'} — ${item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || 'One Size'}`;
        const qrCode = isManual ? '' : (item.inventory_items?.qr_codes?.code || item.qr_code || '');
        const hasDiscount = item.original_price !== item.final_price;
        const pricePart = hasDiscount
          ? `<div style="font-size:10px;color:#c4869c;text-decoration:line-through;text-align:right;margin-bottom:1px;">${formatCurrency(item.original_price)}</div>
             <div style="font-size:14px;font-weight:700;color:#16a34a;text-align:right;line-height:1.1;">${formatCurrency(item.final_price)}</div>
             <div style="font-size:9px;color:#ea580c;text-align:right;margin-top:1px;">–${formatCurrency(item.original_price - item.final_price)}</div>`
          : `<div style="font-size:14px;font-weight:700;color:#3d0a19;text-align:right;">${formatCurrency(item.final_price)}</div>`;
        const saleBadge = hasSaleType ? `<span style="display:inline-block;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:2px 6px;border-radius:20px;margin-top:3px;${
          item.sale_type === 'festival' ? 'background:#dcfce7;color:#15803d;' :
          item.sale_type === 'clearance' ? 'background:#fee2e2;color:#991b1b;' :
          'background:#fce7f3;color:#9d174d;'}">${item.sale_type === 'festival' ? '✦ Festival' : item.sale_type === 'clearance' ? '✦ Clearance' : '✦ Promotion'}</span>` : '';
        const reasonLine = (item.discount_reason && !isManual)
          ? `<div style="font-size:9px;color:#ea580c;margin-top:2px;">${item.discount_reason}</div>` : '';
        const isLast = index === imgSaleItems.length - 1;
        return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #fce4ec;'}">
          <div style="flex:1;padding-right:10px;">
            <div style="font-size:13px;font-weight:600;color:#3d0a19;line-height:1.4;">${itemName}</div>
            ${qrCode ? `<div style="font-size:9px;color:#c4869c;font-family:'Courier New',monospace;margin-top:2px;letter-spacing:0.3px;">${qrCode}</div>` : ''}
            ${saleBadge}${reasonLine}
          </div>
          <div style="flex-shrink:0;text-align:right;">${pricePart}</div>
        </div>`;
      }).join('');

      const totalSavingsAll = festivalSavings + clearanceSavings + promotionSavings;
      const imgSavingsHTML = totalSavingsAll > 0 ? `
        <div style="margin:0 14px 14px;background:linear-gradient(135deg,#f0fdf4,#f0fff4);border:1.5px solid #86efac;border-radius:10px;padding:13px 14px;">
          <div style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Your Savings</div>
          ${festivalSavings > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:5px;"><span style="color:#16a34a;">Festival Sale</span><span style="font-weight:700;color:#15803d;">${formatCurrency(festivalSavings)}</span></div>` : ''}
          ${clearanceSavings > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:5px;"><span style="color:#dc2626;">Clearance</span><span style="font-weight:700;color:#991b1b;">${formatCurrency(clearanceSavings)}</span></div>` : ''}
          ${promotionSavings > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:5px;"><span style="color:#9d174d;">Promotion</span><span style="font-weight:700;color:#9d174d;">${formatCurrency(promotionSavings)}</span></div>` : ''}
          <div style="border-top:1px dashed #86efac;padding-top:8px;margin-top:5px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12px;font-weight:700;color:#15803d;">Total Saved</span>
            <span style="font-size:15px;font-weight:800;color:#15803d;">${formatCurrency(totalSavingsAll)}</span>
          </div>
        </div>` : '';

      // Premium bill image HTML — isolated, no Tailwind, only hex colours
      // Palette: muted dusty rose / mauve — feminine brand identity
      const billPageHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>*{margin:0;padding:0;box-sizing:border-box;} body{background:#fdf0f3;}</style>
      </head><body>
        <div style="font-family:'Segoe UI',system-ui,-apple-system,sans-serif;width:390px;padding:12px;background:#fdf0f3;">
          <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(94,26,56,0.15);">

            <!-- ── Rose branded header ── -->
            <div style="background:linear-gradient(135deg,#5e1a38 0%,#8c2e56 55%,#5e1a38 100%);padding:20px 20px 16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <div style="flex:1;">
                  <div style="font-size:20px;font-weight:800;letter-spacing:2px;color:#ffffff;line-height:1;">${appConfig.billing.receiptHeader}</div>
                  <div style="font-size:9px;color:#e8a0b8;margin-top:5px;letter-spacing:2px;font-weight:500;text-transform:uppercase;">Fashion Forward. Always.</div>
                  ${shopDetails ? `<div style="font-size:10px;color:#d4869f;margin-top:6px;line-height:1.6;">${shopDetails.address ? `<div>${shopDetails.address}</div>` : ''}${shopDetails.phone ? `<div>${shopDetails.phone}</div>` : ''}${shopDetails.gst_number ? `<div>GST: ${shopDetails.gst_number}</div>` : ''}</div>` : ''}
                </div>
                <!-- Logo on cream background so the black Womaniya mark pops -->
                <div style="flex-shrink:0;margin-left:14px;">
                  <div style="width:64px;height:64px;background:#fff5f7;border-radius:10px;border:2px solid #f9a8c4;overflow:hidden;padding:5px;">
                    <img src="${appConfig.billing.logoPath}" alt="" style="display:block;width:50px;height:50px;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                    <span style="display:none;font-size:1.6rem;font-weight:800;color:#5e1a38;line-height:50px;text-align:center;width:50px;">${appConfig.brand.logoLetter}</span>
                  </div>
                </div>
              </div>
              <!-- Invoice + date strip -->
              <div style="border-top:1px solid #7a2547;padding-top:14px;display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <div style="font-size:8px;color:#e8a0b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:4px;">Invoice</div>
                  <div style="font-size:15px;font-weight:700;color:#ffffff;font-family:'Courier New',monospace;letter-spacing:1px;">${billNumber}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:8px;color:#e8a0b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:4px;">Date</div>
                  <div style="font-size:12px;font-weight:600;color:#ffe4ef;">${formatDate(displaySale.created_at)}</div>
                  <div style="font-size:10px;color:#d4869f;margin-top:2px;">${formatTime(displaySale.created_at)}</div>
                </div>
              </div>
            </div>

            <!-- ── Customer (if present) ── -->
            ${(displaySale.customer_name || displaySale.customer_phone) ? `
            <div style="padding:12px 20px;background:#fff5f7;border-bottom:1px solid #fce4ec;">
              <div style="font-size:8px;font-weight:700;color:#c4869c;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:5px;">Billed To</div>
              ${displaySale.customer_name ? `<div style="font-size:14px;font-weight:600;color:#3d0a19;">${displaySale.customer_name}</div>` : ''}
              ${displaySale.customer_phone ? `<div style="font-size:11px;color:#9a6070;margin-top:2px;">${displaySale.customer_phone}</div>` : ''}
            </div>` : ''}

            <!-- ── Items ── -->
            <div style="padding:16px 20px 8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:2px solid #8c2e56;margin-bottom:2px;">
                <div style="font-size:8px;font-weight:700;color:#8c2e56;text-transform:uppercase;letter-spacing:1.5px;">Description</div>
                <div style="font-size:8px;font-weight:700;color:#8c2e56;text-transform:uppercase;letter-spacing:1.5px;">Amount</div>
              </div>
              ${imgItemsHTML}
            </div>

            <!-- ── Totals ── -->
            <div style="margin:6px 14px 14px;background:#fff5f7;border-radius:12px;padding:13px 14px;border:1px solid #fce4ec;">
              ${displaySale.subtotal_amount !== displaySale.total_amount ? `
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:8px;">
                <span style="color:#9a6070;">Subtotal</span>
                <span style="font-weight:600;color:#3d0a19;">${formatCurrency(displaySale.subtotal_amount)}</span>
              </div>` : ''}
              ${displaySale.total_discount > 0 ? `
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:8px;">
                <span style="color:#9a6070;">Discount</span>
                <span style="font-weight:600;color:#ea580c;">–${formatCurrency(displaySale.total_discount)}</span>
              </div>` : ''}
              ${displaySale.total_tax > 0 ? `
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:8px;">
                <span style="color:#9a6070;">GST (${shopDetails?.tax_rate || 5}%)</span>
                <span style="font-weight:600;color:#3d0a19;">${formatCurrency(displaySale.total_tax)}</span>
              </div>` : ''}
              <!-- Total highlight bar -->
              <div style="background:linear-gradient(135deg,#5e1a38,#8c2e56);border-radius:9px;padding:12px 14px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#fecdd3;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">Total Paid</span>
                <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:0.5px;">${formatCurrency(displaySale.total_amount)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:9px;padding-top:9px;border-top:1px solid #fce4ec;">
                <span style="font-size:11px;color:#9a6070;">Payment Method</span>
                <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#7c1342;letter-spacing:0.5px;">${displaySale.payment_method}</span>
              </div>
            </div>

            <!-- ── Savings ── -->
            ${imgSavingsHTML}

            <!-- ── Rose footer ── -->
            <div style="background:linear-gradient(135deg,#5e1a38,#8c2e56);padding:20px;text-align:center;">
              <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:4px;">Thank you for shopping with us!</div>
              <div style="font-size:10px;color:#e8a0b8;letter-spacing:0.5px;margin-bottom:14px;">We look forward to seeing you again.</div>
              <div style="display:inline-block;border:1px dashed #7a2547;padding:6px 18px;border-radius:6px;">
                <span style="font-family:'Courier New',monospace;font-size:10px;color:#d4869f;letter-spacing:2px;">${billNumber}</span>
              </div>
            </div>

          </div>
        </div>
      </body></html>`;

      // Render inside an iframe so NO parent-page styles can leak in
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '390px';
      iframe.style.height = '2000px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      iframe.contentDocument!.open();
      iframe.contentDocument!.write(billPageHTML);
      iframe.contentDocument!.close();

      // Wait for iframe content + logo image to load
      await new Promise(resolve => setTimeout(resolve, 500));

      const target =
        (iframe.contentDocument!.body.firstElementChild as HTMLElement) ||
        iframe.contentDocument!.body;

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#fdf0f3',
        windowWidth: 390,
      });

      document.body.removeChild(iframe);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 0.92)
      );

      if (!blob) {
        toast.error('Failed to generate image');
        return;
      }

      // Always download the PNG directly to the device
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Invoice_${billNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success('Bill image downloaded!');
    } catch (imgError) {
      console.error('Image generation failed, falling back to text:', imgError);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!sale) return;

    try {
      const displaySale = fullSaleData || sale;
      const billNumber = `${(displaySale as any).bill_prefix || ''}${displaySale.bill_number}`;
      const saleItems = (displaySale as any).sale_items || [];

      // Calculate savings
      const totalSavings = saleItems
        .filter((item: any) => item.original_price !== item.final_price)
        .reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);

      // Brief caption to accompany the bill image
      const caption =
        `🛍️ *${appConfig.billing.receiptHeader}*\n` +
        `📋 Invoice: ${billNumber}\n` +
        `📅 ${formatDate(displaySale.created_at)}\n` +
        `💰 Total: ${formatCurrency(displaySale.total_amount)}\n` +
        (totalSavings > 0 ? `🎉 You Saved: ${formatCurrency(totalSavings)}\n` : '') +
        `\nThank you for shopping with us! 🙏`;

      // --- Text-only WhatsApp share ---
      {
        const itemsList = saleItems.map((item: any, index: number) => {
          const isManual = !item.inventory_item_id;
          const itemName = isManual
            ? `${item.category_name || 'Item'} - ${item.size_name || 'One Size'}`
            : `${item.inventory_items?.lots?.categories?.name || 'Item'} - ${item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || 'One Size'}`;
          const price = formatCurrency(item.final_price);
          return `${index + 1}. ${itemName} - ${price}`;
        }).join('\n');

        const message =
          // `🛍️ *${appConfig.billing.receiptHeader}* - Fashion Forward. Always.\n` +
          // `━━━━━━━━━━━━━━━\n` +
          // `📋 *Invoice:* ${billNumber}\n` +
          // `📅 *Date:* ${formatDate(displaySale.created_at)}\n` +
          // `⏰ *Time:* ${formatTime(displaySale.created_at)}\n` +
          // `━━━━━━━━━━━━━━━\n\n` +
          // `*Items Purchased:*\n${itemsList}\n\n` +
          // `━━━━━━━━━━━━━━━\n` +
          // `📦 *Subtotal:* ${formatCurrency(displaySale.subtotal_amount)}\n` +
          // (displaySale.total_discount > 0 ? `🏷️ *Discount:* -${formatCurrency(displaySale.total_discount)}\n` : '') +
          // (displaySale.total_tax > 0 ? `📊 *GST:* ${formatCurrency(displaySale.total_tax)}\n` : '') +
          // `\n💰 *TOTAL:* ${formatCurrency(displaySale.total_amount)}\n` +
          // `💳 *Paid via:* ${displaySale.payment_method.toUpperCase()}\n` +
          // (totalSavings > 0 ? `\n🎉 *You Saved:* ${formatCurrency(totalSavings)}\n` : '') +
          // `\n━━━━━━━━━━━━━━━\n` +
          // `Thank you for shopping with us! 🙏\n` +
          // `_Visit again for more fashion!_`;
          `🛍️ *${appConfig.billing.receiptHeader}*\n` +
          `📋 Invoice: ${billNumber}\n` +
          `📅 ${formatDate(displaySale.created_at)}\n` +
          `💰 Total: ${formatCurrency(displaySale.total_amount)}\n` +
          (totalSavings > 0 ? `🎉 You Saved: ${formatCurrency(totalSavings)}\n` : '') +
          `\nThank you for shopping with us! 🙏`;

        const encodedMessage = encodeURIComponent(message);
        const customerPhone = displaySale.customer_phone?.replace(/[^0-9]/g, '');

        const whatsappUrl = customerPhone
          ? `https://wa.me/${customerPhone.startsWith('91') ? customerPhone : '91' + customerPhone}?text=${encodedMessage}`
          : `https://api.whatsapp.com/send?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
      }
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      toast.error('Failed to share. Please try again.');
    }
  };

  if (!sale) return null;

  const displaySale = fullSaleData || sale;
  const billNumber = `${(displaySale as any).bill_prefix || ''}${displaySale.bill_number}`;
  const saleItems = (displaySale as any).sale_items || [];

  // Calculate sale type savings
  const festivalItems = saleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'festival');
  const clearanceItems = saleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'clearance');
  const promotionItems = saleItems.filter((item: any) => item.sold_on_sale && item.sale_type === 'promotion');

  const festivalSavings = festivalItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);
  const clearanceSavings = clearanceItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);
  const promotionSavings = promotionItems.reduce((sum: number, item: any) => sum + (item.original_price - item.final_price), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header row: title left, close button right (Radix auto-renders the X inside DialogContent) */}
        <DialogHeader className="no-print shrink-0 flex flex-row items-center px-4 py-3 border-b bg-white">
          <DialogTitle className="text-sm font-semibold text-muted-foreground tracking-wide flex-1">
            Invoice&nbsp;<span className="font-mono text-foreground">{billNumber}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Compact action bar */}
        <div className="px-3 py-2.5 shrink-0 no-print border-b flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleWhatsAppShare}
            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs"
          >
            <span>💬</span>
            WhatsApp
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleBillImageShare}
            className="flex-1 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs">
                <Printer className="h-3.5 w-3.5" />
                Print
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handlePrint('a4')}>
                <Printer className="h-4 w-4 mr-2" />
                Print A4
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint('thermal-80mm')}>
                <span className="mr-2 text-sm">🧾</span>
                Print 80mm
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint('thermal-58mm')}>
                <span className="mr-2 text-sm">📄</span>
                Print 58mm
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <div className="print-content force-light" ref={billContentRef}>
            {/* Bill Content — rose brand design, matches downloadable image */}
            <div className="rounded-xl overflow-hidden" style={{boxShadow: '0 4px 24px rgba(94,26,56,0.14)', background: '#fdf0f3'}}>

              {/* ── Rose header ── */}
              <div style={{background: 'linear-gradient(135deg,#5e1a38 0%,#8c2e56 55%,#5e1a38 100%)', padding: '24px 24px 18px'}}>
                {/* Brand row */}
                <div className="flex items-center justify-between" style={{marginBottom: '18px'}}>
                  <div className="flex-1">
                    <h1 style={{fontSize: '22px', fontWeight: 800, letterSpacing: '3px', color: '#ffffff', lineHeight: 1, margin: 0}}>
                      {appConfig.billing.receiptHeader}
                    </h1>
                    <p style={{fontSize: '10px', color: '#e8a0b8', marginTop: '5px', letterSpacing: '2.5px', fontWeight: 500, margin: '5px 0 0'}}>
                      FASHION FORWARD. ALWAYS.
                    </p>
                    {shopDetails && (
                      <div style={{fontSize: '11px', color: '#d4869f', marginTop: '8px', lineHeight: 1.6}}>
                        {shopDetails.address && <div>{shopDetails.address}</div>}
                        {shopDetails.phone && <div>{shopDetails.phone}</div>}
                        {shopDetails.gst_number && <div>GST: {shopDetails.gst_number}</div>}
                      </div>
                    )}
                  </div>
                  {/* Logo on cream background so black mark pops */}
                  <div className="flex-shrink-0" style={{marginLeft: '20px'}}>
                    <div style={{width: '68px', height: '68px', background: '#fff5f7', borderRadius: '12px', border: '2px solid #f9a8c4', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '5px'}}>
                      <img
                        src={appConfig.billing.logoPath}
                        alt={appConfig.billing.logoAlt}
                        style={{width: '100%', height: '100%', objectFit: 'contain'}}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const s = e.currentTarget.nextElementSibling as HTMLElement;
                          if (s) s.style.display = 'block';
                        }}
                      />
                      <span style={{display: 'none', fontSize: '1.75rem', fontWeight: 800, color: '#5e1a38'}}>
                        {appConfig.brand.logoLetter}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Invoice + date strip */}
                <div className="flex justify-between items-start" style={{borderTop: '1px solid #7a2547', paddingTop: '16px'}}>
                  <div>
                    <p style={{fontSize: '9px', color: '#e8a0b8', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, margin: '0 0 4px'}}>Invoice Number</p>
                    <p style={{fontSize: '17px', fontWeight: 700, color: '#ffffff', fontFamily: "'Courier New', monospace", letterSpacing: '1.5px', margin: 0}}>{billNumber}</p>
                  </div>
                  <div className="text-right">
                    <p style={{fontSize: '9px', color: '#e8a0b8', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, margin: '0 0 4px'}}>Date</p>
                    <p style={{fontSize: '13px', fontWeight: 600, color: '#ffe4ef', margin: 0}}>{formatDate(displaySale.created_at)}</p>
                    <p style={{fontSize: '11px', color: '#d4869f', marginTop: '3px'}}>{formatTime(displaySale.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* ── Customer ── */}
              {(displaySale.customer_name || displaySale.customer_phone) && (
                <div style={{padding: '12px 24px', background: '#fff5f7', borderBottom: '1px solid #fce4ec'}}>
                  <p style={{fontSize: '9px', fontWeight: 700, color: '#c4869c', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 5px'}}>Billed To</p>
                  {displaySale.customer_name && <p style={{fontSize: '15px', fontWeight: 600, color: '#3d0a19', margin: 0}}>{displaySale.customer_name}</p>}
                  {displaySale.customer_phone && <p style={{fontSize: '12px', color: '#9a6070', marginTop: '2px'}}>{displaySale.customer_phone}</p>}
                </div>
              )}

              {/* ── Items ── */}
              <div style={{padding: '18px 24px 10px', background: '#ffffff'}}>
                <div className="flex justify-between items-center" style={{paddingBottom: '9px', borderBottom: '2px solid #8c2e56', marginBottom: '2px'}}>
                  <span style={{fontSize: '9px', fontWeight: 700, color: '#8c2e56', textTransform: 'uppercase', letterSpacing: '2px'}}>Description</span>
                  <span style={{fontSize: '9px', fontWeight: 700, color: '#8c2e56', textTransform: 'uppercase', letterSpacing: '2px'}}>Amount</span>
                </div>
                {saleItems.map((item: any, index: number) => {
                  const hasSaleType = item.sold_on_sale && item.sale_type;
                  const isLastItem = index === saleItems.length - 1;
                  const itemName = item.inventory_item_id
                    ? `${item.inventory_items?.lots?.categories?.name || 'Item'} — ${item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || 'One Size'}`
                    : `${item.category_name || 'Item'} — ${item.size_name || 'One Size'}`;
                  const qrCode = item.inventory_item_id ? (item.inventory_items?.qr_codes?.code || item.qr_code || '') : '';
                  return (
                    <div key={index} className="flex justify-between items-start" style={{padding: '11px 0', borderBottom: isLastItem ? 'none' : '1px solid #fce4ec'}}>
                      <div className="flex-1" style={{paddingRight: '12px'}}>
                        <p style={{fontSize: '14px', fontWeight: 600, color: '#3d0a19', lineHeight: 1.4, margin: 0}}>{itemName}</p>
                        {qrCode && <p style={{fontSize: '10px', color: '#c4869c', fontFamily: "'Courier New', monospace", marginTop: '2px'}}>{qrCode}</p>}
                        {hasSaleType && (
                          <span style={{
                            display: 'inline-block', fontSize: '9px', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.8px',
                            padding: '2px 7px', borderRadius: '20px', marginTop: '4px',
                            ...(item.sale_type === 'festival' ? {background: '#dcfce7', color: '#15803d'} :
                               item.sale_type === 'clearance' ? {background: '#fee2e2', color: '#991b1b'} :
                               {background: '#fce7f3', color: '#9d174d'})
                          }}>
                            ✦ {item.sale_type}
                          </span>
                        )}
                        {item.discount_reason && item.inventory_item_id && (
                          <p style={{fontSize: '10px', color: '#ea580c', marginTop: '3px'}}>{item.discount_reason}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {item.original_price !== item.final_price ? (
                          <>
                            <p style={{fontSize: '11px', color: '#c4869c', textDecoration: 'line-through', margin: 0}}>{formatCurrency(item.original_price)}</p>
                            <p style={{fontSize: '16px', fontWeight: 700, color: '#16a34a', margin: 0}}>{formatCurrency(item.final_price)}</p>
                            <p style={{fontSize: '10px', color: '#ea580c', margin: 0}}>–{formatCurrency(item.original_price - item.final_price)}</p>
                          </>
                        ) : (
                          <p style={{fontSize: '16px', fontWeight: 700, color: '#3d0a19', margin: 0}}>{formatCurrency(item.final_price)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Totals ── */}
              <div style={{margin: '8px 16px 16px', background: '#fff5f7', borderRadius: '14px', padding: '14px 16px 16px', border: '1px solid #fce4ec'}}>
                {displaySale.subtotal_amount !== displaySale.total_amount && (
                  <div className="flex justify-between items-center" style={{fontSize: '13px', marginBottom: '8px'}}>
                    <span style={{color: '#9a6070'}}>Subtotal</span>
                    <span style={{fontWeight: 600, color: '#3d0a19'}}>{formatCurrency(displaySale.subtotal_amount)}</span>
                  </div>
                )}
                {displaySale.total_discount > 0 && (
                  <div className="flex justify-between items-center" style={{fontSize: '13px', marginBottom: '8px'}}>
                    <span style={{color: '#9a6070'}}>Discount</span>
                    <span style={{fontWeight: 600, color: '#ea580c'}}>–{formatCurrency(displaySale.total_discount)}</span>
                  </div>
                )}
                {displaySale.total_tax > 0 && (
                  <div className="flex justify-between items-center" style={{fontSize: '13px', marginBottom: '8px'}}>
                    <span style={{color: '#9a6070'}}>GST ({shopDetails?.tax_rate || 5}%)</span>
                    <span style={{fontWeight: 600, color: '#3d0a19'}}>{formatCurrency(displaySale.total_tax)}</span>
                  </div>
                )}
                {/* Total bar */}
                <div className="flex justify-between items-center" style={{background: 'linear-gradient(135deg,#5e1a38,#8c2e56)', borderRadius: '10px', padding: '13px 16px', marginTop: '8px'}}>
                  <span style={{color: '#fecdd3', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px'}}>Total Paid</span>
                  <span style={{color: '#ffffff', fontSize: '22px', fontWeight: 800, letterSpacing: '0.5px'}}>{formatCurrency(displaySale.total_amount)}</span>
                </div>
                {/* Payment method */}
                <div className="flex justify-between items-center" style={{marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #fce4ec'}}>
                  <span style={{fontSize: '11px', color: '#9a6070'}}>Payment Method</span>
                  <span style={{fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#7c1342', letterSpacing: '0.5px'}}>{displaySale.payment_method}</span>
                </div>
              </div>

              {/* ── Savings ── */}
              {(festivalSavings > 0 || clearanceSavings > 0 || promotionSavings > 0) && (
                <div style={{margin: '0 16px 16px', background: 'linear-gradient(135deg,#f0fdf4,#f0fff4)', border: '1.5px solid #86efac', borderRadius: '12px', padding: '14px 16px'}}>
                  <p style={{fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 10px'}}>Your Savings</p>
                  {festivalSavings > 0 && (
                    <div className="flex justify-between items-center" style={{fontSize: '13px', marginBottom: '6px'}}>
                      <span style={{color: '#16a34a'}}>Festival Sale</span>
                      <span style={{fontWeight: 700, color: '#15803d'}}>{formatCurrency(festivalSavings)}</span>
                    </div>
                  )}
                  {clearanceSavings > 0 && (
                    <div className="flex justify-between items-center" style={{fontSize: '13px', marginBottom: '6px'}}>
                      <span style={{color: '#dc2626'}}>Clearance</span>
                      <span style={{fontWeight: 700, color: '#991b1b'}}>{formatCurrency(clearanceSavings)}</span>
                    </div>
                  )}
                  {promotionSavings > 0 && (
                    <div className="flex justify-between items-center" style={{fontSize: '13px', marginBottom: '6px'}}>
                      <span style={{color: '#9d174d'}}>Promotion</span>
                      <span style={{fontWeight: 700, color: '#9d174d'}}>{formatCurrency(promotionSavings)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center" style={{borderTop: '1px dashed #86efac', paddingTop: '9px', marginTop: '6px'}}>
                    <span style={{fontSize: '13px', fontWeight: 700, color: '#15803d'}}>Total Saved</span>
                    <span style={{fontSize: '17px', fontWeight: 800, color: '#15803d'}}>{formatCurrency(festivalSavings + clearanceSavings + promotionSavings)}</span>
                  </div>
                </div>
              )}

              {/* ── Footer ── */}
              <div style={{background: 'linear-gradient(135deg,#5e1a38,#8c2e56)', padding: '22px 24px', textAlign: 'center'}}>
                <p style={{fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: '0 0 5px'}}>Thank you for shopping with us!</p>
                <p style={{fontSize: '11px', color: '#e8a0b8', letterSpacing: '0.5px', margin: '0 0 16px'}}>We look forward to seeing you again.</p>
                <div style={{display: 'inline-block', border: '1px dashed #7a2547', padding: '6px 20px', borderRadius: '6px'}}>
                  <span style={{fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#d4869f', letterSpacing: '2px'}}>{billNumber}</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}