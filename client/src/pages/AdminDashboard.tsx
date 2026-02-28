import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, BookOpen, TrendingUp, UserCheck, GraduationCap, Download, X, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convertToCSV, formatUsersForCSV, formatEnrollmentsForCSV, formatPaymentsForCSV } from "../../../server/csv-export";
import { UserGrowthChart } from "@/components/charts/UserGrowthChart";
import { EnrollmentPatternsChart } from "@/components/charts/EnrollmentPatternsChart";
import { RevenueTrendsChart } from "@/components/charts/RevenueTrendsChart";
import { UserDistributionChart } from "@/components/charts/UserDistributionChart";
import { PaymentStatusChart } from "@/components/charts/PaymentStatusChart";
import { DateRangeSelector } from "@/components/DateRangeSelector";
import { TutorAvailabilityManager } from "@/components/TutorAvailabilityManager";
import { EmailSettings } from "@/components/EmailSettings";
import { RegisteredTutorsManager } from "@/components/RegisteredTutorsManager";
import { Pagination } from "@/components/Pagination";
import { CourseCreationForm } from "@/components/CourseCreationForm";
import { CourseManagementTable } from "@/components/CourseManagementTable";
import { TutorAssignmentDialog } from "@/components/TutorAssignmentDialog";
import { toast } from "sonner";

