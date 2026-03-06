'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DateFilterTabs } from '@/components/shared/DateFilterTabs';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { calculateDateRange, exportToCSV, type DateFilterType } from '@/lib/utils';
import { useServerPagination, useSortableTable, useDateFilter, useDebouncedSearch } from '@/hooks';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { TrendingUp, TrendingDown, DollarSign, Package, CreditCard, ArrowLeft, Plus, PieChart, Loader2, X, Search, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

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
  const { profile } = useAuth();
  const { dateFilter, setDateFilter, dateRange, startDateISO, endDateISO } = useDateFilter({ initialFilter: 'week' });
  const [summary, setSummary] = useState<FinancialSummary>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    salesCount: 0,
    avgSaleValue: 0,
    inventoryValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; amount: number; count: number; color: string }[]>([]);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Pagination and filtering for expenses
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 500 });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
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

  useEffect(() => {
    if (profile?.shop_id) {
      loadExpenseCategories();
      loadFinancialData();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.shop_id, dateFilter, currentPage, itemsPerPage, debouncedSearchTerm, categoryFilter, sortBy, sortOrder]);

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
        .select('amount')
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

      // Parallelize all data fetches for faster load
      const [
        { data: salesData, error: salesError },
        { data: transactionsData, error: transError, count },
        { data: inventoryData, error: invError },
        { data: statsTransData, error: statsTransError }
      ] = await Promise.all([
        salesQuery,
        transQuery,
        supabase
          .from('inventory_items')
          .select(`
            id,
            lot:lots(selling_price_default)
          `)
          .eq('shop_id', profile.shop_id)
          .eq('status', 'available'),
        statsTransQuery
      ]);

      if (salesError) throw salesError;
      if (transError) throw transError;
      if (invError) throw invError;
      if (statsTransError) throw statsTransError;

      // Calculate summary from FULL filtered dataset
      const totalRevenue = (salesData as any[])?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
      const totalExpenses = (statsTransData as any[])?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
      const inventoryValue = (inventoryData as any[])?.reduce((sum, item) => sum + (item.lot?.selling_price_default || 0), 0) || 0;

      setSummary({
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        salesCount: salesData?.length || 0,
        avgSaleValue: salesData && salesData.length > 0 ? totalRevenue / salesData.length : 0,
        inventoryValue,
      });

      setTransactions(transactionsData || []);
      setTotalCount(count || 0);

      // Calculate category breakdown
      const breakdown = (transactionsData || []).reduce((acc: any, txn: any) => {
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

      // Calculate vendor-wise sales report
      let vendorQuery = supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          items:sale_items(
            quantity,
            price,
            item:inventory_items(
              id,
              lot:lots(
                vendor_name,
                cost_price_per_unit
              )
            )
          )
        `)
        .eq('shop_id', profile.shop_id);

      if (fromDate) {
        vendorQuery = vendorQuery.gte('created_at', fromDate);
      }

      const { data: salesWithItems, error: salesItemsError } = await vendorQuery;

      if (!salesItemsError && salesWithItems) {
        const vendorData: { [key: string]: { itemsSold: number; revenue: number; profit: number } } = {};
        
        salesWithItems.forEach((sale: any) => {
          sale.items?.forEach((saleItem: any) => {
            const vendor = saleItem.item?.lot?.vendor_name || 'Unknown Vendor';
            const costPrice = saleItem.item?.lot?.cost_price_per_unit || 0;
            const revenue = saleItem.price * saleItem.quantity;
            const profit = revenue - (costPrice * saleItem.quantity);

            if (!vendorData[vendor]) {
              vendorData[vendor] = { itemsSold: 0, revenue: 0, profit: 0 };
            }
            vendorData[vendor].itemsSold += saleItem.quantity;
            vendorData[vendor].revenue += revenue;
            vendorData[vendor].profit += profit;
          });
        });

        const vendorReportArray = Object.entries(vendorData)
          .map(([vendor, data]) => ({ vendor, ...data }))
          .sort((a, b) => b.revenue - a.revenue);
        
        setVendorReport(vendorReportArray);
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!profile?.shop_id || !expenseForm.amount || !expenseForm.description || !expenseForm.category_id) {
      toast.error('Please fill all required fields');
      return;
    }

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

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with Back Button */}
      <div className="flex flex-col gap-3">
        <Button 
          variant="ghost" 
          asChild 
          className="w-fit -ml-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
        >
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <PieChart className="h-6 w-6 text-teal-600" />
              Financial Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track revenue, expenses, and profitability • 
              <Link href="/admin/settings" className="text-teal-600 hover:text-teal-700 ml-1">
                Manage Categories
              </Link>
            </p>
          </div>
          <Button
            onClick={() => setAddExpenseOpen(true)}
            className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Date Filter Tabs */}
      <Card>
        <CardContent className="p-4">
          <DateFilterTabs value={dateFilter} onChange={setDateFilter} />
        </CardContent>
      </Card>

      {/* Summary Cards - 2x2 on mobile */}
      <StatsCardGrid
        loading={loading}
        stats={[
          {
            label: 'Total Revenue',
            value: formatCurrency(summary.totalRevenue),
            icon: TrendingUp,
            iconColor: 'text-green-600',
            valueColor: 'text-green-600',
            subtitle: `${summary.salesCount} sales`,
          },
          {
            label: 'Total Expenses',
            value: formatCurrency(summary.totalExpenses),
            icon: TrendingDown,
            iconColor: 'text-red-600',
            valueColor: 'text-red-600',
            subtitle: `${transactions.length} expenses`,
          },
          {
            label: 'Net Profit',
            value: formatCurrency(summary.netProfit),
            icon: DollarSign,
            iconColor: 'text-blue-600',
            valueColor: summary.netProfit >= 0 ? 'text-blue-600' : 'text-red-600',
            subtitle: `${profitMargin}% margin`,
          },
          {
            label: 'Avg Sale Value',
            value: formatCurrency(summary.avgSaleValue),
            icon: CreditCard,
            iconColor: 'text-purple-600',
            subtitle: 'Per transaction',
          },
          {
            label: 'Inventory Value',
            value: formatCurrency(summary.inventoryValue),
            icon: Package,
            iconColor: 'text-orange-600',
            subtitle: 'Available stock value',
            colSpan: 2,
          },
          {
            label: 'Cash Flow',
            value: `${summary.netProfit >= 0 ? '+' : ''}${formatCurrency(summary.netProfit)}`,
            icon: CreditCard,
            iconColor: 'text-teal-600',
            valueColor: summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600',
            subtitle: 'Revenue - Expenses',
            colSpan: 2,
          },
        ]}
      />

      {/* Expense Breakdown by Category */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Sales Report</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
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
                    className="hover:scale-105 active:scale-95 transition-all"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-3">
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
                  <div className="text-center py-12">
                    <TrendingDown className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm md:text-base text-muted-foreground mb-2">No expenses found</p>
                    {totalCount === 0 ? (
                      <p className="text-xs text-muted-foreground mb-4">
                        Click "Add Expense" to record your first expense
                      </p>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { setSearchTerm(''); setCategoryFilter('all'); }}
                        className="hover:scale-105 active:scale-95 transition-all"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <table className="w-full min-w-[600px]">
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
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((txn) => (
                        <tr key={txn.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-3 text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(txn.occurred_at)}
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="secondary" className="text-xs whitespace-nowrap">
                              {txn.expense_category?.name || 'Uncategorized'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-sm">
                            {txn.description}
                          </td>
                          <td className="py-3 px-3 text-right text-sm font-semibold text-red-600 whitespace-nowrap">
                            {formatCurrency(txn.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination Controls */}
              {totalCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {startItem} to {endItem} of <span className="font-semibold">{totalCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="itemsPerPage" className="text-xs text-muted-foreground whitespace-nowrap">
                        Per page:
                      </Label>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => {
                          setItemsPerPage(parseInt(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-20 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      title="First page"
                    >
                      <ChevronFirst className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      title="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium px-3 min-w-[100px] text-center">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      title="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      title="Last page"
                    >
                      <ChevronLast className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vendor-Wise Sales Report</CardTitle>
              <CardDescription>Revenue and profit breakdown by vendor</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : vendorReport.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm md:text-base text-muted-foreground mb-2">No vendor sales data</p>
                  <p className="text-xs text-muted-foreground">
                    Add vendor names to stock lots to see vendor-wise reports
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {vendorReport.map((vendor, idx) => {
                    const profitMargin = vendor.revenue > 0 
                      ? ((vendor.profit / vendor.revenue) * 100).toFixed(1) 
                      : '0';
                    
                    return (
                      <div
                        key={vendor.vendor}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                #{idx + 1}
                              </Badge>
                              <h3 className="font-semibold text-lg">{vendor.vendor}</h3>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Items Sold</p>
                            <p className="text-lg font-semibold">{vendor.itemsSold}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                            <p className="text-lg font-semibold text-green-600">{formatCurrency(vendor.revenue)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Profit</p>
                            <p className={`text-lg font-semibold ${vendor.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {formatCurrency(vendor.profit)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{profitMargin}% margin</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              {!showNewCategory ? (
                <div className="flex gap-2">
                  <Select
                    value={expenseForm.category_id}
                    onValueChange={(value) => setExpenseForm({ ...expenseForm, category_id: value })}
                  >
                    <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Enter expense description"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                rows={3}
              />
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
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
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
    </div>
  );
}
