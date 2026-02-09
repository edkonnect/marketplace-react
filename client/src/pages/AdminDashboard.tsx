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
import { CourseAcuityMapping } from "@/components/CourseAcuityMapping";
import { QuickSetup } from "@/components/QuickSetup";
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

  const [dateRange, setDateRange] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});

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
            Monitor platform activity, users, enrollments, and payments
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
          <TabsList className="grid w-full max-w-6xl grid-cols-11">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="registered-tutors">Registered Tutors</TabsTrigger>
            <TabsTrigger value="availability">Tutor Availability</TabsTrigger>
            <TabsTrigger value="acuity">Acuity Mapping</TabsTrigger>
            <TabsTrigger value="quicksetup">Quick Setup</TabsTrigger>
            <TabsTrigger value="email">Email Settings</TabsTrigger>
            <TabsTrigger value="course-approval">Tutor Course Approval</TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
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

                {/* Payment Status Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-green-500" />
                      Payment Status
                    </CardTitle>
                    <CardDescription>
                      Payment completion rates
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
          <TabsContent value="users" className="space-y-4">
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
          <TabsContent value="enrollments" className="space-y-4">
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
                    <label className="text-sm font-medium mb-2 block">Payment Status</label>
                    <Select
                      value={enrollmentFilters.paymentStatus || 'all'}
                      onValueChange={(value) => setEnrollmentFilters({ ...enrollmentFilters, paymentStatus: value === 'all' ? undefined : value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All payment statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All payment statuses</SelectItem>
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
          <TabsContent value="payments" className="space-y-4">
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
                <CardTitle>All Payments</CardTitle>
                <CardDescription>
                  Showing {paymentsData?.payments.length || 0} of {paymentsData?.total || 0} payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : paymentsData && paymentsData.payments.length > 0 ? (
                  <div className="space-y-4">
                    {paymentsData.payments.map((payment) => (
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
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No payments found</p>
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

          {/* Courses Tab */}
          <TabsContent value="courses" className="space-y-4">
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
          <TabsContent value="registered-tutors" className="space-y-4">
            <RegisteredTutorsManager />
          </TabsContent>

          {/* Tutor Course Approval Tab */}
          <TabsContent value="course-approval" className="space-y-4">
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
          <TabsContent value="availability" className="space-y-4">
            <TutorAvailabilityManager />
          </TabsContent>

          {/* Acuity Mapping Tab */}
          <TabsContent value="acuity" className="space-y-4">
            <CourseAcuityMapping />
          </TabsContent>

          {/* Quick Setup Tab */}
          <TabsContent value="quicksetup" className="space-y-4">
            <QuickSetup />
          </TabsContent>

          {/* Email Settings Tab */}
          <TabsContent value="email" className="space-y-4">
            <EmailSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
