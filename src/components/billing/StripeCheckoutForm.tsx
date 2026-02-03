import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface StripeCheckoutFormProps {
  planName: string;
  monthlyPrice: number;
  subscriptionId: string;
  merchantId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function StripeCheckoutForm({
  planName,
  monthlyPrice,
  subscriptionId,
  merchantId,
  onSuccess,
  onError,
}: StripeCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Confirm the payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/merchant/billing?billing=success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Payment failed');
        setIsProcessing(false);
        return;
      }

      // Payment succeeded - confirm subscription on backend
      if (paymentIntent?.status === 'succeeded') {
        await fetch(`${API_URL}/api/billing/confirm-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptionId,
            merchantId,
          }),
        });

        setIsComplete(true);
        onSuccess();
      }
    } catch (err) {
      onError('An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold">Payment Successful!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your {planName} subscription is now active.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement 
        options={{
          layout: 'tabs',
        }}
      />
      
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{planName} Plan</span>
          <span className="font-medium">${monthlyPrice}/month</span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Subscribe to ${planName}`
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Secure payment powered by Stripe
      </p>
    </form>
  );
}

export default StripeCheckoutForm;