export function AdminDashboard() {
  const { user, isAuthenticated, loading } = useAuth();

  // Course management state
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [isTutorAssignmentOpen, setIsTutorAssignmentOpen] = useState(false);
  const { refetch: refetchCourses } = trpc.adminCourses.getAllCoursesWithTutors.useQuery({});

  // Pagination states
  const [usersPage, setUsersPage] = useState(1);
  const [enrollmentsPage, setEnrollmentsPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [tutorsPage, setTutorsPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter states
  const [userFilters, setUserFilters] = useState<{
    role?: "admin" | "parent" | "tutor";
    search?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  const [enrollmentFilters, setEnrollmentFilters] = useState<{
    status?: "active" | "paused" | "cancelled" | "completed";
    paymentStatus?: "paid" | "pending" | "failed";
    startDate?: string;
    endDate?: string;
  }>({});

  const [paymentFilters, setPaymentFilters] = useState<{
    status?: "completed" | "pending" | "failed";
    startDate?: string;
    endDate?: string;
  }>({});

  const [sessionFilters, setSessionFilters] = useState<{
    status?: "scheduled" | "completed" | "cancelled" | "no_show";
    startDate?: string;
    endDate?: string;
  }>({});

  const [dateRange, setDateRange] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});
  const tabContentClass =
    "space-y-6 absolute inset-0 w-full transition-all duration-300 data-[state=active]:opacity-100 data-[state=active]:translate-x-0 data-[state=inactive]:opacity-0 data-[state=inactive]:translate-x-4 data-[state=inactive]:pointer-events-none [&[hidden]]:block [&[hidden]]:opacity-0";

  const [selectedTutorId, setSelectedTutorId] = useState<number | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.admin.getOverviewStats.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: usersData, isLoading: usersLoading } = trpc.admin.getAllUsers.useQuery(
    { limit: ITEMS_PER_PAGE, offset: (usersPage - 1) * ITEMS_PER_PAGE, ...userFilters },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: enrollmentsData, isLoading: enrollmentsLoading } = trpc.admin.getAllEnrollments.useQuery(
    { limit: ITEMS_PER_PAGE, offset: (enrollmentsPage - 1) * ITEMS_PER_PAGE, ...enrollmentFilters },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: paymentsData, isLoading: paymentsLoading } = trpc.admin.getAllPayments.useQuery(
    { limit: ITEMS_PER_PAGE, offset: (paymentsPage - 1) * ITEMS_PER_PAGE, ...paymentFilters },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: sessionsData, isLoading: sessionsLoading } = trpc.admin.getAllSessions.useQuery(
    { limit: ITEMS_PER_PAGE, offset: (sessionsPage - 1) * ITEMS_PER_PAGE, ...sessionFilters },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  // CSV export queries
  const { data: usersCSVData, refetch: refetchUsersCSV } = trpc.admin.exportUsersCSV.useQuery(
    userFilters,
    { enabled: false }
  );

  const { data: enrollmentsCSVData, refetch: refetchEnrollmentsCSV } = trpc.admin.exportEnrollmentsCSV.useQuery(
    enrollmentFilters,
    { enabled: false }
  );

  const { data: paymentsCSVData, refetch: refetchPaymentsCSV } = trpc.admin.exportPaymentsCSV.useQuery(
    paymentFilters,
    { enabled: false }
  );

  // Analytics query with date range
  const { data: analyticsData, isLoading: analyticsLoading } = trpc.admin.getAnalytics.useQuery(
    dateRange,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: tutorOptions, isLoading: tutorOptionsLoading } = trpc.admin.getTutorsForCourseApproval.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const {
    data: tutorPreferenceData,
    isLoading: tutorPreferencesLoading,
    refetch: refetchTutorPreferences,
  } = trpc.admin.getTutorCoursePreferences.useQuery(
    { tutorId: selectedTutorId ?? 0 },
    { enabled: isAuthenticated && user?.role === "admin" && !!selectedTutorId }
  );

  const updatePreferenceStatus = trpc.admin.updateTutorCoursePreferenceStatus.useMutation({
    onSuccess: () => {
      toast.success("Preference updated");
      refetchTutorPreferences();
    },
    onError: (err) => toast.error(err.message || "Failed to update preference"),
  });

  const [payoutStatusFilter, setPayoutStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: payoutRequests = [], isLoading: payoutRequestsLoading, refetch: refetchPayoutRequests } =
    trpc.adminCourses.getPayoutRequests.useQuery(
      undefined,
      { enabled: isAuthenticated && user?.role === "admin" }
    );

  const updatePayoutMutation = trpc.adminCourses.updatePayoutRequest.useMutation({
    onSuccess: () => {
      toast.success("Payout request updated");
      refetchPayoutRequests();
      setRejectingId(null);
      setRejectNotes("");
    },
    onError: (err) => toast.error(err.message || "Failed to update payout request"),
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = LOGIN_PATH;
    }
  }, [loading, isAuthenticated]);

  // Reset pagination when filters change
  useEffect(() => {
    setUsersPage(1);
  }, [userFilters]);

  useEffect(() => {
    setEnrollmentsPage(1);
  }, [enrollmentFilters]);

  useEffect(() => {
    setPaymentsPage(1);
  }, [paymentFilters]);

  useEffect(() => {
    setSessionsPage(1);
  }, [sessionFilters]);

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role !== 'admin') {
      window.location.href = '/';
    }
  }, [loading, isAuthenticated, user]);

  // CSV export handlers
  const downloadCSV = (data: string, filename: string) => {
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportUsers = async () => {
    const result = await refetchUsersCSV();
    if (result.data) {
      const formatted = formatUsersForCSV(result.data);
      const csv = convertToCSV(formatted, ['id', 'name', 'email', 'role', 'createdAt']);
      downloadCSV(csv, `users-export-${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const handleExportEnrollments = async () => {
    const result = await refetchEnrollmentsCSV();
    if (result.data) {
      const formatted = formatEnrollmentsForCSV(result.data);
      const csv = convertToCSV(formatted, ['id', 'courseName', 'studentName', 'parentName', 'parentEmail', 'tutorName', 'status', 'paymentStatus', 'paymentPlan', 'createdAt']);
      downloadCSV(csv, `enrollments-export-${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const handleExportPayments = async () => {
    const result = await refetchPaymentsCSV();
    if (result.data) {
      const formatted = formatPaymentsForCSV(result.data);
      const csv = convertToCSV(formatted, ['id', 'amount', 'currency', 'status', 'paymentType', 'courseName', 'studentName', 'parentName', 'parentEmail', 'tutorName', 'stripePaymentIntentId', 'createdAt']);
      downloadCSV(csv, `payments-export-${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const resetUserFilters = () => setUserFilters({});
  const resetEnrollmentFilters = () => setEnrollmentFilters({});
  const resetPaymentFilters = () => setPaymentFilters({});
  const resetSessionFilters = () => setSessionFilters({});

  if (loading || !isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor platform activity, users, enrollments, and billing
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-elegant transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{stats?.totalUsers || 0}</div>
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-4 w-4" />
                      {stats?.totalParents || 0} Parents
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-4 w-4" />
                      {stats?.totalTutors || 0} Tutors
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-elegant transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Course Enrollments
              </CardTitle>
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{stats?.totalEnrollments || 0}</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {stats?.activeEnrollments || 0} active enrollments
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-elegant transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold">${stats?.totalRevenue || '0.00'}</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {stats?.totalPayments || 0} transactions
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Tables */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex min-w-max gap-2 sm:w-full sm:flex-wrap">
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
              <TabsTrigger value="payments">Billing</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="payout-requests">Payout Requests</TabsTrigger>
              <TabsTrigger value="courses">Courses</TabsTrigger>
              <TabsTrigger value="registered-tutors">Registered Tutors</TabsTrigger>
              <TabsTrigger value="availability">Tutor Availability</TabsTrigger>
              {/* <TabsTrigger value="acuity">Acuity Mapping</TabsTrigger>
              <TabsTrigger value="quicksetup">Quick Setup</TabsTrigger> */}
              <TabsTrigger value="email">Email Settings</TabsTrigger>
              <TabsTrigger value="course-approval">Tutor Course Approval</TabsTrigger>
            </TabsList>
          </div>

          <div className="relative min-h-[640px]">

          {/* Analytics Tab */}
          <TabsContent value="analytics" forceMount className={tabContentClass}>
            {/* Date Range Selector */}
            <DateRangeSelector
              onDateRangeChange={(startDate, endDate) => {
                setDateRange({ startDate, endDate });
              }}
            />

            {analyticsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5].map(i => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-40" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-[300px] w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : analyticsData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* User Growth Chart */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      User Growth Trends
                    </CardTitle>
                    <CardDescription>
                      New user registrations over the last 12 months
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UserGrowthChart data={analyticsData.userGrowth} />
                  </CardContent>
                </Card>

                {/* Enrollment Patterns Chart */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-green-500" />
                      Monthly Enrollment Patterns
                    </CardTitle>
                    <CardDescription>
                      Course enrollments by month for the past year
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EnrollmentPatternsChart data={analyticsData.enrollmentPatterns} />
                  </CardContent>
                </Card>

                {/* Revenue Trends Chart */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-purple-500" />
                      Revenue Trends
                    </CardTitle>
                    <CardDescription>
                      Monthly revenue from completed payments
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RevenueTrendsChart data={analyticsData.revenueData} />
                  </CardContent>
                </Card>

                {/* User Distribution Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      User Distribution
                    </CardTitle>
                    <CardDescription>
                      Breakdown of users by role
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UserDistributionChart data={analyticsData.userDistribution} />
                  </CardContent>
                </Card>

                {/* Billing Status Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-green-500" />
                      Billing Status
                    </CardTitle>
                    <CardDescription>
                      Billing completion rates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PaymentStatusChart data={analyticsData.paymentStatus} />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No analytics data available</p>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" forceMount className={tabContentClass}>
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Search</label>
                    <Input
                      placeholder="Name or email..."
                      value={userFilters.search || ''}
                      onChange={(e) => setUserFilters({ ...userFilters, search: e.target.value || undefined })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Role</label>
                    <Select
                      value={userFilters.role || 'all'}
                      onValueChange={(value) => setUserFilters({ ...userFilters, role: value === 'all' ? undefined : value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="tutor">Tutor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Input
                      type="date"
                      value={userFilters.startDate || ''}
                      onChange={(e) => setUserFilters({ ...userFilters, startDate: e.target.value || undefined })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Input
                      type="date"
                      value={userFilters.endDate || ''}
                      onChange={(e) => setUserFilters({ ...userFilters, endDate: e.target.value || undefined })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={resetUserFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Reset Filters
                  </Button>
                  <Button variant="default" size="sm" onClick={handleExportUsers}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                  Showing {usersData?.users.length || 0} of {usersData?.total || 0} users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : usersData && usersData.users.length > 0 ? (
                  <div className="space-y-4">
                    {usersData.users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <p className="font-semibold">{user.name || 'Unknown'}</p>
                            <Badge variant={
                              user.role === 'admin' ? 'default' :
                              user.role === 'tutor' ? 'secondary' : 'outline'
                            }>
                              {user.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                          {user.createdAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Joined {new Date(user.createdAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No users found</p>
                )}
                
                {usersData && usersData.total > ITEMS_PER_PAGE && (
                  <Pagination
                    currentPage={usersPage}
                    totalItems={usersData.total}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setUsersPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enrollments Tab */}
          <TabsContent value="enrollments" forceMount className={tabContentClass}>
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select
                      value={enrollmentFilters.status || 'all'}
                      onValueChange={(value) => setEnrollmentFilters({ ...enrollmentFilters, status: value === 'all' ? undefined : value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Billing Status</label>
                    <Select
                      value={enrollmentFilters.paymentStatus || 'all'}
                      onValueChange={(value) => setEnrollmentFilters({ ...enrollmentFilters, paymentStatus: value === 'all' ? undefined : value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All billing statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All billing statuses</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Input
                      type="date"
                      value={enrollmentFilters.startDate || ''}
                      onChange={(e) => setEnrollmentFilters({ ...enrollmentFilters, startDate: e.target.value || undefined })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Input
                      type="date"
                      value={enrollmentFilters.endDate || ''}
                      onChange={(e) => setEnrollmentFilters({ ...enrollmentFilters, endDate: e.target.value || undefined })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={resetEnrollmentFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Reset Filters
                  </Button>
                  <Button variant="default" size="sm" onClick={handleExportEnrollments}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Enrollments</CardTitle>
                <CardDescription>
                  Showing {enrollmentsData?.enrollments.length || 0} of {enrollmentsData?.total || 0} enrollments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {enrollmentsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : enrollmentsData && enrollmentsData.enrollments.length > 0 ? (
                  <div className="space-y-4">
                    {enrollmentsData.enrollments.map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold">{enrollment.courseName}</p>
                            <Badge variant={enrollment.status === 'active' ? 'default' : 'secondary'}>
                              {enrollment.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {enrollment.paymentStatus}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>
                              <span className="font-medium text-foreground">Student:</span> {enrollment.studentName}
                            </p>
                            <p>
                              <span className="font-medium text-foreground">Parent:</span> {enrollment.parentName} ({enrollment.parentEmail})
                            </p>
                            <p>
                              <span className="font-medium text-foreground">Tutor:</span> {enrollment.tutorName}
                            </p>
                            <p className="text-xs">
                              Enrolled {new Date(enrollment.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No enrollments found</p>
                )}
                
                {enrollmentsData && enrollmentsData.total > ITEMS_PER_PAGE && (
                  <Pagination
                    currentPage={enrollmentsPage}
                    totalItems={enrollmentsData.total}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setEnrollmentsPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" forceMount className={tabContentClass}>
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select
                      value={paymentFilters.status || 'all'}
                      onValueChange={(value) => setPaymentFilters({ ...paymentFilters, status: value === 'all' ? undefined : value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Input
                      type="date"
                      value={paymentFilters.startDate || ''}
                      onChange={(e) => setPaymentFilters({ ...paymentFilters, startDate: e.target.value || undefined })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Input
                      type="date"
                      value={paymentFilters.endDate || ''}
                      onChange={(e) => setPaymentFilters({ ...paymentFilters, endDate: e.target.value || undefined })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={resetPaymentFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Reset Filters
                  </Button>
                  <Button variant="default" size="sm" onClick={handleExportPayments}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Billing Transactions</CardTitle>
                <CardDescription>
                  Showing {paymentsData?.payments.length || 0} of {paymentsData?.total || 0} transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : paymentsData && paymentsData.payments.length > 0 ? (
                  <div className="space-y-4">
                    {paymentsData.payments.map((payment) => {
                      const planLabel = payment.paymentPlan === 'installment'
                        ? payment.installmentNumber
                          ? `Installment ${payment.installmentNumber}`
                          : 'Installment'
                        : 'Pay in Full';
                      return (
                        <div
                          key={payment.id}
                          className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-semibold text-lg">
                                ${payment.amount} {payment.currency.toUpperCase()}
                              </p>
                              <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                                {payment.status}
                              </Badge>
                              <Badge variant="outline">{planLabel}</Badge>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p>
                                <span className="font-medium text-foreground">Date:</span>{" "}
                                {new Date(payment.createdAt).toLocaleDateString()} at{" "}
                                {new Date(payment.createdAt).toLocaleTimeString()}
                              </p>
                              {payment.courseName && (
                                <p>
                                  <span className="font-medium text-foreground">Course:</span> {payment.courseName}
                                </p>
                              )}
                              {payment.studentName && (
                                <p>
                                  <span className="font-medium text-foreground">Student:</span> {payment.studentName}
                                </p>
                              )}
                              <p>
                                <span className="font-medium text-foreground">Parent:</span> {payment.parentName} ({payment.parentEmail})
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Tutor:</span> {payment.tutorName}
                              </p>
                              {payment.stripePaymentIntentId && (
                                <p className="text-xs">
                                  <span className="font-medium text-foreground">Transaction ID:</span>{" "}
                                  {payment.stripePaymentIntentId}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No billing transactions found</p>
                )}
                
                {paymentsData && paymentsData.total > ITEMS_PER_PAGE && (
                  <Pagination
                    currentPage={paymentsPage}
                    totalItems={paymentsData.total}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setPaymentsPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" forceMount className={tabContentClass}>
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select
                      value={sessionFilters.status || 'all'}
                      onValueChange={(value) => setSessionFilters({ ...sessionFilters, status: value === 'all' ? undefined : value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="no_show">No Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Input
                      type="date"
                      value={sessionFilters.startDate || ''}
                      onChange={(e) => setSessionFilters({ ...sessionFilters, startDate: e.target.value || undefined })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Input
                      type="date"
                      value={sessionFilters.endDate || ''}
                      onChange={(e) => setSessionFilters({ ...sessionFilters, endDate: e.target.value || undefined })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={resetSessionFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Reset Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Sessions</CardTitle>
                <CardDescription>
                  Showing {sessionsData?.sessions.length || 0} of {sessionsData?.total || 0} sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : sessionsData && sessionsData.sessions.length > 0 ? (
                  <div className="space-y-4">
                    {sessionsData.sessions.map((session) => {
                      const studentName = [session.studentFirstName, session.studentLastName]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || "Student";

                      return (
                        <div
                          key={session.id}
                          className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-semibold">
                                {new Date(session.scheduledAt).toLocaleDateString()} • {new Date(session.scheduledAt).toLocaleTimeString()}
                              </p>
                              <Badge
                                variant={
                                  session.status === "completed" ? "secondary" :
                                  session.status === "cancelled" ? "destructive" :
                                  session.status === "no_show" ? "outline" :
                                  "default"
                                }
                                className={
                                  session.status === "no_show"
                                    ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
                                    : ""
                                }
                              >
                                {session.status === "no_show" ? "Completed (No Show)" : session.status}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p>
                                <span className="font-medium text-foreground">Course:</span> {session.courseTitle || "Unknown"}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Student:</span> {studentName}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Parent:</span> {session.parentName} ({session.parentEmail})
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Tutor:</span> {session.tutorName}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Duration:</span> {session.duration} minutes
                              </p>
                              {session.feedbackFromTutor && (
                                <p className="mt-2">
                                  <span className="font-medium text-foreground">Tutor Notes:</span> {session.feedbackFromTutor}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No sessions found</p>
                )}

                {sessionsData && sessionsData.total > ITEMS_PER_PAGE && (
                  <Pagination
                    currentPage={sessionsPage}
                    totalItems={sessionsData.total}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setSessionsPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payout Requests Tab */}
          <TabsContent value="payout-requests" forceMount className={tabContentClass}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={payoutStatusFilter} onValueChange={(v) => setPayoutStatusFilter(v as any)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {payoutRequestsLoading ? (
                <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : (
                (() => {
                  const filtered = payoutStatusFilter === "all"
                    ? payoutRequests
                    : payoutRequests.filter(r => r.status === payoutStatusFilter);
                  if (filtered.length === 0) {
                    return <p className="text-muted-foreground text-center py-8">No payout requests found.</p>;
                  }
                  return (
                    <div className="space-y-3">
                      {filtered.map((req) => {
                        const studentName =
                          req.studentFirstName || req.studentLastName
                            ? `${req.studentFirstName ?? ""} ${req.studentLastName ?? ""}`.trim()
                            : "Student";
                        return (
                          <Card key={req.id}>
                            <CardContent className="py-4">
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <p className="font-semibold">{req.tutorName} <span className="text-muted-foreground font-normal text-sm">({req.tutorEmail})</span></p>
                                  <p className="text-sm text-muted-foreground">{req.courseTitle} · Student: {studentName} · Parent: {req.parentName}</p>
                                  <p className="text-sm text-muted-foreground">{req.sessionsCompleted} sessions · ${parseFloat(req.ratePerSession).toFixed(2)}/session</p>
                                  {req.adminNotes && <p className="text-sm text-red-600">Note: {req.adminNotes}</p>}
                                  <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <p className="text-xl font-bold">${parseFloat(req.totalAmount).toFixed(2)}</p>
                                  <Badge className={
                                    req.status === "approved" ? "bg-green-100 text-green-800 border-green-200" :
                                    req.status === "rejected" ? "bg-red-100 text-red-800 border-red-200" :
                                    "bg-yellow-100 text-yellow-800 border-yellow-200"
                                  }>
                                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                  </Badge>
                                  {req.status === "pending" && (
                                    <div className="flex gap-2 mt-1">
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => updatePayoutMutation.mutate({ id: req.id, status: "approved" })}
                                        disabled={updatePayoutMutation.isPending}
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => setRejectingId(rejectingId === req.id ? null : req.id)}
                                      >
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                  {rejectingId === req.id && (
                                    <div className="flex gap-2 mt-1 w-full">
                                      <Input
                                        placeholder="Rejection reason (optional)"
                                        value={rejectNotes}
                                        onChange={(e) => setRejectNotes(e.target.value)}
                                        className="text-sm h-8"
                                      />
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => updatePayoutMutation.mutate({ id: req.id, status: "rejected", adminNotes: rejectNotes || undefined })}
                                        disabled={updatePayoutMutation.isPending}
                                      >
                                        Confirm
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </TabsContent>

          {/* Courses Tab */}
          <TabsContent value="courses" forceMount className={tabContentClass}>
            <div className="space-y-6">
              <CourseCreationForm onSuccess={() => refetchCourses()} />
              <CourseManagementTable onAssignTutors={(courseId) => {
                setSelectedCourseId(courseId);
                setIsTutorAssignmentOpen(true);
              }} />
            </div>
            <TutorAssignmentDialog
              courseId={selectedCourseId}
              isOpen={isTutorAssignmentOpen}
              onClose={() => {
                setIsTutorAssignmentOpen(false);
                setSelectedCourseId(null);
                refetchCourses();
              }}
            />
          </TabsContent>

          {/* Registered Tutors Tab */}
          <TabsContent value="registered-tutors" forceMount className={tabContentClass}>
            <RegisteredTutorsManager />
          </TabsContent>

          {/* Tutor Course Approval Tab */}
          <TabsContent value="course-approval" forceMount className={tabContentClass}>
            <Card>
              <CardHeader>
                <CardTitle>Tutor Course Approval</CardTitle>
                <CardDescription>
                  Select a tutor to review their requested courses and approve or reject individually.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select Tutor</label>
                    <Select
                      value={selectedTutorId ? String(selectedTutorId) : undefined}
                      onValueChange={(value) => setSelectedTutorId(Number(value))}
                      disabled={tutorOptionsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Tutor" />
                      </SelectTrigger>
                      <SelectContent>
                        {tutorOptions?.map((tutor) => (
                          <SelectItem key={tutor.id} value={String(tutor.id)}>
                            {tutor.name || "Tutor"}{tutor.email ? ` • ${tutor.email}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!tutorOptionsLoading && (!tutorOptions || tutorOptions.length === 0) && (
                  <p className="text-sm text-muted-foreground">No tutors found.</p>
                )}
              </CardContent>
            </Card>

            {selectedTutorId && (
              <Card>
                <CardHeader>
                  <CardTitle>Requested Courses</CardTitle>
                  <CardDescription>
                    Decisions apply immediately. Pending preferences are hidden from parents until approved.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tutorPreferencesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : tutorPreferenceData && tutorPreferenceData.length > 0 ? (
                    <div className="divide-y">
                      <div className="grid grid-cols-12 text-sm font-medium text-muted-foreground py-2">
                        <div className="col-span-4">Course</div>
                        <div className="col-span-2">Requested Rate</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-4 text-right">Actions</div>
                      </div>
                      {tutorPreferenceData.map((pref: any) => (
                        <div key={pref.id} className="grid grid-cols-12 items-center py-3 gap-2">
                          <div className="col-span-4">
                            <p className="font-semibold">{pref.courseTitle}</p>
                          </div>
                          <div className="col-span-2">
                            ${parseFloat(pref.hourlyRate || 0).toFixed(2)}
                          </div>
                          <div className="col-span-2">
                            <Badge
                              variant={
                                pref.approvalStatus === "APPROVED"
                                  ? "default"
                                  : pref.approvalStatus === "REJECTED"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {pref.approvalStatus}
                            </Badge>
                          </div>
                          <div className="col-span-4 flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatePreferenceStatus.isPending}
                              onClick={() =>
                                updatePreferenceStatus.mutate({
                                  preferenceId: pref.id,
                                  approvalStatus: "APPROVED",
                                })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={updatePreferenceStatus.isPending}
                              onClick={() =>
                                updatePreferenceStatus.mutate({
                                  preferenceId: pref.id,
                                  approvalStatus: "REJECTED",
                                })
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No preferences submitted by this tutor yet.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tutor Availability Tab */}
          <TabsContent value="availability" forceMount className={tabContentClass}>
            <TutorAvailabilityManager />
          </TabsContent>

          {/* Email Settings Tab */}
          <TabsContent value="email" forceMount className={tabContentClass}>
            <EmailSettings />
          </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
