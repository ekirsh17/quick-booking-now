import { MessageSquare, Users, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface UsageMetricsProps {
  smsUsed: number;
  smsIncluded: number | 'unlimited';
  seatsUsed: number;
  seatsIncluded: number;
  seatsTotal: number;
  overageCost?: number;
  additionalSeatsCost?: number;
}

export function UsageMetrics({
  smsUsed,
  smsIncluded,
  seatsUsed,
  seatsIncluded,
  seatsTotal,
  overageCost = 0,
  additionalSeatsCost = 0,
}: UsageMetricsProps) {
  const isUnlimitedSMS = smsIncluded === 'unlimited';
  const smsPercentage = isUnlimitedSMS ? 0 : Math.min(100, (smsUsed / (smsIncluded as number)) * 100);
  const smsOverage = isUnlimitedSMS ? 0 : Math.max(0, smsUsed - (smsIncluded as number));
  
  const seatPercentage = Math.min(100, (seatsUsed / seatsTotal) * 100);
  const additionalSeats = Math.max(0, seatsTotal - seatsIncluded);

  return (
    <div className="space-y-6">
      {/* SMS Usage */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium">SMS Notifications</h4>
              <p className="text-xs text-muted-foreground">This billing period</p>
            </div>
          </div>
          <div className="text-right">
            {isUnlimitedSMS ? (
              <span className="font-semibold text-green-600">Unlimited</span>
            ) : (
              <span className="font-semibold">
                {smsUsed.toLocaleString()} / {(smsIncluded as number).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        
        {!isUnlimitedSMS && (
          <>
            <Progress 
              value={smsPercentage} 
              className={cn(
                'h-2',
                smsPercentage >= 90 ? '[&>div]:bg-red-500' : 
                smsPercentage >= 75 ? '[&>div]:bg-amber-500' : ''
              )}
            />
            
            {smsOverage > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-900/20">
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  <TrendingUp className="mr-1 inline h-3 w-3" />
                  {smsOverage} overage SMS
                </span>
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  +${overageCost.toFixed(2)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Staff Seats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="font-medium">Staff Seats</h4>
              <p className="text-xs text-muted-foreground">
                {seatsIncluded} included in plan
                {additionalSeats > 0 && ` + ${additionalSeats} additional`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-semibold">
              {seatsUsed} / {seatsTotal}
            </span>
          </div>
        </div>
        
        <Progress value={seatPercentage} className="h-2" />
        
        {additionalSeats > 0 && additionalSeatsCost > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2 dark:bg-purple-900/20">
            <span className="text-sm text-purple-800 dark:text-purple-200">
              {additionalSeats} additional {additionalSeats === 1 ? 'seat' : 'seats'}
            </span>
            <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
              +${additionalSeatsCost.toFixed(2)}/mo
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default UsageMetrics;

