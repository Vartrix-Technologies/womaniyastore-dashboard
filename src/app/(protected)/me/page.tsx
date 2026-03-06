'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, LayoutDashboard } from 'lucide-react';
import { AttendanceCard } from '@/components/staff/AttendanceCard';
import { TaskChecklistCard, useTaskChecklists } from '@/components/staff/TaskChecklistCard';
import { AttendanceCalendar } from '@/components/staff/AttendanceCalendar';
import { useAuth } from '@/context/AuthContext';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

export default function StaffDashboardPage() {
  const { profile } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const taskData = useTaskChecklists(); // Single fetch shared by both renders

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md`}>
          <LayoutDashboard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back, {profile?.full_name || 'Staff Member'}!
          </p>
        </div>
      </div>

      {/* Attendance & Tasks Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Attendance */}
        <AttendanceCard />

        {/* Daily Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Daily Tasks</CardTitle>
                <CardDescription className="text-sm">Complete your daily checklist</CardDescription>
              </div>
              <TaskChecklistCard showCompactSummary={true} hookData={taskData} />
            </div>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto">
            <TaskChecklistCard compact={true} hookData={taskData} />
          </CardContent>
        </Card>
      </div>

      {/* Attendance History */}
      {!showCalendar ? (
        <Card>
          <CardContent className="flex items-start justify-between py-2 sm:flex-row flex-col gap-4">
            <div className="flex items-center gap-3">
              <Calendar className={`h-5 w-5 ${s.linkColor}`} />
              <div>
                <p className="font-medium">Attendance History</p>
                <p className="text-sm text-muted-foreground">View your past attendance records</p>
              </div>
            </div>
            <div className='px-6'>
              <Button
                variant="outline"
                onClick={() => setShowCalendar(true)}
                className={s.btnAnimation}
              >
                View History
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className={`h-5 w-5 ${s.linkColor}`} />
                Attendance History
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCalendar(false)}
                className={s.btnAnimation}
              >
                Hide
              </Button>
            </div>
          </CardHeader>
          <CardContent className='px-2'>
            <AttendanceCalendar />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
