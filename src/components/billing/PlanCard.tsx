import { Check, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Tables } from '@/integrations/supabase/types';

type Plan = Tables<'plans'>;

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  isPopular?: boolean;
  onSelect?: () => void;
  loading?: boolean;
  disabled?: boolean;
  isUpgrade?: boolean;
  isDowngrade?: boolean;
}

export function PlanCard({
  plan,
  isCurrentPlan,
  isPopular,
  onSelect,
  loading,
  disabled,
  isUpgrade,
  isDowngrade,
}: PlanCardProps) {
  const features = (plan.features as string[]) || [];
  const monthlyPrice = plan.monthly_price / 100;
  const isEnterprise = plan.id === 'enterprise';

  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 p-6 transition-all duration-200',
        isCurrentPlan
          ? 'border-primary bg-primary/5 shadow-lg'
          : isPopular
            ? 'border-amber-500/50 bg-gradient-to-b from-amber-50/50 to-transparent'
            : 'border-border hover:border-primary/50 hover:shadow-md',
      )}
    >
      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <Badge 
          className="absolute -top-3 left-4 bg-primary text-primary-foreground"
        >
          Current Plan
        </Badge>
      )}
      
      {/* Popular Badge */}
      {isPopular && !isCurrentPlan && (
        <Badge 
          className="absolute -top-3 left-4 bg-amber-500 text-white"
        >
          <Star className="mr-1 h-3 w-3 fill-current" />
          Most Popular
        </Badge>
      )}

      {/* Plan Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold">{plan.name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          {isEnterprise ? (
            <span className="text-2xl font-bold">Custom</span>
          ) : (
            <>
              <span className="text-4xl font-bold">${monthlyPrice}</span>
              <span className="text-muted-foreground">/month</span>
            </>
          )}
        </div>
        {!isEnterprise && plan.staff_included > 1 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Up to {plan.staff_included} staff included
          </p>
        )}
      </div>

      {/* Features List */}
      <ul className="mb-6 space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {/* SMS Info */}
      {plan.is_unlimited_sms ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Unlimited SMS</span>
        </div>
      ) : plan.sms_included ? (
        <div className="mb-6 rounded-lg bg-muted px-3 py-2">
          <span className="text-sm">
            <strong>{plan.sms_included}</strong> SMS/month included
          </span>
          {plan.sms_overage_price_per_100 && (
            <span className="block text-xs text-muted-foreground">
              ${(plan.sms_overage_price_per_100 / 100).toFixed(2)}/100 SMS overage
            </span>
          )}
        </div>
      ) : null}

      {/* Staff Add-on Info (Starter only) */}
      {plan.staff_addon_price && (
        <div className="mb-6 rounded-lg bg-muted px-3 py-2">
          <span className="text-sm">
            Additional staff: <strong>${(plan.staff_addon_price / 100).toFixed(0)}</strong>/seat/month
          </span>
        </div>
      )}

      {/* Action Button */}
      {onSelect && (
        <Button
          onClick={onSelect}
          disabled={disabled || loading || isCurrentPlan}
          className="w-full"
          variant={isCurrentPlan ? 'outline' : isPopular ? 'default' : 'outline'}
          size="lg"
        >
          {loading ? (
            'Processing...'
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : isEnterprise ? (
            'Contact Sales'
          ) : isUpgrade ? (
            'Upgrade Now'
          ) : isDowngrade ? (
            'Downgrade'
          ) : (
            'Select Plan'
          )}
        </Button>
      )}
    </div>
  );
}

export default PlanCard;

