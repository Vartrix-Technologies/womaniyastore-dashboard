// Supabase Edge Function: Auto-create Daily Checklist Instances
// Deploy: supabase functions deploy create-daily-checklists
// Schedule: Run daily at 6:00 AM via Supabase Cron

// NOTE: This file is for Deno runtime, not Node.js
// TypeScript errors shown in VS Code are expected and can be ignored
// The function will work correctly when deployed to Supabase Edge Functions

// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    console.log(`Creating checklist instances for ${today} (day ${dayOfWeek})`);

    // Get all shops
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('id, name');

    if (shopsError) throw shopsError;

    let totalCreated = 0;
    const results: any[] = [];

    // For each shop, create today's checklist instances
    for (const shop of shops) {
      console.log(`Processing shop: ${shop.name} (${shop.id})`);

      // Call the database function to create instances
      const { data: instances, error: instancesError } = await supabase
        .rpc('create_daily_checklist_instances', {
          shop_id_param: shop.id,
          date_param: today,
        });

      if (instancesError) {
        console.error(`Error for shop ${shop.id}:`, instancesError);
        results.push({
          shop_id: shop.id,
          shop_name: shop.name,
          success: false,
          error: instancesError.message,
        });
        continue;
      }

      const createdCount = instances?.length || 0;
      totalCreated += createdCount;

      results.push({
        shop_id: shop.id,
        shop_name: shop.name,
        success: true,
        instances_created: createdCount,
        instances: instances || [],
      });

      console.log(`Created ${createdCount} instances for ${shop.name}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        total_shops: shops.length,
        total_instances_created: totalCreated,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error creating daily checklists:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
