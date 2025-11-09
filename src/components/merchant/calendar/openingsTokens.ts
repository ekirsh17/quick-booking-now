/**
 * Design tokens for Openings calendar views
 * Single source of truth extracted from MonthView
 */

export const openingsTokens = {
  // Page container
  container: "space-y-4",
  
  // Page header (title + subtitle)
  pageHeader: {
    wrapper: "space-y-1",
    title: "text-3xl font-bold tracking-tight",
    subtitle: "text-sm text-muted-foreground",
  },

  // Calendar controls (nav + view selector)
  controls: {
    wrapper: "flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-card p-4 rounded-lg border shadow-sm",
    navGroup: "flex items-center gap-2",
    navButton: "h-9 w-9",
    todayButton: "h-9 px-3 min-w-[80px]",
    datePickerButton: "h-9 px-3 ml-2",
    addButton: "hidden md:flex gap-2",
    viewSelector: {
      wrapper: "flex gap-1 bg-muted p-1 rounded-md",
      button: "h-8 px-4",
    },
  },

  // Calendar card container (all views)
  card: {
    wrapper: "bg-card rounded-lg border shadow-sm overflow-hidden",
    padding: "p-0", // Month/Day have no padding, Week needs p-4 for react-big-calendar
  },

  // Grid structure
  grid: {
    // Week day headers (Sun-Sat)
    headerRow: "grid grid-cols-7 border-b bg-muted/50",
    headerCell: "p-2 text-center text-xs font-semibold text-muted-foreground",
    
    // Calendar body
    bodyGrid: "grid grid-cols-7",
    
    // Individual cells
    cell: "aspect-square p-2 border-r border-b hover:bg-accent transition-colors text-center relative",
    cellOutOfRange: "bg-muted/20 text-muted-foreground",
    cellToday: "bg-primary/5",
    
    // Time column (Day/Week views)
    timeCol: {
      width: "w-16 md:w-20",
      label: "text-xs font-semibold text-muted-foreground",
      labelCurrent: "text-primary",
    },
  },

  // Typography
  typography: {
    dateNumber: "text-sm font-medium",
    dateNumberToday: "text-sm font-medium text-primary font-bold",
    slotCount: "text-xs text-muted-foreground",
    slotTime: "text-xs font-bold",
    slotDuration: "text-xs opacity-90",
    slotName: "text-sm font-semibold",
    slotCustomer: "text-xs opacity-90",
  },

  // Status indicators
  status: {
    dot: "w-1.5 h-1.5 rounded-full",
    dotGroup: "flex gap-1 justify-center mt-1",
    colors: {
      open: "bg-emerald-500",
      pending: "bg-amber-300",
      booked: "bg-blue-500",
    },
    slotColors: {
      open: "bg-emerald-500 text-white border-emerald-600",
      pending_confirmation: "bg-amber-300 text-gray-900 border-amber-400",
      booked: "bg-blue-500 text-white border-blue-600",
    },
  },

  // Slot cards (Day/Week views)
  slot: {
    wrapper: "rounded-md p-3 shadow-sm border cursor-pointer transition-all hover:shadow-md",
    row: "w-full p-4 text-left hover:bg-accent transition-colors border-b last:border-b-0",
    rowCurrent: "bg-primary/5",
    container: "flex-1 min-h-[40px]",
    empty: "flex items-center h-[40px] text-xs text-muted-foreground",
  },

  // Floating Action Button
  fab: {
    wrapper: "fixed right-6 bottom-6 md:right-8 md:bottom-8 z-40 transition-opacity duration-300",
    button: "h-14 w-14 rounded-full shadow-lg",
    hidden: "opacity-0 pointer-events-none",
    visible: "opacity-100",
  },
} as const;
