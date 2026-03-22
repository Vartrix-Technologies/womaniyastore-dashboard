'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, X, Mail, Share2, Receipt, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
      // A4 Layout (existing professional invoice)
      printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${billNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            padding: 20px; 
            max-width: 800px; 
            margin: 0 auto;
            background: white;
          }
          @media print {
            body { padding: 10mm; }
            @page { margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <!-- Header with Logo -->
        <div style="text-align: center; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px;">
          <div style="display: flex; justify-content: center; margin-bottom: 12px;">
            <div style="width: 128px; height: 128px; display: flex; align-items: center; justify-content: center;">
              <img src="/womaniya-logo.png" alt="Womaniya Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" 
                   onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width: 128px; height: 128px; background: black; border-radius: 8px; display: flex; align-items: center; justify-content: center;\\'><span style=\\'color: white; font-size: 2.25rem; font-weight: bold;\\'>W</span></div>';">
            </div>
          </div>
          <h1 style="font-size: 1.875rem; font-weight: bold; letter-spacing: 0.1em; margin-bottom: 8px;">WOMANIYA</h1>
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

        <script>
          // Auto print and close
          window.onload = function() {
            window.print();
            
            // Close window after print dialog is closed
            window.onafterprint = function() {
              window.close();
            };
            
            // Fallback: Close after 2 seconds if window is still open
            // (Handles case when user saves as PDF instead of printing)
            setTimeout(function() {
              window.close();
            }, 2000);
          };
        </script>
      </body>
      </html>
    `;
    } else if (layoutType === 'thermal-80mm' || layoutType === 'thermal-58mm') {
      // Thermal Receipt Layout (80mm or 58mm)
      const width = layoutType === 'thermal-80mm' ? '302px' : '219px';
      const fontSize = layoutType === 'thermal-80mm' ? '12px' : '10px';

      const thermalItemsHTML = saleItems.map((item: any, index: number) => {
        const isManual = !item.inventory_item_id;
        const itemName = isManual
          ? `${item.category_name || 'Item'} - ${item.size_name || 'One Size'}`
          : `${item.inventory_items?.lots?.categories?.name || 'Item'} - ${item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || 'One Size'}`;
        const qrCode = isManual ? '' : (item.inventory_items?.qr_codes?.code || item.qr_code || 'N/A');
        const saleIcon = item.sale_type === 'festival' ? '🟢' : item.sale_type === 'clearance' ? '🔴' : item.sale_type === 'promotion' ? '🔵' : '';

        return `
          <div style="border-bottom: 1px dashed #ddd; padding: 6px 0;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1; font-size: ${fontSize};">
                <strong>${index + 1}. ${itemName}</strong>
                ${saleIcon ? `<span style="margin-left: 4px;">${saleIcon}</span>` : ''}
                ${qrCode ? `<div style="font-size: ${layoutType === 'thermal-80mm' ? '10px' : '9px'}; color: #666; margin-top: 2px;">QR: ${qrCode}</div>` : ''}
              </div>
              <div style="text-align: right; margin-left: 8px; font-size: ${fontSize};">
                ${item.original_price !== item.final_price ?
            `<div style="text-decoration: line-through; color: #999; font-size: ${layoutType === 'thermal-80mm' ? '10px' : '9px'};">${formatCurrency(item.original_price)}</div>
                   <strong>${formatCurrency(item.final_price)}</strong>` :
            `<strong>${formatCurrency(item.final_price)}</strong>`
          }
              </div>
            </div>
          </div>
        `;
      }).join('');

      const thermalSavingsHTML = (festivalSavings > 0 || clearanceSavings > 0 || promotionSavings > 0) ? `
        <div style="margin: 8px 0; padding: 8px; background: #f0f0f0; font-size: ${layoutType === 'thermal-80mm' ? '11px' : '9px'};">
          <strong>💰 Your Savings</strong>
          ${festivalSavings > 0 ? `<div>Festival: ${formatCurrency(festivalSavings)}</div>` : ''}
          ${clearanceSavings > 0 ? `<div>Clearance: ${formatCurrency(clearanceSavings)}</div>` : ''}
          ${promotionSavings > 0 ? `<div>Promotion: ${formatCurrency(promotionSavings)}</div>` : ''}
          <div style="border-top: 1px solid #999; margin-top: 4px; padding-top: 4px;"><strong>Total: ${formatCurrency(festivalSavings + clearanceSavings + promotionSavings)}</strong></div>
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
        <div style="text-align: center; padding-bottom: 8px; border-bottom: 2px solid #000;">
          <div style="font-size: ${layoutType === 'thermal-80mm' ? '18px' : '14px'}; font-weight: bold; letter-spacing: 2px;">${appConfig.billing.receiptHeader}</div>
          <div style="font-size: ${layoutType === 'thermal-80mm' ? '10px' : '8px'}; font-style: italic;">Fashion Forward. Always.</div>
          ${shopDetails ? `
            <div style="font-size: ${layoutType === 'thermal-80mm' ? '9px' : '8px'}; margin-top: 4px;">
              ${shopDetails.address || ''}${shopDetails.phone ? '<br>' + shopDetails.phone : ''}${shopDetails.gst_number ? '<br>GST: ' + shopDetails.gst_number : ''}
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
          ${displaySale.customer_name ? `<div style="margin-top: 4px;">Customer: ${displaySale.customer_name}</div>` : ''}
        </div>

        <div style="border-top: 2px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin: 8px 0;">
          <strong>ITEMS</strong>
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
          <div style="border-top: 2px solid #000; margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; font-size: ${layoutType === 'thermal-80mm' ? '14px' : '12px'};">
            <strong>TOTAL:</strong>
            <strong>${formatCurrency(displaySale.total_amount)}</strong>
          </div>
          <div style="text-align: center; margin-top: 4px; font-size: ${layoutType === 'thermal-80mm' ? '10px' : '9px'};">
            ${displaySale.payment_method.toUpperCase()}
          </div>
        </div>

        <!-- Savings -->
        ${thermalSavingsHTML}

        <!-- Footer -->
        <div style="text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #000; font-size: ${layoutType === 'thermal-80mm' ? '10px' : '8px'};">
          <div style="font-weight: bold; margin-bottom: 4px;">Thank you!</div>
          <div>Visit again</div>
          <div style="margin-top: 8px; padding: 4px; border: 1px dashed #000; display: inline-block;">${billNumber}</div>
        </div>

        <!-- Cut Line -->
        <div style="text-align: center; margin: 12px 0; font-size: 18px;">✂ - - - - - - - - - - - - - -</div>

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
        const stc =
          item.sale_type === 'festival' ? 'background:#f0fdf4;border-color:#bbf7d0;color:#15803d;' :
            item.sale_type === 'clearance' ? 'background:#fef2f2;border-color:#fecaca;color:#991b1b;' :
              item.sale_type === 'promotion' ? 'background:#eff6ff;border-color:#bfdbfe;color:#1e40af;' :
                'background:#f9fafb;';
        const isManual = !item.inventory_item_id;
        const itemName = isManual
          ? `${item.category_name || 'Item'} - ${item.size_name || 'One Size'}`
          : `${item.inventory_items?.lots?.categories?.name || 'Item'} - ${item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || 'One Size'}`;
        const qrCode = isManual ? '' : (item.inventory_items?.qr_codes?.code || item.qr_code || 'N/A');
        const priceHTML = item.original_price !== item.final_price ? `
            <p style="font-size:0.875rem;color:#6b7280;text-decoration:line-through;margin:0;">${formatCurrency(item.original_price)}</p>
            <p style="font-size:1.125rem;font-weight:bold;color:#16a34a;margin:0;">${formatCurrency(item.final_price)}</p>
            <p style="font-size:0.75rem;color:#ea580c;margin:0;">Save ${formatCurrency(item.original_price - item.final_price)}</p>
          ` : `<p style="font-size:1.125rem;font-weight:600;margin:0;">${formatCurrency(item.final_price)}</p>`;
        const badge = hasSaleType ? `<div style="margin-left:20px;margin-top:4px;"><span style="font-size:0.75rem;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:4px;border:1px solid;${item.sale_type === 'festival' ? 'background:#dcfce7;border-color:#86efac;' :
          item.sale_type === 'clearance' ? 'background:#fee2e2;border-color:#fca5a5;' :
            'background:#dbeafe;border-color:#93c5fd;'
          }">${item.sale_type === 'festival' ? '🟢' : item.sale_type === 'clearance' ? '🔴' : '🔵'} ${item.sale_type}</span></div>` : '';
        const reason = (item.discount_reason && !isManual) ? `<p style="font-size:0.75rem;color:#ea580c;margin-left:20px;margin-top:4px;">Reason: ${item.discount_reason}</p>` : '';
        return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px;${stc}"><div style="display:flex;justify-content:space-between;align-items:start;"><div style="flex:1;"><div style="display:flex;align-items:center;gap:8px;"><span style="font-weight:600;">${index + 1}.</span><span style="font-weight:500;">${itemName}</span></div>${qrCode ? `<p style="font-size:0.75rem;color:#6b7280;font-family:monospace;margin-left:20px;margin-top:4px;margin-bottom:0;">QR: ${qrCode}</p>` : ''}${badge}${reason}</div><div style="text-align:right;">${priceHTML}</div></div></div>`;
      }).join('');

      const imgSavingsHTML = (festivalSavings > 0 || clearanceSavings > 0 || promotionSavings > 0) ? `
          <div style="background:linear-gradient(to right,#f0fdf4,#ecfeff);border:2px solid #86efac;border-radius:8px;padding:16px;margin-top:16px;">
            <p style="font-weight:600;color:#15803d;display:flex;align-items:center;gap:8px;margin:0 0 12px 0;"><span style="font-size:1.125rem;">🎉</span> Your Savings</p>
            ${festivalSavings > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:8px;"><span style="color:#16a34a;">Festival Sale</span><span style="font-weight:bold;color:#15803d;">${formatCurrency(festivalSavings)}</span></div>` : ''}
            ${clearanceSavings > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:8px;"><span style="color:#dc2626;">Clearance</span><span style="font-weight:bold;color:#991b1b;">${formatCurrency(clearanceSavings)}</span></div>` : ''}
            ${promotionSavings > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:8px;"><span style="color:#2563eb;">Promotion</span><span style="font-weight:bold;color:#1e40af;">${formatCurrency(promotionSavings)}</span></div>` : ''}
            <div style="border-top:1px solid #86efac;padding-top:8px;margin-top:8px;"></div>
            <div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Total Saved</span><span style="color:#15803d;">${formatCurrency(festivalSavings + clearanceSavings + promotionSavings)}</span></div>
          </div>` : '';

      // Full standalone HTML document — no external CSS, only hex colours
      const billPageHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box;border-color:#e5e5e5;}</style></head><body style="background:#ffffff;">
          <div style="font-family:system-ui,-apple-system,sans-serif;width:480px;padding:24px;background:#ffffff;color:#171717;">
            <div style="text-align:center;padding-bottom:16px;border-bottom:1px solid #e5e7eb;margin-bottom:20px;">
              <div style="display:flex;justify-content:center;margin-bottom:12px;">
                <img src="${appConfig.billing.logoPath}" alt="${appConfig.billing.logoAlt}" style="width:96px;height:96px;object-fit:contain;border-radius:8px;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                <div style="display:none;width:96px;height:96px;background:#000000;border-radius:8px;align-items:center;justify-content:center;"><span style="color:#ffffff;font-size:2rem;font-weight:bold;">${appConfig.brand.logoLetter}</span></div>
              </div>
              <h1 style="font-size:1.5rem;font-weight:bold;letter-spacing:0.1em;margin:0 0 4px 0;">${appConfig.billing.receiptHeader}</h1>
              <p style="font-size:0.8rem;color:#6b7280;font-style:italic;margin:0;">Fashion Forward. Always.</p>
              ${shopDetails ? `<div style="font-size:0.8rem;color:#6b7280;margin-top:8px;">${shopDetails.address ? `<p style="margin:0;">${shopDetails.address}</p>` : ''}${shopDetails.phone ? `<p style="margin:0;">Phone: ${shopDetails.phone}</p>` : ''}${shopDetails.gst_number ? `<p style="margin:0;">GST: ${shopDetails.gst_number}</p>` : ''}</div>` : ''}
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 14px;background:#f9fafb;border-radius:8px;margin-bottom:16px;">
              <div><p style="font-size:0.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 2px 0;">Invoice</p><p style="font-family:monospace;font-size:1rem;font-weight:bold;margin:0;">${billNumber}</p></div>
              <div style="text-align:right;"><p style="font-size:0.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 2px 0;">Date & Time</p><p style="font-weight:600;margin:0;font-size:0.875rem;">${formatDate(displaySale.created_at)}</p><p style="font-size:0.8rem;color:#6b7280;margin:0;">${formatTime(displaySale.created_at)}</p></div>
            </div>
            ${(displaySale.customer_name || displaySale.customer_phone) ? `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#eff6ff;margin-bottom:16px;"><p style="font-size:0.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px 0;">Customer</p>${displaySale.customer_name ? `<p style="font-weight:600;margin:0 0 2px 0;">${displaySale.customer_name}</p>` : ''}${displaySale.customer_phone ? `<p style="font-size:0.8rem;color:#6b7280;margin:0;">Phone: ${displaySale.customer_phone}</p>` : ''}</div>` : ''}
            <div style="margin-bottom:16px;"><p style="font-size:0.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:6px;border-bottom:1px solid #e5e7eb;margin:0 0 10px 0;">Items</p>${imgItemsHTML}</div>
            <div style="border-top:1px solid #e5e7eb;padding-top:12px;">
              <div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:6px;"><span style="color:#6b7280;">Subtotal</span><span style="font-weight:600;">${formatCurrency(displaySale.subtotal_amount)}</span></div>
              ${displaySale.total_discount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:6px;"><span style="color:#6b7280;">Discount</span><span style="font-weight:600;color:#ea580c;">-${formatCurrency(displaySale.total_discount)}</span></div>` : ''}
              ${displaySale.total_tax > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:6px;"><span style="color:#6b7280;">GST (${shopDetails?.tax_rate || 5}%)</span><span style="font-weight:600;">${formatCurrency(displaySale.total_tax)}</span></div>` : ''}
              <div style="border-top:1px solid #e5e7eb;padding-top:10px;margin-top:10px;"></div>
              <div style="display:flex;justify-content:space-between;font-size:1.25rem;font-weight:bold;"><span>TOTAL</span><span style="color:#16a34a;">${formatCurrency(displaySale.total_amount)}</span></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;"><span style="font-size:0.8rem;color:#6b7280;">Payment Method</span><span style="font-size:0.8rem;font-weight:600;text-transform:uppercase;padding:3px 10px;background:#f3f4f6;border-radius:6px;">${displaySale.payment_method}</span></div>
            </div>
            ${imgSavingsHTML}
            <div style="text-align:center;padding-top:20px;border-top:1px solid #e5e7eb;margin-top:20px;">
              <p style="font-weight:600;font-size:1rem;margin:0 0 4px 0;">Thank you for shopping with us!</p>
              <p style="font-size:0.8rem;color:#6b7280;margin:0;">Visit again. Fashion Forward. Always.</p>
            </div>
          </div>
        </body></html>`;

      // Render inside an iframe so NO parent-page styles can leak in
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '540px';
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
        backgroundColor: '#ffffff',
        windowWidth: 540,
      });

      document.body.removeChild(iframe);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 0.92)
      );

      if (!blob) {
        toast.error('Failed to generate image');
        return;
      }

      const file = new File(
        [blob],
        `Invoice_${billNumber}.png`,
        { type: 'image/png' }
      );

      // Share OR download
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${billNumber}`,
        });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Invoice_${billNumber}.png`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success('Bill image downloaded — attach it in WhatsApp!');
      }
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
        {/* Premium header */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0 no-print">
          <DialogTitle className="text-lg flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${s.headerIconGradient} text-white shadow-sm`}>
              <Receipt className="h-4 w-4" />
            </div>
            Bill Preview
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <Badge variant="secondary" className="font-mono font-semibold text-xs">
                {billNumber}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {saleItems.length} item(s)
              </Badge>
              <Badge variant="outline" className="text-xs">
                {formatCurrency(displaySale.total_amount)}
              </Badge>
            </div>
          </DialogDescription>

          {/* Print Options — Collapsible */}
          <Collapsible>
            <div className={`force-light rounded-lg border-2 ${s.accent.border} ${s.accent.bg} px-3 py-1 mt-1`}>
              <CollapsibleTrigger asChild>
                <button className={`flex items-center justify-between w-full pt-2 pb-1.5 text-sm font-medium ${s.accent.text} hover:opacity-80 transition-opacity group`}>
                  <span className="flex items-center gap-1.5">
                    <Share2 className="h-3.5 w-3.5" />
                    Share & Print Options
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2 pb-1 animate-in slide-in-from-top-1 duration-200">
                {/* Primary Actions - Share */}
                <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
                  <Button
                    size="sm"
                    onClick={handleWhatsAppShare}
                    className="gap-2 h-auto py-2.5 flex-col bg-green-600 hover:bg-green-700 text-white"
                  >
                    <div className="text-base">💬</div>
                    <div className="text-xs">
                      <div className="font-semibold">WhatsApp</div>
                    </div>
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleBillImageShare}
                    className="gap-2 h-auto py-2.5 flex-col"
                  >
                    <div className="text-base">🖼️</div>
                    <div className="text-xs">
                      <div className="font-semibold">Bill Image</div>
                    </div>
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleEmailBill}
                    className="gap-2 h-auto py-2.5 flex-col"
                  >
                    <Mail className="h-4 w-4" />
                    <div className="text-xs">
                      <div className="font-semibold">Email / Share</div>
                    </div>
                  </Button>
                </div>

                {/* Secondary Actions - Print */}
                <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrint('a4')}
                    className="gap-1.5 h-auto py-2 flex-col"
                  >
                    <Printer className="h-4 w-4" />
                    <div className="text-[10px] leading-tight font-semibold">A4 Invoice</div>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrint('thermal-80mm')}
                    className="gap-1.5 h-auto py-2 flex-col"
                  >
                    <div className="text-base">🧾</div>
                    <div className="text-[10px] leading-tight font-semibold">80mm Receipt</div>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrint('thermal-58mm')}
                    className="gap-1.5 h-auto py-2 flex-col"
                  >
                    <div className="text-base">📄</div>
                    <div className="text-[10px] leading-tight font-semibold">58mm Receipt</div>
                  </Button>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </DialogHeader>

        <Separator className="no-print" />

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <div className="print-content force-light" ref={billContentRef}>
            {/* Bill Content — always renders in light mode regardless of theme */}
            <div className="bg-white text-black rounded-lg border border-gray-200 p-6 space-y-6">
              {/* Header with Logo */}
              <div className="text-center space-y-3 border-b pb-4">
                <div className="flex justify-center">
                  <div className="w-32 h-32 flex items-center justify-center">
                    <img
                      src={appConfig.billing.logoPath}
                      alt={appConfig.billing.logoAlt}
                      className="w-full h-full object-contain rounded-lg"
                      onError={(e) => {
                        // Fallback to text if image not found
                        e.currentTarget.style.display = 'none';
                        const fallback = document.createElement('div');
                        fallback.className = 'w-32 h-32 bg-black rounded-lg flex items-center justify-center';
                        fallback.innerHTML = `<span class="text-white text-4xl font-bold">${appConfig.brand.logoLetter}</span>`;
                        e.currentTarget.parentElement!.appendChild(fallback);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-wider">{appConfig.billing.receiptHeader}</h1>
                  <p className="text-sm text-muted-foreground italic">Fashion Forward. Always.</p>
                </div>
                {shopDetails && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    {shopDetails.address && <p>{shopDetails.address}</p>}
                    {shopDetails.phone && <p>Phone: {shopDetails.phone}</p>}
                    {shopDetails.gst_number && <p>GST: {shopDetails.gst_number}</p>}
                  </div>
                )}
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-2 gap-4 py-3 bg-muted/30 rounded-lg px-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Invoice</p>
                  <p className="font-mono text-lg font-bold">{billNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Date & Time</p>
                  <p className="font-semibold">{formatDate(displaySale.created_at)}</p>
                  <p className="text-sm text-muted-foreground">{formatTime(displaySale.created_at)}</p>
                </div>
              </div>

              {/* Customer Details */}
              {(displaySale.customer_name || displaySale.customer_phone) && (
                <div className="border rounded-lg p-3 bg-blue-50/30">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Customer Details</p>
                  {displaySale.customer_name && (
                    <p className="font-semibold">{displaySale.customer_name}</p>
                  )}
                  {displaySale.customer_phone && (
                    <p className="text-sm text-muted-foreground">Phone: {displaySale.customer_phone}</p>
                  )}
                </div>
              )}

              {/* Items Table */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b">Items</p>
                <div className="space-y-3">
                  {saleItems.map((item: any, index: number) => {
                    const hasSaleType = item.sold_on_sale && item.sale_type;
                    const saleTypeColor =
                      item.sale_type === 'festival' ? 'bg-green-50 border-green-200 text-green-700' :
                        item.sale_type === 'clearance' ? 'bg-red-50 border-red-200 text-red-700' :
                          item.sale_type === 'promotion' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                            '';

                    return (
                      <div
                        key={index}
                        className={`border rounded-lg p-3 ${hasSaleType ? saleTypeColor : 'bg-muted/10'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{index + 1}.</span>
                              <span className="font-medium">
                                {item.inventory_item_id
                                  ? `${item.inventory_items?.lots?.categories?.name || 'Item'} - ${item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || 'One Size'}`
                                  : `${item.category_name || 'Item'} - ${item.size_name || 'One Size'}`
                                }
                              </span>
                            </div>
                            {item.inventory_item_id && (
                              <p className="text-xs text-muted-foreground font-mono ml-5">
                                QR: {item.inventory_items?.qr_codes?.code || item.qr_code || 'N/A'}
                              </p>
                            )}
                            {hasSaleType && (
                              <div className="ml-5 mt-1 flex items-center gap-1">
                                <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded border ${item.sale_type === 'festival' ? 'bg-green-100 border-green-300' :
                                  item.sale_type === 'clearance' ? 'bg-red-100 border-red-300' :
                                    'bg-blue-100 border-blue-300'
                                  }`}>
                                  {item.sale_type === 'festival' && '🟢'}
                                  {item.sale_type === 'clearance' && '🔴'}
                                  {item.sale_type === 'promotion' && '🔵'}
                                  {' '}{item.sale_type}
                                </span>
                              </div>
                            )}
                            {(item.discount_reason && item.inventory_item_id) && (
                              <p className="text-xs text-orange-600 ml-5 mt-1">
                                Reason: {item.discount_reason}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {item.original_price !== item.final_price ? (
                              <>
                                <p className="text-sm text-muted-foreground line-through">
                                  {formatCurrency(item.original_price)}
                                </p>
                                <p className="text-lg font-bold text-green-600">
                                  {formatCurrency(item.final_price)}
                                </p>
                                <p className="text-xs text-orange-600">
                                  Save {formatCurrency(item.original_price - item.final_price)}
                                </p>
                              </>
                            ) : (
                              <p className="text-lg font-semibold">
                                {formatCurrency(item.final_price)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(displaySale.subtotal_amount)}</span>
                </div>
                {displaySale.total_discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-semibold text-orange-600">-{formatCurrency(displaySale.total_discount)}</span>
                  </div>
                )}
                {displaySale.total_tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST ({shopDetails?.tax_rate || 5}%)</span>
                    <span className="font-semibold">{formatCurrency(displaySale.total_tax)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-xl font-bold pt-2">
                  <span>TOTAL</span>
                  <span className="text-green-600">{formatCurrency(displaySale.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm text-muted-foreground">Payment Method</span>
                  <Badge variant="secondary" className="uppercase">
                    {displaySale.payment_method}
                  </Badge>
                </div>
              </div>

              {/* Sale Type Savings Summary */}
              {(festivalSavings > 0 || clearanceSavings > 0 || promotionSavings > 0) && (
                <>
                  <Separator />
                  <div className="bg-gradient-to-r from-green-50 to-cyan-50 border-2 border-green-200 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-green-700 flex items-center gap-2">
                      <span className="text-lg">🎉</span>
                      Your Savings
                    </p>
                    {festivalSavings > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Festival Sale</span>
                        <span className="font-bold text-green-700">{formatCurrency(festivalSavings)}</span>
                      </div>
                    )}
                    {clearanceSavings > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">Clearance</span>
                        <span className="font-bold text-red-700">{formatCurrency(clearanceSavings)}</span>
                      </div>
                    )}
                    {promotionSavings > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">Promotion</span>
                        <span className="font-bold text-blue-700">{formatCurrency(promotionSavings)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-base font-bold">
                      <span>Total Saved</span>
                      <span className="text-green-700">{formatCurrency(festivalSavings + clearanceSavings + promotionSavings)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Footer */}
              <div className="text-center pt-4 border-t space-y-2">
                <p className="font-semibold text-lg">Thank you for shopping with us!</p>
                <p className="text-sm text-muted-foreground">Visit again. Fashion Forward. Always.</p>
                {/* Barcode placeholder */}
                <div className="pt-3">
                  <div className="inline-block border-2 border-dashed border-muted-foreground/30 px-4 py-2 rounded">
                    <p className="font-mono text-xs text-muted-foreground">{billNumber}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}