import { useCallback, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpDown, Copy, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useNotifyList } from "@/hooks/useNotifyList";
import { useToast } from "@/hooks/use-toast";

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isDateKey = (value: string) => DATE_KEY_REGEX.test(value);

const getTimeRangeDisplay = (timeRange: string) => {
  if (isDateKey(timeRange)) {
    return format(parseISO(timeRange), "MMM d");
  }

  const ranges: Record<string, string> = {
    today: "Today",
    "3-days": "Next 3 Days",
    "5-days": "Next 5 Days",
    "1-week": "Next Week",
    tomorrow: "Tomorrow",
    this_week: "This Week",
    next_week: "Next Week",
    anytime: "Anytime",
  };

  return ranges[timeRange] || timeRange;
};

type StaffFilterValue = "all" | string;
type TimeRangeFilterValue = "all" | string;
type SortValue = "joined_desc" | "joined_asc" | "name_asc" | "name_desc";

const NotifyList = () => {
  const { toast } = useToast();
  const entitlements = useEntitlements();
  const [searchQuery, setSearchQuery] = useState("");
  const [staffFilter, setStaffFilter] = useState<StaffFilterValue>("all");
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilterValue>("all");
  const [sortBy, setSortBy] = useState<SortValue>("joined_desc");

  const {
    locationId,
    locations,
    loading: locationsLoading,
  } = useActiveLocation();

  const activeLocation = useMemo(
    () => locations.find((loc) => loc.id === locationId) || null,
    [locationId, locations]
  );

  const isCanceledLocked = !entitlements.loading
    && entitlements.subscriptionData.isCanceled
    && !entitlements.subscriptionData.isCanceledTrial;
  const isReadOnlyAccess = !entitlements.loading
    && !!entitlements.subscriptionData.subscription
    && entitlements.trialExpired
    && !entitlements.isSubscribed
    && !isCanceledLocked;
  const isAccessBlocked = isCanceledLocked || isReadOnlyAccess;

  const {
    requests,
    loading,
    error,
    refetch,
  } = useNotifyList(
    isAccessBlocked ? null : locationId,
    activeLocation?.time_zone || null
  );

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach((request) => {
      if (!request.staffId || map.has(request.staffId)) return;
      map.set(request.staffId, request.staffName || "Unknown/Inactive staff");
    });

    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);

  const timeRangeOptions = useMemo(() => {
    const uniqueRanges = Array.from(new Set(requests.map((request) => request.timeRange)));
    return uniqueRanges.sort((a, b) => {
      const aIsDate = isDateKey(a);
      const bIsDate = isDateKey(b);

      if (aIsDate && bIsDate) return a.localeCompare(b);
      if (aIsDate) return -1;
      if (bIsDate) return 1;
      return getTimeRangeDisplay(a).localeCompare(getTimeRangeDisplay(b));
    });
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryDigits = searchQuery.replace(/\D/g, "");

    const filtered = requests.filter((request) => {
      if (staffFilter !== "all" && request.staffId !== staffFilter) return false;
      if (timeRangeFilter !== "all" && request.timeRange !== timeRangeFilter) return false;

      if (!query) return true;

      const consumerName = request.consumerName.toLowerCase();
      const consumerPhone = request.consumerPhone.toLowerCase();
      const phoneDigits = request.consumerPhone.replace(/\D/g, "");

      return (
        consumerName.includes(query)
        || consumerPhone.includes(query)
        || (queryDigits.length > 0 && phoneDigits.includes(queryDigits))
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "joined_asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name_asc":
          return a.consumerName.localeCompare(b.consumerName);
        case "name_desc":
          return b.consumerName.localeCompare(a.consumerName);
        case "joined_desc":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [requests, searchQuery, staffFilter, timeRangeFilter, sortBy]);

  const hasActiveFilters = Boolean(searchQuery.trim()) || staffFilter !== "all" || timeRangeFilter !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setStaffFilter("all");
    setTimeRangeFilter("all");
    setSortBy("joined_desc");
  };

  const isFiltered = hasActiveFilters;
  const waitingNoun = requests.length === 1 ? "person" : "people";
  const resultCountLabel = isFiltered
    ? `Showing ${filteredRequests.length} of ${requests.length} ${waitingNoun} waiting`
    : `${requests.length} ${waitingNoun} waiting`;

  const copyPhone = useCallback(async (phone: string) => {
    if (!phone) {
      toast({
        title: "No phone number",
        description: "This request has no phone number to copy.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(phone);
      toast({
        title: "Phone number copied",
        description: "Phone number copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy phone number.",
        variant: "destructive",
      });
    }
  }, [toast]);

  if (locationsLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Waitlist</h1>
        <Card>
          <CardContent className="pt-6 text-muted-foreground">Loading location...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative space-y-7">
      {isCanceledLocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
          <div className="max-w-md rounded-lg border bg-card px-6 py-4 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Your subscription has ended. Reactivate to access your waitlist.
            </p>
            <Button asChild size="sm" className="mt-3">
              <Link to="/merchant/billing">Reactivate Subscription</Link>
            </Button>
          </div>
        </div>
      )}
      {isReadOnlyAccess && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
          <div className="max-w-md rounded-lg border bg-card px-6 py-4 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Subscription required to access waitlist.
            </p>
          </div>
        </div>
      )}
      <div
        className={
          isCanceledLocked
            ? "pointer-events-none blur-sm"
            : isReadOnlyAccess
              ? "pointer-events-none opacity-60"
              : ""
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="pb-2">
            <h1 className="mb-1 text-3xl font-bold">Waitlist</h1>
            <p className="text-lg text-muted-foreground/80">
              People currently waiting for openings in {activeLocation?.name || "selected location"}.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={refetch}
              disabled={loading || isAccessBlocked}
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </div>

        {!locationId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">No location selected</CardTitle>
              <CardDescription>Select a location to view the current waitlist.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {locationId && (
          <>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">People Waiting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by customer name or phone"
                      className="pl-9"
                      disabled={loading || isAccessBlocked}
                    />
                  </div>
                  <Select
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as SortValue)}
                    disabled={loading || isAccessBlocked}
                  >
                    <SelectTrigger
                      className="h-9 w-9 justify-center border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-muted/40 hover:text-foreground focus:ring-0 focus:ring-offset-0 [&>svg:last-child]:hidden"
                      aria-label="Sort requests"
                    >
                      <ArrowUpDown className="h-5 w-5" />
                      <span className="sr-only">Sort requests</span>
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="joined_desc">Newest first</SelectItem>
                      <SelectItem value="joined_asc">Oldest first</SelectItem>
                      <SelectItem value="name_asc">Name A to Z</SelectItem>
                      <SelectItem value="name_desc">Name Z to A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    value={staffFilter}
                    onValueChange={(value) => setStaffFilter(value as StaffFilterValue)}
                    disabled={loading || isAccessBlocked}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All staff</SelectItem>
                      {staffOptions.map(([staffId, staffName]) => (
                        <SelectItem key={staffId} value={staffId}>
                          {staffName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={timeRangeFilter}
                    onValueChange={(value) => setTimeRangeFilter(value as TimeRangeFilterValue)}
                    disabled={loading || isAccessBlocked}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Time range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time ranges</SelectItem>
                      {timeRangeOptions.map((timeRange) => (
                        <SelectItem key={timeRange} value={timeRange}>
                          {getTimeRangeDisplay(timeRange)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">{resultCountLabel}</div>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} disabled={loading || isAccessBlocked}>
                      Reset filters
                    </Button>
                  )}
                </div>

                {loading && (
                  <div className="text-sm text-muted-foreground">Loading waitlist requests...</div>
                )}

                {!loading && error && (
                  <div className="space-y-3">
                    <p className="text-sm text-destructive">Unable to load waitlist requests.</p>
                    <Button variant="outline" onClick={refetch}>
                      Try Again
                    </Button>
                  </div>
                )}

                {!loading && !error && requests.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No one is waiting right now.
                  </p>
                )}

                {!loading && !error && requests.length > 0 && filteredRequests.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No requests match your current filters.
                  </p>
                )}

                {!loading && !error && filteredRequests.length > 0 && (
                  <>
                    <div className="space-y-3 md:hidden">
                      {filteredRequests.map((request) => (
                        <Card key={request.id}>
                          <CardContent className="space-y-2.5 p-4">
                            <div className="font-medium">{request.consumerName}</div>
                            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                              <span>Phone: {request.consumerPhone || "-"}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => copyPhone(request.consumerPhone)}
                                disabled={!request.consumerPhone}
                              >
                                <Copy className="h-4 w-4" />
                                <span className="sr-only">Copy phone number</span>
                              </Button>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Preferred Staff: {request.staffName || "Any staff"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Preferred Time: {getTimeRangeDisplay(request.timeRange)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Joined Waitlist: {format(new Date(request.createdAt), "MMM d, h:mm a")}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="hidden md:block">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[22%]">Customer</TableHead>
                            <TableHead className="w-[22%]">Phone</TableHead>
                            <TableHead className="w-[16%]">Preferred Staff</TableHead>
                            <TableHead className="w-[20%]">Preferred Time</TableHead>
                            <TableHead className="w-[20%]">Joined Waitlist</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRequests.map((request) => (
                            <TableRow key={request.id}>
                              <TableCell className="font-medium">{request.consumerName}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{request.consumerPhone || "-"}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => copyPhone(request.consumerPhone)}
                                    disabled={!request.consumerPhone}
                                  >
                                    <Copy className="h-4 w-4" />
                                    <span className="sr-only">Copy phone number</span>
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>{request.staffName || "Any staff"}</TableCell>
                              <TableCell>{getTimeRangeDisplay(request.timeRange)}</TableCell>
                              <TableCell>{format(new Date(request.createdAt), "MMM d, h:mm a")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default NotifyList;
