import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { Loader2, CheckCircle2 } from 'lucide-react';

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface PayPalCheckoutButtonProps {
  planId: string;
  planName: string;
  monthlyPrice: number;
  merchantId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function PayPalCheckoutButton({
  planId,
  planName,
  monthlyPrice,
  merchantId,
  onSuccess,
  onError,
}: PayPalCheckoutButtonProps) {
  const [isComplete, setIsComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Don't render if no PayPal client ID
  if (!PAYPAL_CLIENT_ID) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        <p>PayPal is not configured. Please set VITE_PAYPAL_CLIENT_ID.</p>
      </div>
    );
  }

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
    <PayPalScriptProvider
      options={{
        clientId: PAYPAL_CLIENT_ID,
        vault: true,
        intent: 'subscription',
        components: 'buttons',
      }}
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{planName} Plan</span>
            <span className="font-medium">${monthlyPrice}/month</span>
          </div>
        </div>

        {isProcessing && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Processing...</span>
          </div>
        )}

        <PayPalButtons
          style={{
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'subscribe',
          }}
          createSubscription={async (_data, actions) => {
            try {
              // First, get the PayPal plan ID from our backend
              const response = await fetch(`${API_URL}/api/billing/paypal/get-plan-id`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  planId,
                  merchantId,
                }),
              });

              const data = await response.json();
              
              if (!response.ok || !data.paypalPlanId) {
                throw new Error(data.error || 'Failed to get PayPal plan');
              }

              // Create the subscription using PayPal's actions
              return actions.subscription.create({
                plan_id: data.paypalPlanId,
                custom_id: merchantId,
              });
            } catch (error) {
              onError(error instanceof Error ? error.message : 'Failed to create subscription');
              throw error;
            }
          }}
          onApprove={async (data, _actions) => {
            setIsProcessing(true);
            try {
              // Confirm the subscription on our backend
              const response = await fetch(`${API_URL}/api/billing/paypal/confirm-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscriptionId: data.subscriptionID,
                  merchantId,
                  planId,
                }),
              });

              const result = await response.json();

              if (!response.ok) {
                throw new Error(result.error || 'Failed to confirm subscription');
              }

              setIsComplete(true);
              onSuccess();
            } catch (error) {
              onError(error instanceof Error ? error.message : 'Payment confirmation failed');
            } finally {
              setIsProcessing(false);
            }
          }}
          onCancel={() => {
            onError('Payment was cancelled');
          }}
          onError={(err) => {
            onError(err?.message || 'PayPal error occurred');
          }}
        />

        <p className="text-center text-xs text-muted-foreground">
          Secure payment powered by PayPal
        </p>
      </div>
    </PayPalScriptProvider>
  );
}

export default PayPalCheckoutButton;









