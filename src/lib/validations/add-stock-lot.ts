import { z } from 'zod';

// ============================================================================
// Add Stock Lot — Zod Validation Schema
// ============================================================================

export const addStockLotSchema = z
  .object({
    prefix_id: z.string().min(1, 'QR prefix is required'),
    category_id: z.string().min(1, 'Category is required'),
    size_id: z.string().min(1, 'Size is required'),
    free_text_size: z.string().optional().default(''),
    vendor_name: z.string().optional().default(''),
    date_of_stock_arrival: z.string().min(1, 'Stock arrival date is required')
      .refine((val) => {
        if (!val) return true;
        const selected = new Date(val);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return selected <= today;
      }, 'Stock arrival date cannot be in the future'),
    quantity: z.coerce
      .number({ error: 'Quantity must be a number' })
      .int('Quantity must be a whole number')
      .min(1, 'At least 1 item required'),
    cost_price_per_unit: z.coerce
      .number({ error: 'Cost price must be a number' })
      .positive('Cost price must be positive'),
    selling_price_default: z.coerce
      .number({ error: 'Selling price must be a number' })
      .positive('Selling price must be positive'),
    tax_rate: z.coerce
      .number()
      .min(0, 'Tax rate cannot be negative')
      .max(100, 'Tax rate cannot exceed 100%')
      .optional()
      .or(z.literal('')),
    sale_type: z.enum(['', 'festival', 'promotion']).optional().default(''),
    min_margin_percent: z.coerce
      .number()
      .min(0, 'Margin cannot be negative')
      .max(100, 'Margin cannot exceed 100%')
      .optional()
      .or(z.literal('')),
    sale_reason: z.string().optional().default(''),
  })
  .refine(
    (data) => data.selling_price_default > data.cost_price_per_unit,
    {
      message: 'Selling price should be higher than cost price',
      path: ['selling_price_default'],
    }
  );

export type AddStockLotFormValues = z.infer<typeof addStockLotSchema>;
