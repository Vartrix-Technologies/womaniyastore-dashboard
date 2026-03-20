// Supabase Edge Function: Auto-close stale attendance sessions
// Deploy: supabase functions deploy auto-close-attendance
// Schedule: Run nightly at 12:05 AM IST (6:35 PM UTC) via pg_cron + pg_net
//
// This function finds all attendance_logs with status='open' from a date
// before today (IST) and closes them. The clock_out is set to the earlier of:
//   - Midnight IST (end of shift day)
//   - clock_in + 16 hours (MAX_SHIFT_HOURS cap)

// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_SHIFT_HOURS = 16;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in IST
    const now = new Date();
    const istDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    console.log(`[auto-close-attendance] Running for IST date: ${istDateStr}`);

    // Find all open attendance records from before today
    const { data: staleRecords, error: fetchError } = await supabase
      .from('attendance_logs')
      .select('id, date, clock_in, staff_id')
      .eq('status', 'open')
      .is('deleted_at', null)
      .lt('date', istDateStr);

    if (fetchError) throw fetchError;

    if (!staleRecords || staleRecords.length === 0) {
      console.log('[auto-close-attendance] No stale sessions found.');
      return new Response(
        JSON.stringify({ message: 'No stale sessions to close', closed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-close-attendance] Found ${staleRecords.length} stale session(s)`);

    let closedCount = 0;
    const errors: string[] = [];

    for (const record of staleRecords) {
      try {
        // Calculate auto-close time: Midnight IST (end of shift day = 00:00 next day)
        const [year, month, day] = record.date.split('-').map(Number);
        const nextDay = new Date(year, month - 1, day + 1);
        const nextDayStr = nextDay.toLocaleDateString('en-CA');
        const autoCloseAtIST = `${nextDayStr}T00:00:00+05:30`;
        const autoCloseDate = new Date(autoCloseAtIST);

        // Cap at MAX_SHIFT_HOURS from clock_in
        const clockInDate = new Date(record.clock_in);
        const maxFromClockIn = new Date(clockInDate.getTime() + MAX_SHIFT_HOURS * 60 * 60 * 1000);

        const cappedClockOut = autoCloseDate < maxFromClockIn ? autoCloseDate : maxFromClockIn;

        const { error: updateError } = await supabase
          .from('attendance_logs')
          .update({
            clock_out: cappedClockOut.toISOString(),
            status: 'closed',
            edit_reason: 'Auto-closed: staff did not clock out (nightly cron)',
          })
          .eq('id', record.id);

        if (updateError) {
          errors.push(`Record ${record.id}: ${updateError.message}`);
        } else {
          closedCount++;
          console.log(`[auto-close-attendance] Closed record ${record.id} (staff: ${record.staff_id}, date: ${record.date})`);
        }
      } catch (e) {
        errors.push(`Record ${record.id}: ${e.message}`);
      }
    }

    const result = {
      message: `Auto-closed ${closedCount} of ${staleRecords.length} stale session(s)`,
      closed: closedCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log(`[auto-close-attendance] Done:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[auto-close-attendance] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
