import { AlertCircle, Calendar, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GoogleCalendarPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function GoogleCalendarPermissionDialog({
  open,
  onOpenChange,
  onConfirm,
}: GoogleCalendarPermissionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Google Calendar Permissions Required
          </DialogTitle>
          <DialogDescription>
            This app needs specific permissions to sync your bookings with Google Calendar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              On the next screen, please <strong>allow all permissions</strong> for the app to work correctly.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <p className="text-sm font-medium">Required permissions:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <strong>View your calendars</strong>
                  <p className="text-muted-foreground">To check for existing bookings and prevent conflicts</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <strong>Create and edit calendar events</strong>
                  <p className="text-muted-foreground">To add booked appointments to your calendar</p>
                </div>
              </div>
            </div>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              If you skip any permissions, calendar sync will not work. You can always reconnect later to grant them.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Continue to Google
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
