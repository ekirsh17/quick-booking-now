import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Bell, CalendarIcon, Check, ChevronDown, Copy, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useMediaQuery } from "@/hooks/use-mobile";
import { useNotifyList } from "@/hooks/useNotifyList";
import { cn } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/utils/phoneValidation";
import {
  formatTimeRangeDisplay,
  getDateKeyForTimeZone,
  WAITLIST_CUSTOM_TIME_RANGE_FILTER,
  WAITLIST_TIME_RANGE_PRESET_OPTIONS,
  waitlistRequestMatchesFilterRange,
} from "@/utils/notifyTimeRangeDisplay";

type StaffFilterValue = "all" | string;
type TimeRangeFilterValue = "all" | string;
type SortValue = "joined_desc" | "joined_asc" | "name_asc" | "name_desc";

const formatWaitlistPhone = (phone: string) => (phone ? formatPhoneForDisplay(phone) : "-");

/** Waitlist filter controls use an explicit white field surface on all viewports/themes. */
const WAITLIST_FILTER_FIELD_CLASS =
  "bg-white hover:bg-white focus:bg-white dark:bg-white dark:hover:bg-white dark:focus:bg-white";
const WAITLIST_FILTER_DATE_BUTTON_CLASS = cn(
  WAITLIST_FILTER_FIELD_CLASS,
  "hover:!bg-white hover:!text-foreground hover:!border-input dark:hover:!bg-white dark:hover:!text-foreground"
);
const WAITLIST_FILTER_MENU_CLASS = "bg-white text-foreground dark:bg-white";
const WAITLIST_FILTER_POPOVER_CLASS =
  "w-auto border border-input bg-white p-0 dark:border-input dark:bg-white";

const toTelHref = (raw: string) => {
  const cleaned = raw.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned.replace(/\D/g, "")}`;
};

interface WaitlistPhoneRowProps {
  phone: string;
  consumerName: string;
  copied?: boolean;
  linkable?: boolean;
  compact?: boolean;
  /** Mobile: copy icon sits left of the number so the number can align with other rows. */
  copyFirst?: boolean;
  onCopy: () => void | Promise<void>;
}

interface WaitlistMobileCardProps {
  consumerName: string;
  consumerPhone: string;
  staffName: string | null;
  timeRange: string;
  createdAt: string;
  copied: boolean;
  onCopyPhone: () => void | Promise<void>;
}

const WaitlistMobileCard = ({
  consumerName,
  consumerPhone,
  staffName,
  timeRange,
  createdAt,
  copied,
  onCopyPhone,
}: WaitlistMobileCardProps) => (
  <article className="overflow-hidden rounded-lg border border-border/70 bg-card">
    <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
      <p className="text-base font-semibold leading-tight text-foreground">{consumerName}</p>
    </div>
    <div className="space-y-2.5 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="w-[4.75rem] shrink-0 text-xs font-medium leading-none text-muted-foreground">
          Phone
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end">
          <WaitlistPhoneRow
            phone={consumerPhone}
            consumerName={consumerName}
            copied={copied}
            linkable
            compact
            copyFirst
            onCopy={onCopyPhone}
          />
        </div>
      </div>
      <hr className="mx-2 border-border/40" />
      <div className="flex items-start justify-between gap-4">
        <span className="w-[4.75rem] shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
          Staff
        </span>
        <p className="min-w-0 flex-1 text-right text-sm leading-snug text-foreground">
          {staffName || "Any staff"}
        </p>
      </div>
      <hr className="mx-2 border-border/40" />
      <div className="flex items-start justify-between gap-4">
        <span className="w-[4.75rem] shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
          Availability
        </span>
        <p className="min-w-0 flex-1 text-right text-sm leading-snug text-foreground">
          {formatTimeRangeDisplay(timeRange)}
        </p>
      </div>
      <hr className="mx-2 border-border/40" />
      <div className="flex items-start justify-between gap-4">
        <span className="w-[4.75rem] shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
          Joined
        </span>
        <time
          dateTime={createdAt}
          className="min-w-0 flex-1 text-right text-sm tabular-nums text-foreground"
        >
          {format(new Date(createdAt), "MMM d, h:mm a")}
        </time>
      </div>
    </div>
  </article>
);

const WaitlistPhoneRow = ({
  phone,
  consumerName,
  copied = false,
  linkable = false,
  compact = false,
  copyFirst = false,
  onCopy,
}: WaitlistPhoneRowProps) => {
  const formatted = formatWaitlistPhone(phone);
  const hasPhone = Boolean(phone);
  const phoneTextClass = compact
    ? "text-sm leading-none tabular-nums text-foreground text-right"
    : "text-sm tabular-nums text-foreground";

  const copyButton = (
    <Button
      variant="ghost"
      size="icon"
      className={compact ? "h-7 w-7 shrink-0" : "h-8 w-8 shrink-0"}
      onClick={() => void onCopy()}
      disabled={!hasPhone}
      aria-label={`Copy phone number for ${consumerName}`}
    >
      {copied ? (
        <Check className={compact ? "h-3.5 w-3.5 text-primary" : "h-4 w-4 text-primary"} />
      ) : (
        <Copy className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      )}
      <span className="sr-only">{copied ? "Copied phone number" : "Copy phone number"}</span>
    </Button>
  );

  const phoneLabel =
    linkable && hasPhone ? (
      <a
        href={`tel:${toTelHref(phone)}`}
        className={`${phoneTextClass} hover:underline`}
      >
        {formatted}
      </a>
    ) : (
      <span className={phoneTextClass}>{formatted}</span>
    );

  return (
    <div className={`inline-flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      {copyFirst ? (
        <>
          {copyButton}
          {phoneLabel}
        </>
      ) : (
        <>
          {phoneLabel}
          {copyButton}
        </>
      )}
    </div>
  );
};

