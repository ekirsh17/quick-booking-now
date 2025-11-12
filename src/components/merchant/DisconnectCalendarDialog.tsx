import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface DisconnectCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deleteEvents: boolean) => void;
  accountEmail: string;
  disconnecting?: boolean;
}

export function DisconnectCalendarDialog({
  open,
  onOpenChange,
  onConfirm,
  accountEmail,
  disconnecting = false,
}: DisconnectCalendarDialogProps) {
  const [deleteEvents, setDeleteEvents] = useState(true);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Disconnect Google Calendar?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You're about to disconnect <strong>{accountEmail}</strong>. 
            What should happen to the events already synced to your Google Calendar?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup
          value={deleteEvents ? "delete" : "keep"}
          onValueChange={(value) => setDeleteEvents(value === "delete")}
          className="gap-4 py-4"
        >
          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-primary/10 cursor-pointer">
            <RadioGroupItem value="delete" id="delete" />
            <Label htmlFor="delete" className="flex-1 cursor-pointer">
              <div className="font-medium">Remove events from Google Calendar</div>
              <div className="text-sm text-muted-foreground mt-1">
                Recommended. Deletes all synced booking events from your Google Calendar to keep it clean.
              </div>
            </Label>
          </div>

          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-primary/10 cursor-pointer">
            <RadioGroupItem value="keep" id="keep" />
            <Label htmlFor="keep" className="flex-1 cursor-pointer">
              <div className="font-medium">Keep events in Google Calendar</div>
              <div className="text-sm text-muted-foreground mt-1">
                The synced events will remain in your calendar, but won't be updated automatically.
              </div>
            </Label>
          </div>
        </RadioGroup>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(deleteEvents)} disabled={disconnecting}>
            {disconnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
