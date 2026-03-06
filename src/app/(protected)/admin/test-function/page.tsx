'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function TestFunctionPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testFunction = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Test 1: Check auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('Auth token present:', !!session.access_token);

      // Test 2: Invoke Edge Function
      const { data, error } = await supabase.functions.invoke('add-stock-lot', {
        body: {
          category_id: 'test-category-id',
          quantity: 1,
          cost_price_per_unit: 100,
          selling_price_default: 150,
          tax_rate: 18,
          date_of_stock_arrival: new Date().toISOString().split('T')[0],
        },
      });

      if (error) {
        console.error('Edge Function error:', error);
        setResult({
          success: false,
          error: error.message,
          details: JSON.stringify(error, null, 2),
        });
        toast.error(`Function error: ${error.message}`);
      } else {
        console.log('Edge Function response:', data);
        setResult({
          success: true,
          data: JSON.stringify(data, null, 2),
        });
        toast.success('Function called successfully!');
      }
    } catch (err: any) {
      console.error('Test failed:', err);
      setResult({
        success: false,
        error: err.message,
        stack: err.stack,
      });
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Edge Function Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={testFunction} disabled={loading}>
            {loading ? 'Testing...' : 'Test add-stock-lot Function'}
          </Button>

          {result && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">
                {result.success ? '✅ Success' : '❌ Error'}
              </h3>
              <pre className="text-xs overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-8 p-4 bg-blue-50 rounded-lg text-sm">
            <h4 className="font-semibold mb-2">Troubleshooting Steps:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open Browser Console (F12) to see detailed errors</li>
              <li>Check Network tab for Edge Function request/response</li>
              <li>Verify you ran both SQL migrations in Supabase Dashboard</li>
              <li>Ensure you have QR codes in the database (add via SQL Editor)</li>
              <li>Confirm your profile has admin/owner role</li>
            </ol>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 rounded-lg text-sm">
            <h4 className="font-semibold mb-2">Quick SQL to add test QR codes:</h4>
            <pre className="bg-white p-2 rounded border">
{`-- Run this in Supabase SQL Editor
INSERT INTO qr_codes (code, shop_id)
SELECT 
  'QR-' || LPAD(i::text, 5, '0'),
  (SELECT id FROM shops LIMIT 1)
FROM generate_series(1, 100) AS i;`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
