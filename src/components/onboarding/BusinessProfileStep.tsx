import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import {
  BUSINESS_TYPE_OPTIONS,
  LOCATION_COUNT_OPTIONS,
  TEAM_SIZE_OPTIONS,
  WEEKLY_APPOINTMENT_OPTIONS,
} from '@/types/businessProfile';
import { BOOKING_SYSTEM_OPTIONS, ONBOARDING_NO_BOOKING_SYSTEM_VALUE } from '@/types/bookingSystems';
import { FALLBACK_AOV, getIndustryAovDefault } from '@/constants/aovDefaults';

const profileSchema = z.object({
  businessType: z.string().min(1, "Business type is required"),
  businessTypeOther: z.string().optional(),
  weeklyAppointments: z.string().min(1, "Weekly appointment volume is required"),
  locationCount: z.string().min(1, "Location count is required"),
  teamSize: z.string().min(1, "Team size is required"),
  bookingSystemProvider: z.string().min(1, "Current booking system is required"),
  staffFirstName: z.string().trim().min(1, "Primary staff first name is required"),
  staffLastName: z.string().optional(),
}).refine((data) => {
  if (data.businessType === 'other') {
    return Boolean(data.businessTypeOther && data.businessTypeOther.trim().length > 0);
  }
  return true;
}, {
  message: "Please specify your business type",
  path: ['businessTypeOther'],
});

interface BusinessProfileStepProps {
  businessType: string;
  businessTypeOther: string;
  weeklyAppointments: string;
  locationCount: string;
  teamSize: string;
  bookingSystemProvider: string;
  staffFirstName: string;
  staffLastName: string;
  onBusinessTypeChange: (value: string) => void;
  onBusinessTypeOtherChange: (value: string) => void;
  onWeeklyAppointmentsChange: (value: string) => void;
  onLocationCountChange: (value: string) => void;
  onTeamSizeChange: (value: string) => void;
  onBookingSystemProviderChange: (value: string) => void;
  onStaffFirstNameChange: (value: string) => void;
  onStaffLastNameChange: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

type SizingSection = 'location' | 'team' | 'weekly' | 'staff';
const SECTION_TRANSITION = {
  layout: {
    duration: 0.2,
    ease: [0.22, 1, 0.36, 1],
  },
  opacity: {
    duration: 0.18,
    ease: [0.22, 1, 0.36, 1],
  },
  y: {
    duration: 0.18,
    ease: [0.22, 1, 0.36, 1],
  },
} as const;
const getNextIncompleteSection = ({
  locationCount,
  teamSize,
  weeklyAppointments,
  staffFirstName,
}: {
  locationCount: string;
  teamSize: string;
  weeklyAppointments: string;
  staffFirstName: string;
}): SizingSection | null => {
  if (!locationCount) return 'location';
  if (!teamSize) return 'team';
  if (!weeklyAppointments) return 'weekly';
  if (!staffFirstName.trim()) return 'staff';
  return null;
};

export function BusinessProfileStep({
  businessType,
  businessTypeOther,
  weeklyAppointments,
  locationCount,
  teamSize,
  bookingSystemProvider,
  staffFirstName,
  staffLastName,
  onBusinessTypeChange,
  onBusinessTypeOtherChange,
  onWeeklyAppointmentsChange,
  onLocationCountChange,
  onTeamSizeChange,
  onBookingSystemProviderChange,
  onStaffFirstNameChange,
  onStaffLastNameChange,
  onContinue,
  onBack,
  isLoading = false,
}: BusinessProfileStepProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [editingSection, setEditingSection] = useState<SizingSection | null>('location');
  const suppressStaffCollapseRef = useRef(false);

  const handleBusinessTypeChange = (value: string) => {
    onBusinessTypeChange(value);
    if (value !== 'other') {
      onBusinessTypeOtherChange('');
    }
  };

  const isBusinessTypeComplete = Boolean(
    businessType && (businessType !== 'other' || businessTypeOther.trim().length > 0)
  );

  const resolveNextSection = (
    overrides: Partial<{
      locationCount: string;
      teamSize: string;
      weeklyAppointments: string;
      staffFirstName: string;
    }> = {}
  ): SizingSection | null => {
    if (!isBusinessTypeComplete || !bookingSystemProvider) {
      return null;
    }

    return getNextIncompleteSection({
      locationCount,
      teamSize,
      weeklyAppointments,
      staffFirstName,
      ...overrides,
    });
  };

  const nextIncompleteSection = resolveNextSection();
  const activeSection = editingSection;
  const hasProgressivePrerequisites = Boolean(isBusinessTypeComplete && bookingSystemProvider);
  const isLocationSectionVisible = true;
  const isTeamSectionVisible = Boolean(hasProgressivePrerequisites && locationCount);
  const isWeeklySectionVisible = Boolean(isTeamSectionVisible && teamSize);
  const isStaffSectionVisible = Boolean(isWeeklySectionVisible && weeklyAppointments);

  const openSection = (section: SizingSection) => {
    setEditingSection(section);
  };

  useEffect(() => {
    if (!isBusinessTypeComplete || !bookingSystemProvider) {
      if (editingSection !== 'location') {
        setEditingSection('location');
      }
      return;
    }

    if (editingSection || !nextIncompleteSection) {
      return;
    }

    setEditingSection(nextIncompleteSection);
  }, [
    isBusinessTypeComplete,
    bookingSystemProvider,
    editingSection,
    nextIncompleteSection,
  ]);

  const getOptionLabel = (options: ReadonlyArray<{ value: string; label: string }>, value: string) =>
    options.find((option) => option.value === value)?.label || '';

  const locationCountLabel = getOptionLabel(LOCATION_COUNT_OPTIONS, locationCount);
  const teamSizeLabel = getOptionLabel(TEAM_SIZE_OPTIONS, teamSize);
  const weeklyAppointmentsLabel = getOptionLabel(WEEKLY_APPOINTMENT_OPTIONS, weeklyAppointments);
  const staffNameLabel = [staffFirstName.trim(), staffLastName.trim()].filter(Boolean).join(' ');
  const selectedIndustryAov = getIndustryAovDefault(businessType) ?? FALLBACK_AOV;
  const industryMonthlyEstimate = selectedIndustryAov * 5;

  const handleLocationCountChange = (value: string) => {
    onLocationCountChange(value);
    setEditingSection(resolveNextSection({ locationCount: value }));
  };

  const handleTeamSizeChange = (value: string) => {
    onTeamSizeChange(value);
    setEditingSection(resolveNextSection({ teamSize: value }));
  };

  const handleWeeklyAppointmentsChange = (value: string) => {
    onWeeklyAppointmentsChange(value);
    setEditingSection(resolveNextSection({ weeklyAppointments: value }));
  };

  const handleBookingSystemProviderChange = (value: string) => {
    onBookingSystemProviderChange(value);
    if (!value) {
      setEditingSection('location');
    }
  };

  const handleStaffSectionBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextFocused = event.relatedTarget;
    if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) {
      return;
    }

