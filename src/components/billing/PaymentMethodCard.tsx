import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentMethodCardProps {
  provider: 'stripe' | 'paypal' | null;
  paymentMethodType?: 'card' | null;
  paymentMethodBrand?: string | null;
  paymentMethodLast4?: string | null;
  hidePaymentMethodLabel?: boolean;
  billingDateLabel?: string;
  billingDateValue?: string | null;
  onManage?: () => void;
  loading?: boolean;
  showManage?: boolean;
  manageLabel?: string;
}

export function PaymentMethodCard({
  provider,
  paymentMethodType,
  paymentMethodBrand,
  paymentMethodLast4,
  hidePaymentMethodLabel = false,
  billingDateLabel,
  billingDateValue,
  onManage,
  loading,
  showManage,
  manageLabel,
}: PaymentMethodCardProps) {
  const hasPaymentMethod = provider !== null;
  const canManage = !!onManage && (hasPaymentMethod || showManage);
  const normalizedBrand = paymentMethodBrand
    ? paymentMethodBrand
      .replace(/_/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((token) => token[0].toUpperCase() + token.slice(1))
      .join(' ')
    : null;
  const paymentMethodLabel = provider === 'paypal'
    ? 'PayPal account on file'
    : paymentMethodType === 'card' && paymentMethodLast4
      ? `${normalizedBrand || 'Card'} ending in ${paymentMethodLast4}`
      : hasPaymentMethod
        ? 'Payment method saved'
        : 'No payment method on file';
  const billingDateCopy = billingDateLabel && billingDateValue
    ? `${billingDateLabel === 'Next charge' ? `${billingDateLabel} ${billingDateValue}` : `${billingDateLabel}: ${billingDateValue}`}`
    : null;
  const billingDateClassName = hidePaymentMethodLabel
    ? 'text-sm text-muted-foreground'
    : 'text-xs text-muted-foreground';

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="space-y-1">
            <h4 className="font-medium">Billing</h4>
            {!hidePaymentMethodLabel && (
              <p className="text-sm text-muted-foreground">{paymentMethodLabel}</p>
            )}
            {billingDateCopy && <p className={billingDateClassName}>{billingDateCopy}</p>}
          </div>
        </div>
        
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onManage}
            disabled={loading}
          >
            {loading ? 'Loading...' : (manageLabel || 'Manage')}
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default PaymentMethodCard;