const NotifyList = () => {
  const entitlements = useEntitlements();
  const [searchQuery, setSearchQuery] = useState("");
  const [staffFilter, setStaffFilter] = useState<StaffFilterValue>("all");
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilterValue>("all");
  const [customFilterStartDate, setCustomFilterStartDate] = useState<Date>();
  const [customFilterEndDate, setCustomFilterEndDate] = useState<Date>();
  const [isCustomFilterStartOpen, setIsCustomFilterStartOpen] = useState(false);
  const [isCustomFilterEndOpen, setIsCustomFilterEndOpen] = useState(false);
  const [customFilterDateError, setCustomFilterDateError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortValue>("joined_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null);
  const isCompactMobile = useMediaQuery("(max-width: 390px)");

  const {
    locationId,
    locations,
    loading: locationsLoading,
  } = useActiveLocation();

  const activeLocation = useMemo(
    () => locations.find((loc) => loc.id === locationId) || null,
    [locationId, locations]
  );
  const showLocationScopeCues = locations.length > 1;
  const merchantTimeZone =
    activeLocation?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  const showCustomTimeRangeSubFilter = timeRangeFilter === WAITLIST_CUSTOM_TIME_RANGE_FILTER;

  const hasCustomFilterRange = Boolean(customFilterStartDate && customFilterEndDate);

  const handlePrimaryTimeRangeChange = (value: string) => {
    if (value === WAITLIST_CUSTOM_TIME_RANGE_FILTER) {
      setTimeRangeFilter(value);
      return;
    }

    setTimeRangeFilter(value);
    setCustomFilterStartDate(undefined);
    setCustomFilterEndDate(undefined);
    setCustomFilterDateError(null);
  };

  const handleCustomFilterStartSelect = (date: Date | undefined) => {
    setCustomFilterStartDate(date);
    setCustomFilterDateError(null);
    if (date && customFilterEndDate && customFilterEndDate.getTime() < date.getTime()) {
      setCustomFilterEndDate(undefined);
    }
    if (date) setIsCustomFilterStartOpen(false);
  };

  const handleCustomFilterEndSelect = (date: Date | undefined) => {
    if (customFilterStartDate && date && date.getTime() < customFilterStartDate.getTime()) {
      setCustomFilterDateError("End date must be on or after start date.");
      return;
    }
    setCustomFilterEndDate(date);
    setCustomFilterDateError(null);
    if (date) setIsCustomFilterEndOpen(false);
  };

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryDigits = searchQuery.replace(/\D/g, "");

    const filtered = requests.filter((request) => {
      if (staffFilter !== "all" && request.staffId !== staffFilter) return false;

      if (timeRangeFilter !== "all") {
        if (timeRangeFilter === WAITLIST_CUSTOM_TIME_RANGE_FILTER) {
          if (customFilterStartDate && customFilterEndDate) {
            const filterStartKey = getDateKeyForTimeZone(customFilterStartDate, merchantTimeZone);
            const filterEndKey = getDateKeyForTimeZone(customFilterEndDate, merchantTimeZone);
            if (
              !waitlistRequestMatchesFilterRange(
                request.timeRange,
                filterStartKey,
                filterEndKey,
                merchantTimeZone
              )
            ) {
              return false;
            }
          }
        } else if (request.timeRange !== timeRangeFilter) {
          return false;
        }
      }

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
  }, [
    requests,
    searchQuery,
    staffFilter,
    timeRangeFilter,
    customFilterStartDate,
    customFilterEndDate,
    merchantTimeZone,
    sortBy,
  ]);

  const hasActiveTimeRangeSelection = timeRangeFilter !== "all";

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || staffFilter !== "all" || hasActiveTimeRangeSelection;

  const activeAdvancedControlCount = [
    staffFilter !== "all",
    hasActiveTimeRangeSelection,
    sortBy !== "joined_desc",
  ].filter(Boolean).length;
  const waitingCountLabel = requests.length === 1 ? "1 person waiting" : `${requests.length} people waiting`;

  const resetFilters = () => {
    setSearchQuery("");
    setStaffFilter("all");
    setTimeRangeFilter("all");
    setCustomFilterStartDate(undefined);
    setCustomFilterEndDate(undefined);
    setCustomFilterDateError(null);
    setSortBy("joined_desc");
    setFiltersOpen(false);
  };

  const isFiltered = hasActiveFilters;
  const waitingNoun = requests.length === 1 ? "person" : "people";
  const resultCountLabel = isFiltered
    ? `Showing ${filteredRequests.length} of ${requests.length} ${waitingNoun} waiting`
    : "";

  const copyPhone = useCallback(async (phone: string) => {
    if (!phone) return false;

    try {
      await navigator.clipboard.writeText(phone);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!copiedRequestId) return;
    const timeoutId = window.setTimeout(() => setCopiedRequestId(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copiedRequestId]);

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
        data-tour-target="waitlist-list"
      >
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="mb-1 text-3xl font-bold">Waitlist</h1>
            <p className="text-lg text-muted-foreground/80">
              {showLocationScopeCues ? (
                <>
                  People waiting for openings in{" "}
                  <span className="font-semibold">
                    {activeLocation?.name || "selected location"}
                  </span>
                </>
              ) : (
                "People waiting for openings"
              )}
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
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">{waitingCountLabel}</p>

            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor="waitlist-search" className="sr-only">
                  Search by name or phone
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="waitlist-search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={isCompactMobile ? "Search" : "Search by name or phone"}
                    className="h-10 pl-9"
                    disabled={loading || isAccessBlocked}
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0 rounded-md px-2 sm:px-3"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
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
                  <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
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

            {filtersOpen && (
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
                      <SelectTrigger id="waitlist-sort" className={WAITLIST_FILTER_FIELD_CLASS}>
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent align="end" className={WAITLIST_FILTER_MENU_CLASS}>
                        <SelectItem value="joined_desc" showCheckIndicator={false}>Newest first</SelectItem>
                        <SelectItem value="joined_asc" showCheckIndicator={false}>Oldest first</SelectItem>
                        <SelectItem value="name_asc" showCheckIndicator={false}>Name A to Z</SelectItem>
                        <SelectItem value="name_desc" showCheckIndicator={false}>Name Z to A</SelectItem>
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
                      <SelectTrigger id="waitlist-staff-filter" className={WAITLIST_FILTER_FIELD_CLASS}>
                        <SelectValue placeholder="Staff" />
                      </SelectTrigger>
                      <SelectContent className={WAITLIST_FILTER_MENU_CLASS}>
                        <SelectItem value="all" showCheckIndicator={false}>All staff</SelectItem>
                        {staffOptions.map(([staffId, staffName]) => (
                          <SelectItem key={staffId} value={staffId} showCheckIndicator={false}>
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
                      onValueChange={handlePrimaryTimeRangeChange}
                      disabled={loading || isAccessBlocked}
                    >
                      <SelectTrigger id="waitlist-time-filter" className={WAITLIST_FILTER_FIELD_CLASS}>
                        <SelectValue placeholder="Time range" />
                      </SelectTrigger>
                      <SelectContent className={WAITLIST_FILTER_MENU_CLASS}>
                        <SelectItem value="all" showCheckIndicator={false}>All</SelectItem>
                        {WAITLIST_TIME_RANGE_PRESET_OPTIONS.map((timeRange) => (
                          <SelectItem key={timeRange} value={timeRange} showCheckIndicator={false}>
                            {formatTimeRangeDisplay(timeRange)}
                          </SelectItem>
                        ))}
                        <SelectItem
                          value={WAITLIST_CUSTOM_TIME_RANGE_FILTER}
                          showCheckIndicator={false}
                        >
                          Custom dates
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {showCustomTimeRangeSubFilter && (
                  <div className="mt-3 space-y-3 rounded-md border border-border/60 bg-white p-3 dark:bg-white">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="waitlist-custom-filter-start" className="text-xs text-muted-foreground">
                          Start date
                        </Label>
                        <Popover open={isCustomFilterStartOpen} onOpenChange={setIsCustomFilterStartOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              id="waitlist-custom-filter-start"
                              type="button"
                              variant="outline"
                              className={cn(
                                WAITLIST_FILTER_DATE_BUTTON_CLASS,
                                "h-10 w-full justify-start text-left font-normal",
                                !customFilterStartDate && "text-muted-foreground"
                              )}
                              disabled={loading || isAccessBlocked}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              {customFilterStartDate ? format(customFilterStartDate, "PPP") : "Pick date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className={WAITLIST_FILTER_POPOVER_CLASS} align="start">
                            <Calendar
                              mode="single"
                              selected={customFilterStartDate}
                              onSelect={handleCustomFilterStartSelect}
                              initialFocus
                              className="pointer-events-auto bg-white dark:bg-white"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="waitlist-custom-filter-end" className="text-xs text-muted-foreground">
                          End date
                        </Label>
                        <Popover open={isCustomFilterEndOpen} onOpenChange={setIsCustomFilterEndOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              id="waitlist-custom-filter-end"
                              type="button"
                              variant="outline"
                              className={cn(
                                WAITLIST_FILTER_DATE_BUTTON_CLASS,
                                "h-10 w-full justify-start text-left font-normal",
                                !customFilterEndDate && "text-muted-foreground"
                              )}
                              disabled={loading || isAccessBlocked}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              {customFilterEndDate ? format(customFilterEndDate, "PPP") : "Pick date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className={WAITLIST_FILTER_POPOVER_CLASS} align="start">
                            <Calendar
                              mode="single"
                              selected={customFilterEndDate}
                              onSelect={handleCustomFilterEndSelect}
                              disabled={customFilterStartDate ? { before: customFilterStartDate } : undefined}
                              initialFocus
                              className="pointer-events-auto bg-white dark:bg-white"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    {customFilterDateError && (
                      <p className="text-xs text-destructive">{customFilterDateError}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {(resultCountLabel || hasActiveFilters) && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {resultCountLabel ? (
                  <p className="text-sm text-muted-foreground">{resultCountLabel}</p>
                ) : (
                  <span className="sr-only">Filters active</span>
                )}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto shrink-0"
                    onClick={resetFilters}
                    disabled={loading || isAccessBlocked}
                  >
                    Reset filters
                  </Button>
                )}
              </div>
            )}

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
              <div className="rounded-xl border border-border bg-card p-12 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">No one is waiting yet</h3>
                  <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                    Share your QR code or link so customers can join your waitlist
                  </p>
                </div>
                <Button asChild size="sm" className="min-h-11">
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
                    <WaitlistMobileCard
                      key={request.id}
                      consumerName={request.consumerName}
                      consumerPhone={request.consumerPhone}
                      staffName={request.staffName}
                      timeRange={request.timeRange}
                      createdAt={request.createdAt}
                      copied={copiedRequestId === request.id}
                      onCopyPhone={async () => {
                        const copied = await copyPhone(request.consumerPhone);
                        if (copied) setCopiedRequestId(request.id);
                      }}
                    />
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-lg border border-border/70 md:block">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[18%]">Customer</TableHead>
                        <TableHead className="w-[30%]">Phone</TableHead>
                        <TableHead className="w-[14%]">Staff</TableHead>
                        <TableHead className="w-[22%]">Availability</TableHead>
                        <TableHead className="w-[16%]">Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.consumerName}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <WaitlistPhoneRow
                              phone={request.consumerPhone}
                              consumerName={request.consumerName}
                              onCopy={() => copyPhone(request.consumerPhone)}
                            />
                          </TableCell>
                          <TableCell className="text-sm">
                            {request.staffName || "Any staff"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatTimeRangeDisplay(request.timeRange)}
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