    if (suppressStaffCollapseRef.current) {
      return;
    }

    if (staffFirstName.trim()) {
      setEditingSection(null);
    }
  };

  const suppressStaffCollapseOnNextBlur = () => {
    suppressStaffCollapseRef.current = true;
    window.setTimeout(() => {
      suppressStaffCollapseRef.current = false;
    }, 0);
  };

  const handleContinue = () => {
    try {
      profileSchema.parse({
        businessType,
        businessTypeOther,
        weeklyAppointments,
        locationCount,
        teamSize,
        bookingSystemProvider,
        staffFirstName,
        staffLastName,
      });
      setErrors({});
      onContinue();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  const isValid = Boolean(
    businessType
      && weeklyAppointments
      && locationCount
      && teamSize
      && bookingSystemProvider
      && staffFirstName.trim().length > 0
      && (businessType !== 'other' || businessTypeOther.trim().length > 0)
  );

  return (
    <div className="flex flex-col px-2 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center animate-in fade-in-0 zoom-in-95 duration-300">
          <BriefcaseBusiness className="w-5 h-5 text-primary" />
        </div>
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-100">
          <h2 className="text-xl font-bold">Business profile</h2>
          <p className="text-sm text-muted-foreground">
            A few basics to get things set up
          </p>
        </div>
      </div>

      <motion.div
        layout="position"
        transition={SECTION_TRANSITION}
        data-testid="business-profile-progressive-sections"
        className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150"
      >
        <div className="space-y-4">
          <motion.div layout="position" transition={SECTION_TRANSITION} className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-sm font-medium">Business type <span className="text-destructive">*</span></Label>
            </div>
            <Select value={businessType} onValueChange={handleBusinessTypeChange}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select your business type" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {businessType === 'other' && (
              <div className="mt-3">
                <Input
                  value={businessTypeOther}
                  onChange={(e) => onBusinessTypeOtherChange(e.target.value)}
                  placeholder="Describe your business"
                  maxLength={80}
                />
              </div>
            )}
            {businessType && businessType !== 'other' && (
              <p className="mt-2 text-xs text-muted-foreground">
                Businesses like yours typically recover ~${industryMonthlyEstimate.toLocaleString()}/month in missed appointments.
              </p>
            )}
            {errors.businessType && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.businessType}
              </p>
            )}
            {errors.businessTypeOther && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.businessTypeOther}
              </p>
            )}
          </motion.div>

          <motion.div layout="position" transition={SECTION_TRANSITION} className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-sm font-medium">Current booking system <span className="text-destructive">*</span></Label>
            </div>
            <Select value={bookingSystemProvider} onValueChange={handleBookingSystemProviderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select your booking system" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ONBOARDING_NO_BOOKING_SYSTEM_VALUE}>None yet</SelectItem>
                {BOOKING_SYSTEM_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.bookingSystemProvider && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.bookingSystemProvider}
              </p>
            )}
          </motion.div>
        </div>

        <AnimatePresence initial={false}>
          <motion.div
            key={`location-${isLocationSectionVisible ? 'visible' : 'hidden'}`}
            layout="position"
            transition={SECTION_TRANSITION}
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={isLocationSectionVisible
              ? { opacity: 1, height: 'auto', marginTop: '1rem', overflow: 'visible' }
              : { opacity: 0, height: 0, marginTop: 0, overflow: 'hidden' }}
            style={{
              visibility: isLocationSectionVisible ? 'visible' : 'hidden',
              pointerEvents: isLocationSectionVisible ? 'auto' : 'none',
            }}
            className="relative"
          >
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-sm font-medium">Location count <span className="text-destructive">*</span></Label>
            </div>
            {activeSection !== 'location' ? (
              <motion.div layout="position" transition={SECTION_TRANSITION}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-auto justify-between py-2.5 px-3"
                  onClick={() => openSection('location')}
                >
                  <span className="text-sm font-medium">{locationCountLabel || 'Select an option'}</span>
                  <span className="text-xs text-muted-foreground">{locationCount ? 'Edit' : 'Select'}</span>
                </Button>
              </motion.div>
            ) : (
              <motion.div layout="position" transition={SECTION_TRANSITION}>
                <p className="text-xs text-muted-foreground mb-2">Total active locations</p>
                <RadioGroup
                  value={locationCount}
                  onValueChange={handleLocationCountChange}
                  className="gap-2"
                >
                  {LOCATION_COUNT_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors cursor-pointer",
                        locationCount === option.value
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/40"
                      )}
                    >
                      <RadioGroupItem value={option.value} />
                      <span className="text-sm font-medium">{option.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </motion.div>
            )}
            {errors.locationCount && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.locationCount}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence initial={false}>
          <motion.div
            key={`team-${isTeamSectionVisible ? 'visible' : 'hidden'}`}
            layout="position"
            transition={SECTION_TRANSITION}
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={isTeamSectionVisible
              ? { opacity: 1, height: 'auto', marginTop: '1rem', overflow: 'visible' }
              : { opacity: 0, height: 0, marginTop: 0, overflow: 'hidden' }}
            style={{
              visibility: isTeamSectionVisible ? 'visible' : 'hidden',
              pointerEvents: isTeamSectionVisible ? 'auto' : 'none',
            }}
            className="relative"
          >
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-sm font-medium">Team size <span className="text-destructive">*</span></Label>
            </div>
            {activeSection !== 'team' ? (
              <motion.div layout="position" transition={SECTION_TRANSITION}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-auto justify-between py-2.5 px-3"
                  onClick={() => openSection('team')}
                >
                  <span className="text-sm font-medium">{teamSizeLabel || 'Select an option'}</span>
                  <span className="text-xs text-muted-foreground">{teamSize ? 'Edit' : 'Select'}</span>
                </Button>
              </motion.div>
            ) : (
              <motion.div layout="position" transition={SECTION_TRANSITION}>
                <p className="text-xs text-muted-foreground mb-2">Across all locations</p>
                <RadioGroup
                  value={teamSize}
                  onValueChange={handleTeamSizeChange}
                  className="gap-2"
                >
                  {TEAM_SIZE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors cursor-pointer",
                        teamSize === option.value
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/40"
                      )}
                    >
                      <RadioGroupItem value={option.value} />
                      <span className="text-sm font-medium">{option.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </motion.div>
            )}
            {errors.teamSize && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.teamSize}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence initial={false}>
          <motion.div
            key={`weekly-${isWeeklySectionVisible ? 'visible' : 'hidden'}`}
            layout="position"
            transition={SECTION_TRANSITION}
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={isWeeklySectionVisible
              ? { opacity: 1, height: 'auto', marginTop: '1rem', overflow: 'visible' }
              : { opacity: 0, height: 0, marginTop: 0, overflow: 'hidden' }}
            style={{
              visibility: isWeeklySectionVisible ? 'visible' : 'hidden',
              pointerEvents: isWeeklySectionVisible ? 'auto' : 'none',
            }}
            className="relative"
          >
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-sm font-medium">Weekly appointment volume <span className="text-destructive">*</span></Label>
            </div>
            {activeSection !== 'weekly' ? (
              <motion.div layout="position" transition={SECTION_TRANSITION}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-auto justify-between py-2.5 px-3"
                  onClick={() => openSection('weekly')}
                >
                  <span className="text-sm font-medium">{weeklyAppointmentsLabel || 'Select an option'}</span>
                  <span className="text-xs text-muted-foreground">{weeklyAppointments ? 'Edit' : 'Select'}</span>
                </Button>
              </motion.div>
            ) : (
              <motion.div layout="position" transition={SECTION_TRANSITION}>
                <p className="text-xs text-muted-foreground mb-2">Across all locations</p>
                <RadioGroup
                  value={weeklyAppointments}
                  onValueChange={handleWeeklyAppointmentsChange}
                  className="gap-2"
                >
                  {WEEKLY_APPOINTMENT_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors cursor-pointer",
                        weeklyAppointments === option.value
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/40"
                      )}
                    >
                      <RadioGroupItem value={option.value} />
                      <span className="text-sm font-medium">{option.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </motion.div>
            )}
            {errors.weeklyAppointments && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.weeklyAppointments}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence initial={false}>
          <motion.div
            key={`staff-${isStaffSectionVisible ? 'visible' : 'hidden'}`}
            layout="position"
            transition={SECTION_TRANSITION}
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={isStaffSectionVisible
              ? { opacity: 1, height: 'auto', marginTop: '1rem', overflow: 'visible' }
              : { opacity: 0, height: 0, marginTop: 0, overflow: 'hidden' }}
            style={{
              visibility: isStaffSectionVisible ? 'visible' : 'hidden',
              pointerEvents: isStaffSectionVisible ? 'auto' : 'none',
            }}
            className="relative"
          >
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-sm font-medium">Primary staff name <span className="text-destructive">*</span></Label>
            </div>
            {activeSection !== 'staff' ? (
              <motion.div layout="position" transition={SECTION_TRANSITION}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-auto justify-between py-2.5 px-3"
                  onClick={() => openSection('staff')}
                >
                  <span className="text-sm font-medium">{staffNameLabel || 'Add staff name'}</span>
                  <span className="text-xs text-muted-foreground">{staffFirstName.trim() ? 'Edit' : 'Add'}</span>
                </Button>
              </motion.div>
            ) : (
              <motion.div layout="position" transition={SECTION_TRANSITION} className="overflow-visible pb-1">
                <div onBlur={handleStaffSectionBlur}>
                  <p className="text-xs text-muted-foreground mb-2">
                    You can add more staff later
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Input
                        id="staff-first-name"
                        value={staffFirstName}
                        onChange={(e) => onStaffFirstNameChange(e.target.value)}
                        placeholder="First name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Input
                        id="staff-last-name"
                        value={staffLastName}
                        onChange={(e) => onStaffLastNameChange(e.target.value)}
                        placeholder="Last name"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {errors.staffFirstName && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.staffFirstName}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="flex-1 min-h-4" />

      <div className="flex gap-3 mt-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 delay-300">
        <Button 
          onClick={onBack} 
          onMouseDown={suppressStaffCollapseOnNextBlur}
          variant="outline"
          className="flex-1"
          disabled={isLoading}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button 
          onClick={handleContinue}
          onMouseDown={suppressStaffCollapseOnNextBlur}
          className="flex-1"
          disabled={!isValid || isLoading}
        >
          {isLoading ? "Saving..." : "Continue"}
          {!isLoading && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}
