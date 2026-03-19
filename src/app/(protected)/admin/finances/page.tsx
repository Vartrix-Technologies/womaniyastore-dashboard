'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { CountUp } from '@/components/shared/CountUp';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { calculateDateRange, exportToCSV, type DateFilterType } from '@/lib/utils';
import { useServerPagination, useSortableTable, useDateFilter, useDebouncedSearch } from '@/hooks';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips';
import { TrendingUp, TrendingDown, DollarSign, Package, CreditCard, ArrowLeft, Plus, PieChart, Loader2, X, Search, Download, Pencil, Trash2, Calendar, FileText } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { FieldError, fieldErrorClass, useFormErrors } from '@/components/shared/FieldError';
import type { FinancialTransactionForList } from '@/types';
import { appConfig } from '@/lib/config/app.config';
import { getCachedStats, setCachedStats } from '@/lib/utils/stats-cache';

const s = appConfig.styles;

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  salesCount: number;
  avgSaleValue: number;
  inventoryValue: number;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

export default function FinancesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4 md:space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-10 w-full bg-muted animate-pulse rounded" />
        <div className="h-64 w-full bg-muted animate-pulse rounded" />
      </div>
    }>
      <FinancesPageContent />
    </Suspense>
  );
}

function FinancesPageContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize from URL params (13.4)
  const initialDateFilter = (searchParams.get('date') as DateFilterType) || 'week';
  const initialCategory = searchParams.get('category') || 'all';

  const { dateFilter, setDateFilter, customRange, setCustomRange, dateRange, startDateISO, endDateISO } = useDateFilter({ initialFilter: initialDateFilter });
  const [summary, setSummary] = useState<FinancialSummary>(() => getCachedStats('finance_summary', {
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    salesCount: 0,
    avgSaleValue: 0,
    inventoryValue: 0,
  }));
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<FinancialTransactionForList[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; amount: number; count: number; color: string }[]>([]);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Edit / Delete / Detail state (13.1 + 13.2)
  const [editExpenseOpen, setEditExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FinancialTransactionForList | null>(null);
  const [detailExpense, setDetailExpense] = useState<FinancialTransactionForList | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => { } });

  // Pagination and filtering for expenses
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 500 });
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [totalCount, setTotalCount] = useState(0);
  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    from,
    to,
    totalPages,
    startItem,
    endItem,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPrevPage,
  } = useServerPagination({ totalCount });
  const { sortBy, sortOrder, toggleSort } = useSortableTable<'occurred_at' | 'amount' | 'description'>({
    initialSortBy: 'occurred_at'
  });
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    category_id: '',
    occurred_at: new Date().toISOString().split('T')[0],
  });
  const [editForm, setEditForm] = useState({
    amount: '',
    description: '',
    category_id: '',
    occurred_at: '',
  });
  const { errors: expenseErrors, validateFields: validateExpenseFields, clearFieldError: clearExpenseError } = useFormErrors<'amount' | 'description' | 'category_id'>();
  const { errors: editErrors, validateFields: validateEditFields, clearFieldError: clearEditError } = useFormErrors<'amount' | 'description' | 'category_id'>();

  // Sync URL params (13.4)
  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFilter !== 'week') params.set('date', dateFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    const qs = params.toString();
    router.replace(`/admin/finances${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [dateFilter, categoryFilter]);

  useEffect(() => {
    if (profile?.shop_id) {
      loadExpenseCategories();
      loadFinancialData();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.shop_id, dateFilter, customRange, currentPage, itemsPerPage, debouncedSearchTerm, categoryFilter, sortBy, sortOrder]);

  const loadExpenseCategories = async () => {
    if (!profile?.shop_id) return;

    const { data, error } = await supabase
      .from('expense_categories')
      .select('id, name')
      .eq('shop_id', profile.shop_id)
      .order('name');

    if (!error && data) {
      setExpenseCategories(data);
    }
  };

  const loadFinancialData = async () => {
    if (!profile?.shop_id) return;

    try {
      setLoading(true);

      // Use date range from useDateFilter hook
      const fromDate = startDateISO;
      const toDate = endDateISO;

      // Build queries
      let salesQuery = supabase
        .from('sales')
        .select('total_amount')
        .eq('shop_id', profile.shop_id)
        .lte('created_at', toDate);

      if (fromDate) {
        salesQuery = salesQuery.gte('created_at', fromDate);
      }

      let transQuery = supabase
        .from('financial_transactions')
        .select('*, expense_category:expense_categories!financial_transactions_expense_category_id_fkey(id, name)', { count: 'exact' })
        .eq('shop_id', profile.shop_id)
        .eq('type', 'expense')
        .lte('occurred_at', toDate);

      if (fromDate) {
        transQuery = transQuery.gte('occurred_at', fromDate);
      }

      // Apply category filter
      if (categoryFilter !== 'all') {
        transQuery = transQuery.eq('expense_category_id', categoryFilter);
      }

      // Apply search filter
      if (debouncedSearchTerm) {
        transQuery = transQuery.ilike('description', `%${debouncedSearchTerm}%`);
      }

      // Apply sorting and pagination
      transQuery = transQuery
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      // Separate stats query for full filtered dataset (not paginated)
      let statsTransQuery = supabase
        .from('financial_transactions')
        .select('amount, expense_category:expense_categories!financial_transactions_expense_category_id_fkey(id, name)')
        .eq('shop_id', profile.shop_id)
        .eq('type', 'expense')
        .lte('occurred_at', toDate);

      if (fromDate) {
        statsTransQuery = statsTransQuery.gte('occurred_at', fromDate);
      }

      // Apply same filters as main query for accurate stats
      if (categoryFilter !== 'all') {
        statsTransQuery = statsTransQuery.eq('expense_category_id', categoryFilter);
      }

      if (debouncedSearchTerm) {
        statsTransQuery = statsTransQuery.ilike('description', `%${debouncedSearchTerm}%`);
      }

      // Build returns/refunds query for the same date range
      let returnsQuery = supabase
        .from('sale_returns')
        .select('refund_amount')
        .eq('shop_id', profile.shop_id)
        .lte('created_at', toDate);

      if (fromDate) {
        returnsQuery = returnsQuery.gte('created_at', fromDate);
      }

      // Parallelize all data fetches for faster load
      const [salesResult, transResult, inventoryResult, statsTransResult, returnsResult] = await Promise.all([
        salesQuery,
        transQuery,
        supabase
          .from('inventory_items')
          .select(`
            id,
            cost_price
          `)
          .eq('shop_id', profile.shop_id)
          .eq('status', 'available'),
        statsTransQuery,
        returnsQuery
      ]);

      // Log individual query errors but don't throw — show partial data
      const queryErrors: string[] = [];
      if (salesResult.error) queryErrors.push(`Sales: ${salesResult.error.message}`);
      if (transResult.error) queryErrors.push(`Expenses: ${transResult.error.message}`);
      if (inventoryResult.error) queryErrors.push(`Inventory: ${inventoryResult.error.message}`);
      if (statsTransResult.error) queryErrors.push(`Expense stats: ${statsTransResult.error.message}`);
      if (returnsResult.error) queryErrors.push(`Returns: ${returnsResult.error.message}`);

      if (queryErrors.length > 0) {
        console.error('Financial query errors:', queryErrors);
        toast.error(`Failed to load: ${queryErrors.join('; ')}`);
      }

      const salesData = salesResult.data;
      const transactionsData = transResult.data;
      const count = transResult.count;
      const inventoryData = inventoryResult.data;
      const statsTransData = statsTransResult.data;
      const returnsData = returnsResult.data;

      // Calculate summary from FULL filtered dataset (using available data)
      const totalRevenue = (salesData as any[] | null)?.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0) || 0;
      const totalRefunds = (returnsData as any[] | null)?.reduce((sum: number, r: any) => sum + (r.refund_amount || 0), 0) || 0;
      const totalExpenses = (statsTransData as any[] | null)?.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0;
      const inventoryValue = (inventoryData as any[] | null)?.reduce((sum: number, item: any) => sum + (item.cost_price || 0), 0) || 0;
      const netRevenue = totalRevenue - totalRefunds;

      const newSummary = {
        totalRevenue: netRevenue,
        totalExpenses,
        netProfit: netRevenue - totalExpenses,
        salesCount: salesData?.length || 0,
        avgSaleValue: salesData && salesData.length > 0 ? netRevenue / salesData.length : 0,
        inventoryValue,
      };
      setSummary(newSummary);
      setCachedStats('finance_summary', newSummary);

      setTransactions(transactionsData || []);
      setTotalCount(count || 0);

      // Calculate category breakdown from FULL filtered dataset (not paginated)
      const breakdown = (statsTransData || []).reduce((acc: any, txn: any) => {
        const catName = txn.expense_category?.name || 'Uncategorized';
        if (!acc[catName]) {
          acc[catName] = { category: catName, amount: 0, count: 0 };
        }
        acc[catName].amount += txn.amount || 0;
        acc[catName].count += 1;
        return acc;
      }, {});

      const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
      const breakdownArray = Object.values(breakdown)
        .sort((a: any, b: any) => b.amount - a.amount)
        .map((item: any, idx: number) => ({ ...item, color: colors[idx % colors.length] }));

      setCategoryBreakdown(breakdownArray);
    } catch (error: any) {
      console.error('Financial data fetch failed:', error);
      toast.error(error?.message || 'Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!profile?.shop_id) return;
    const valid = validateExpenseFields({
      amount: [!expenseForm.amount, 'Amount is required'],
      description: [!expenseForm.description, 'Description is required'],
      category_id: [!expenseForm.category_id, 'Please select a category'],
    });
    if (!valid) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('financial_transactions')
        .insert({
          shop_id: profile.shop_id,
          type: 'expense',
          amount: parseFloat(expenseForm.amount),
          description: expenseForm.description,
          expense_category_id: expenseForm.category_id,
          occurred_at: new Date(expenseForm.occurred_at).toISOString(),
        });

      if (error) throw error;

      toast.success('Expense added successfully');
      setAddExpenseOpen(false);
      setExpenseForm({
        amount: '',
        description: '',
        category_id: '',
        occurred_at: new Date().toISOString().split('T')[0],
      });
      loadFinancialData();
    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error('Failed to add expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!profile?.shop_id || !newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert({
          shop_id: profile.shop_id,
          name: newCategoryName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Category created');
      setNewCategoryName('');
      setShowNewCategory(false);
      await loadExpenseCategories();

      // Auto-select the new category
      if (data) {
        setExpenseForm({ ...expenseForm, category_id: data.id });
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
    }
  };

  // ── Edit expense (13.1) ─────────────────────────────────────────────

  const openEditExpense = (txn: FinancialTransactionForList) => {
    setEditingExpense(txn);
    setEditForm({
      amount: String(txn.amount),
      description: txn.description || '',
      category_id: txn.expense_category_id || '',
      occurred_at: txn.occurred_at ? new Date(txn.occurred_at).toISOString().split('T')[0] : '',
    });
    setEditExpenseOpen(true);
  };

  const handleEditExpense = async () => {
    if (!editingExpense) return;
    const valid = validateEditFields({
      amount: [!editForm.amount, 'Amount is required'],
      description: [!editForm.description, 'Description is required'],
      category_id: [!editForm.category_id, 'Please select a category'],
    });
    if (!valid) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('financial_transactions')
        .update({
          amount: parseFloat(editForm.amount),
          description: editForm.description,
          expense_category_id: editForm.category_id,
          occurred_at: new Date(editForm.occurred_at).toISOString(),
        })
        .eq('id', editingExpense.id);

      if (error) throw error;

      toast.success('Expense updated');
      setEditExpenseOpen(false);
      setEditingExpense(null);
      loadFinancialData();
    } catch (error) {
      console.error('Error updating expense:', error);
      toast.error('Failed to update expense');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete expense with undo (13.1) ─────────────────────────────────

  const handleDeleteExpense = (txn: FinancialTransactionForList) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Expense',
      description: `Delete "${txn.description || 'this expense'}" (${formatCurrency(txn.amount)})? This action can be undone briefly after confirmation.`,
      onConfirm: async () => {
        try {
          // Soft-delete: remove from UI immediately, allow undo
          const deletedTxn = { ...txn };

          const { error } = await supabase
            .from('financial_transactions')
            .delete()
            .eq('id', txn.id);

          if (error) throw error;

          // Show undo toast
          toast.success('Expense deleted', {
            action: {
              label: 'Undo',
              onClick: async () => {
                try {
                  const { error: undoError } = await supabase
                    .from('financial_transactions')
                    .insert({
                      shop_id: deletedTxn.shop_id,
                      type: deletedTxn.type,
                      amount: deletedTxn.amount,
                      description: deletedTxn.description,
                      expense_category_id: deletedTxn.expense_category_id,
                      occurred_at: deletedTxn.occurred_at,
                      created_by: deletedTxn.created_by,
                    });
                  if (undoError) throw undoError;
                  toast.success('Expense restored');
                  loadFinancialData();
                } catch {
                  toast.error('Failed to undo — expense data lost');
                }
              },
            },
            duration: 6000,
          });

          loadFinancialData();
        } catch (error) {
          console.error('Error deleting expense:', error);
          toast.error('Failed to delete expense');
        }
      },
    });
  };

  const exportExpenses = async () => {
    try {
      if (!profile?.shop_id) return;

      // Use dateRange from useDateFilter hook
      let query = supabase
        .from('financial_transactions')
        .select('*, expense_category:expense_categories!financial_transactions_expense_category_id_fkey(name)')
        .eq('shop_id', profile.shop_id)
        .eq('type', 'expense');

      if (dateRange?.startDate) {
        query = query.gte('occurred_at', dateRange.startDate.toISOString());
      }

      if (categoryFilter !== 'all') {
        query = query.eq('expense_category_id', categoryFilter);
      }

      if (debouncedSearchTerm) {
        query = query.ilike('description', `%${debouncedSearchTerm}%`);
      }

      const { data, error } = await query.order('occurred_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('No data to export');
        return;
      }

      const exportData = data.map(expense => ({
        'Date': formatDate(expense.occurred_at),
        'Category': (expense.expense_category as any)?.name || 'Uncategorized',
        'Description': expense.description,
        'Amount': expense.amount
      }));

      exportToCSV(exportData, { filename: 'expenses' });
      toast.success(`Exported ${data.length} expenses`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Failed to export expenses');
    }
  };

  const profitMargin = summary.totalRevenue > 0
    ? ((summary.netProfit / summary.totalRevenue) * 100).toFixed(1)
    : '0';

  const maxCategoryAmount = Math.max(...categoryBreakdown.map(c => c.amount), 1);

  // Build filter chips for active filters
  const filterChips: FilterChip[] = [];
  if (categoryFilter !== 'all') filterChips.push({ label: 'Category', value: expenseCategories.find(c => c.id === categoryFilter)?.name || categoryFilter, onClear: () => { setCategoryFilter('all'); setCurrentPage(1); } });
  if (dateFilter !== 'all' && dateFilter !== 'custom') filterChips.push({ label: 'Date', value: dateFilter, onClear: () => { setDateFilter('all'); setCurrentPage(1); }, className: 'capitalize' });
  if (debouncedSearchTerm) filterChips.push({ label: 'Search', value: `"${debouncedSearchTerm}"`, onClear: () => { setSearchTerm(''); setCurrentPage(1); } });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="relative group shrink-0">
            <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
              <PieChart className="h-6 w-6" />
            </div>
            <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
              <ArrowLeft className="h-3 w-3 text-muted-foreground" />
            </div>
          </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Financial Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Track revenue, expenses, and profitability •
                <Link href="/admin/settings" className={`${s.linkColor} ${s.linkHover} ml-1`}>
                  Manage Categories
                </Link>
              </p>
            </div>
          </div>
          <Button
            onClick={() => setAddExpenseOpen(true)}
            className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
      </div>

      {/* Date Filter */}
      <DateRangeFilter
        value={dateFilter}
        onChange={setDateFilter}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />

      {/* Summary Cards - 2x2 on mobile */}
      <StatsCardGrid
        loading={loading}
        stats={[
          {
            label: 'Total Revenue',
            value: <CountUp end={summary.totalRevenue} prefix="₹" />,
            icon: TrendingUp,
            iconColor: 'text-green-600',
            valueColor: 'text-green-600',
            subtitle: `${summary.salesCount} sales`,
          },
          {
            label: 'Total Expenses',
            value: <CountUp end={summary.totalExpenses} prefix="₹" />,
            icon: TrendingDown,
            iconColor: 'text-red-600',
            valueColor: 'text-red-600',
            subtitle: `${totalCount} expenses`,
          },
          {
            label: 'Net Profit',
            value: <CountUp end={Math.abs(summary.netProfit)} prefix={summary.netProfit < 0 ? '-₹' : '₹'} />,
            icon: DollarSign,
            iconColor: 'text-blue-600',
            valueColor: summary.netProfit >= 0 ? 'text-blue-600' : 'text-red-600',
            subtitle: `${profitMargin}% margin`,
          },
          {
            label: 'Avg Sale Value',
            value: <CountUp end={summary.avgSaleValue} prefix="₹" />,
            icon: CreditCard,
            iconColor: 'text-purple-600',
            subtitle: 'Per transaction',
          },
          {
            label: 'Inventory Value',
            value: <CountUp end={summary.inventoryValue} prefix="₹" />,
            icon: Package,
            iconColor: 'text-orange-600',
            subtitle: 'Available stock (at cost)',
            colSpan: 2,
          },
          {
            label: 'Cash Flow',
            value: <CountUp end={Math.abs(summary.netProfit)} prefix={summary.netProfit >= 0 ? '+₹' : '-₹'} />,
            icon: CreditCard,
            iconColor: s.linkColor,
            valueColor: summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600',
            subtitle: 'Revenue - Expenses',
            colSpan: 2,
          },
        ]}
      />

      {/* Expense Breakdown by Category */}
      <div className="space-y-4">
        {categoryBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Expenses by Category</CardTitle>
              <CardDescription>Category-wise spending breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryBreakdown.map((cat) => {
                  const percentage = (cat.amount / summary.totalExpenses * 100).toFixed(1);
                  const barWidth = (cat.amount / maxCategoryAmount * 100).toFixed(1);

                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${cat.color}`}></div>
                          <span className="font-medium">{cat.category}</span>
                          <Badge variant="secondary" className="text-xs">{cat.count}</Badge>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{formatCurrency(cat.amount)}</span>
                          <span className="text-xs text-muted-foreground ml-2">({percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${cat.color} transition-all duration-500`}
                          style={{ width: `${barWidth}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expenses List */}
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Recent Expenses</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Total {totalCount} expenses
                  </CardDescription>
                </div>
                <Button
                  onClick={exportExpenses}
                  variant="outline"
                  size="sm"
                  className={s.btnAnimation}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>

              {/* Filters */}
              <div className="flex flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>

                {/* Category Filter */}
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {expenseCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FilterChips
                chips={filterChips}
                onClearAll={() => { setCategoryFilter('all'); setDateFilter('all'); setSearchTerm(''); setCurrentPage(1); }}
              />
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <EmptyState
                  icon={TrendingDown}
                  title="No expenses found"
                  description={totalCount === 0 ? 'Click "Add Expense" to record your first expense' : undefined}
                  action={totalCount !== 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSearchTerm(''); setCategoryFilter('all'); }}
                      className={s.btnAnimation}
                    >
                      Clear filters
                    </Button>
                  ) : undefined}
                />
              ) : (
                <table className="w-full min-w-[600px] animate-content-in">
                  <thead>
                    <tr className="border-b text-xs md:text-sm">
                      <SortableHeader column="occurred_at" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="100px">
                        Date
                      </SortableHeader>
                      <th className="text-left py-3 px-3 font-medium min-w-[120px]">
                        <div className="flex items-center whitespace-nowrap">
                          Category
                        </div>
                      </th>
                      <SortableHeader column="description" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="200px">
                        Description
                      </SortableHeader>
                      <SortableHeader column="amount" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} align="right" minWidth="100px">
                        Amount
                      </SortableHeader>
                      <th className="text-right py-3 px-3 font-medium min-w-[80px]">
                        <div className="flex items-center justify-end whitespace-nowrap">Actions</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn, idx) => (
                      <tr
                        key={txn.id}
                        className="border-b hover:bg-muted/50 transition-colors animate-stagger-fade-in"
                        style={{ '--row-index': idx } as React.CSSProperties}
                      >
                        <td className="py-3 px-3">
                          <button
                            onClick={() => setDetailExpense(txn)}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            title="View details"
                          >
                            <Badge variant="outline" className={`font-mono text-xs ${s.accent.hoverBg} ${s.accent.hoverBorder}`}>
                              {formatDate(txn.occurred_at)}
                            </Badge>
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            {txn.expense_category?.name || 'Uncategorized'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-sm max-w-[250px] truncate">
                          {txn.description}
                        </td>
                        <td className="py-3 px-3 text-right text-sm font-semibold text-red-600 whitespace-nowrap">
                          {formatCurrency(txn.amount)}
                        </td>
                        <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditExpense(txn)}
                              title="Edit expense"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteExpense(txn)}
                              title="Delete expense"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              startItem={startItem}
              endItem={endItem}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>
              Record a new business expense
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={(e) => { setExpenseForm({ ...expenseForm, amount: e.target.value }); clearExpenseError('amount'); }}
                className={fieldErrorClass(expenseErrors.amount)}
              />
              <FieldError message={expenseErrors.amount} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              {!showNewCategory ? (
                <div className="flex gap-2">
                  <Select
                    value={expenseForm.category_id}
                    onValueChange={(value) => { setExpenseForm({ ...expenseForm, category_id: value }); clearExpenseError('category_id'); }}
                  >
                    <SelectTrigger className={fieldErrorClass(expenseErrors.category_id)}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNewCategory(true)}
                    title="Create new category"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="New category name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateCategory();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setShowNewCategory(false);
                        setNewCategoryName('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Press Enter or click + to create</p>
                </div>
              )}
            </div>
            <FieldError message={expenseErrors.category_id} />
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Enter expense description"
                value={expenseForm.description}
                onChange={(e) => { setExpenseForm({ ...expenseForm, description: e.target.value }); clearExpenseError('description'); }}
                rows={3}
                className={fieldErrorClass(expenseErrors.description)}
              />
              <FieldError message={expenseErrors.description} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={expenseForm.occurred_at}
                onChange={(e) => setExpenseForm({ ...expenseForm, occurred_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAddExpenseOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddExpense}
              disabled={submitting}
              className={`${s.primaryGradient} ${s.primaryGradientHover}`}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog (13.1) */}
      <Dialog open={editExpenseOpen} onOpenChange={(open) => { setEditExpenseOpen(open); if (!open) setEditingExpense(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update expense details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount *</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={editForm.amount}
                onChange={(e) => { setEditForm({ ...editForm, amount: e.target.value }); clearEditError('amount'); }}
                className={fieldErrorClass(editErrors.amount)}
              />
              <FieldError message={editErrors.amount} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category *</Label>
              <Select
                value={editForm.category_id}
                onValueChange={(value) => { setEditForm({ ...editForm, category_id: value }); clearEditError('category_id'); }}
              >
                <SelectTrigger className={fieldErrorClass(editErrors.category_id)}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={editErrors.category_id} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                placeholder="Enter expense description"
                value={editForm.description}
                onChange={(e) => { setEditForm({ ...editForm, description: e.target.value }); clearEditError('description'); }}
                rows={3}
                className={fieldErrorClass(editErrors.description)}
              />
              <FieldError message={editErrors.description} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date *</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.occurred_at}
                onChange={(e) => setEditForm({ ...editForm, occurred_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditExpenseOpen(false)} disabled={submitting}>Cancel</Button>
            <Button
              onClick={handleEditExpense}
              disabled={submitting}
              className={`${s.primaryGradient} ${s.primaryGradientHover}`}
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : (
                <><Pencil className="mr-2 h-4 w-4" />Save Changes</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Detail Dialog — premium p-0 layout (13.2) */}
      <Dialog open={!!detailExpense} onOpenChange={(open) => { if (!open) setDetailExpense(null); }}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Expense Details</DialogTitle>
          <DialogDescription className="sr-only">View expense details including amount, category, and date</DialogDescription>
          {detailExpense && (
            <>
              {/* Colored header */}
              <div className={`${s.primaryGradient} px-6 py-5 text-white`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-white/20">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold leading-tight">Expense Details</h2>
                    <p className="text-sm text-white/80 mt-0.5">{formatDate(detailExpense.occurred_at)}</p>
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight mt-2">
                  {formatCurrency(detailExpense.amount)}
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Category</p>
                    <Badge variant="secondary">{detailExpense.expense_category?.name || 'Uncategorized'}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Date</p>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(detailExpense.occurred_at)}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5">Description</p>
                  <p className="text-sm leading-relaxed">{detailExpense.description || 'No description'}</p>
                </div>

                <Separator />

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className={s.btnAnimation}
                    onClick={() => { setDetailExpense(null); openEditExpense(detailExpense); }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${s.btnAnimation} text-destructive hover:text-destructive`}
                    onClick={() => { setDetailExpense(null); handleDeleteExpense(detailExpense); }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog for delete */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
