import { useCallback, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, Copy, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const hasActiveAdvancedControls = staffFilter !== "all" || timeRangeFilter !== "all" || sortBy !== "joined_desc";
  const activeAdvancedControlCount = [
    staffFilter !== "all",
    timeRangeFilter !== "all",
    sortBy !== "joined_desc",
  ].filter(Boolean).length;
  const shouldShowFilterOptions = filtersOpen || hasActiveAdvancedControls;
  const waitingCountLabel = requests.length === 1 ? "1 person waiting" : `${requests.length} people waiting`;

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
    : "";

  const copyPhone = useCallback(async (phone: string) => {
    if (!phone) {
      toast({
        title: "No phone number",
        description: "This request has no phone number to copy",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(phone);
      toast({
        title: "Phone number copied",
        description: "Phone number copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy phone number",
        variant: "destructive",
      });
    }
  }, [toast]);

  if (locationsLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Waitlist</h1>
        <p className="text-sm text-muted-foreground">Loading location...</p>
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
              Subscription required to access waitlist
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
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="mb-1 text-3xl font-bold">Waitlist</h1>
            <p className="text-lg text-muted-foreground/80">
              People waiting for openings in{" "}
              <span className="font-semibold">
                {activeLocation?.name || "selected location"}
              </span>
            </p>
          </div>
        </div>

        {!locationId && (
          <div className="rounded-lg border border-dashed px-4 py-6">
            <h2 className="text-lg font-semibold">No location selected</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a location to view the current waitlist.
            </p>
          </div>
        )}

        {locationId && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">{waitingCountLabel}</p>

            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <Label htmlFor="waitlist-search" className="sr-only">
                  Search by name or phone
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="waitlist-search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by name or phone"
                    className="h-10 pl-9"
                    disabled={loading || isAccessBlocked}
                  />
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0 rounded-md"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={shouldShowFilterOptions}
                  aria-controls="waitlist-filters"
                  aria-label="Toggle filters and sort options"
                  disabled={loading || isAccessBlocked}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Filters
                  {activeAdvancedControlCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                      {activeAdvancedControlCount}
                    </span>
                  )}
                  <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${shouldShowFilterOptions ? "rotate-180" : ""}`} />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 shrink-0 rounded-md p-0 sm:w-auto sm:px-3"
                  onClick={refetch}
                  disabled={loading || isAccessBlocked}
                  aria-label="Refresh waitlist"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  <span className="sr-only sm:not-sr-only sm:ml-2">Refresh</span>
                </Button>
              </div>
            </div>

            {shouldShowFilterOptions && (
              <div id="waitlist-filters" className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="waitlist-sort" className="text-xs text-muted-foreground">
                      Sort
                    </Label>
                    <Select
                      value={sortBy}
                      onValueChange={(value) => setSortBy(value as SortValue)}
                      disabled={loading || isAccessBlocked}
                    >
                      <SelectTrigger id="waitlist-sort">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="joined_desc">Newest first</SelectItem>
                        <SelectItem value="joined_asc">Oldest first</SelectItem>
                        <SelectItem value="name_asc">Name A to Z</SelectItem>
                        <SelectItem value="name_desc">Name Z to A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="waitlist-staff-filter" className="text-xs text-muted-foreground">
                      Staff
                    </Label>
                    <Select
                      value={staffFilter}
                      onValueChange={(value) => setStaffFilter(value as StaffFilterValue)}
                      disabled={loading || isAccessBlocked}
                    >
                      <SelectTrigger id="waitlist-staff-filter">
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
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="waitlist-time-filter" className="text-xs text-muted-foreground">
                      Time range
                    </Label>
                    <Select
                      value={timeRangeFilter}
                      onValueChange={(value) => setTimeRangeFilter(value as TimeRangeFilterValue)}
                      disabled={loading || isAccessBlocked}
                    >
                      <SelectTrigger id="waitlist-time-filter">
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
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              {resultCountLabel && <div className="text-sm text-muted-foreground">{resultCountLabel}</div>}
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
              <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">Unable to load waitlist requests</p>
                <Button variant="outline" onClick={refetch}>
                  Try Again
                </Button>
              </div>
            )}

            {!loading && !error && requests.length === 0 && (
              <div className="rounded-lg border border-border px-4 py-10 text-center">
                <h3 className="text-lg font-semibold">No one is waiting right now</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  When customers join your waitlist, they&apos;ll appear here
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link to="/merchant/qr-code">View QR code</Link>
                </Button>
              </div>
            )}

            {!loading && !error && requests.length > 0 && filteredRequests.length === 0 && (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No requests match your current filters
                </p>
              </div>
            )}

            {!loading && !error && filteredRequests.length > 0 && (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredRequests.map((request) => (
                    <article key={request.id} className="rounded-lg border border-border/70 bg-card px-4 py-3">
                      <div className="space-y-2.5">
                        <div className="text-base font-medium">{request.consumerName}</div>
                        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                          <span>{request.consumerPhone || "-"}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => copyPhone(request.consumerPhone)}
                            disabled={!request.consumerPhone}
                            aria-label={`Copy phone number for ${request.consumerName}`}
                          >
                            <Copy className="mr-1.5 h-4 w-4" />
                            Copy
                          </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Prefers {request.staffName || "Any staff"} · {getTimeRangeDisplay(request.timeRange)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Joined {format(new Date(request.createdAt), "MMM d, h:mm a")}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-lg border border-border/70 md:block">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[25%]">Customer</TableHead>
                        <TableHead className="w-[25%]">Phone</TableHead>
                        <TableHead className="w-[30%]">Preference</TableHead>
                        <TableHead className="w-[20%]">Joined</TableHead>
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
                                aria-label={`Copy phone number for ${request.consumerName}`}
                              >
                                <Copy className="h-4 w-4" />
                                <span className="sr-only">Copy phone number</span>
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {request.staffName || "Any staff"} · {getTimeRangeDisplay(request.timeRange)}
                          </TableCell>
                          <TableCell>{format(new Date(request.createdAt), "MMM d, h:mm a")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotifyList;
