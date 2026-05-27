import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CheckCircle2, XCircle, RefreshCw, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function AdminLoginReport() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "logged-in" | "not-logged-in">("all");

  const { data = [], isLoading, isError, error, refetch, isFetching } =
    trpc.admin.getLoginReport.useQuery();

  const filtered = data.filter((u) => {
    const matchesSearch =
      !search.trim() ||
      u.parentName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.students.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter =
      filter === "all" ||
      (filter === "logged-in" && u.loggedInToday) ||
      (filter === "not-logged-in" && !u.loggedInToday);
    return matchesSearch && matchesFilter;
  });

  const loggedInCount = data.filter((u) => u.loggedInToday).length;
  const notLoggedInCount = data.filter((u) => !u.loggedInToday).length;
  const loading = isLoading || isFetching;

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Login Report</h2>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Parents
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered parents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Logged In Today
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{loggedInCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.length > 0
                ? `${Math.round((loggedInCount / data.length) * 100)}% of parents`
                : "No parents yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Not Logged In
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{notLoggedInCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.length > 0
                ? `${Math.round((notLoggedInCount / data.length) * 100)}% of parents`
                : "No parents yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Student Portal Access</CardTitle>
              <CardDescription>
                Track which students' parents have logged into the portal today
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by student name, parent name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "logged-in", "not-logged-in"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f)}
                >
                  {f === "all"
                    ? "All"
                    : f === "logged-in"
                    ? "Logged In"
                    : "Not Logged In"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-destructive">
              {(error as any)?.message || "Something went wrong"}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No records found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left bg-muted/30">
                    <th className="py-3 px-4 font-semibold text-muted-foreground w-[30%]">Student(s)</th>
                    <th className="py-3 px-4 font-semibold text-muted-foreground w-[20%]">Parent Name</th>
                    <th className="py-3 px-4 font-semibold text-muted-foreground w-[25%]">Email</th>
                    <th className="py-3 px-4 font-semibold text-muted-foreground w-[12%]">Status</th>
                    <th className="py-3 px-4 font-semibold text-muted-foreground w-[13%]">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        {u.students.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.students.map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">No students</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium whitespace-nowrap">{u.parentName}</td>
                      <td className="py-3 px-4 text-muted-foreground break-all">{u.email}</td>
                      <td className="py-3 px-4">
                        {u.loggedInToday ? (
                          <Badge className="bg-green-100 text-green-800 border border-green-200 gap-1 whitespace-nowrap">
                            <CheckCircle2 className="h-3 w-3" /> Logged In
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-red-600 border-red-200 gap-1 whitespace-nowrap"
                          >
                            <XCircle className="h-3 w-3" /> Not Logged In
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}