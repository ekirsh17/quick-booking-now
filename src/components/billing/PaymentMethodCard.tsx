import { CreditCard, Building2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PaymentMethodCardProps {
  provider: 'stripe' | 'paypal' | null;
  onManage?: () => void;
  loading?: boolean;
}

export function PaymentMethodCard({
  provider,
  onManage,
  loading,
}: PaymentMethodCardProps) {
  const hasPaymentMethod = provider !== null;

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            {provider === 'paypal' ? (
              <Building2 className="h-5 w-5 text-blue-600" />
            ) : (
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h4 className="font-medium">Payment Method</h4>
            {hasPaymentMethod ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {provider}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {provider === 'stripe' ? 'Card on file' : 'PayPal linked'}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No payment method on file
              </p>
            )}
          </div>
        </div>
        
        {hasPaymentMethod && onManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManage}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Update'}
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default PaymentMethodCard;

