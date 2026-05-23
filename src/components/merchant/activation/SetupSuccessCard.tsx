import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useActivationContext } from '@/contexts/ActivationContext';

export function SetupSuccessCard() {
  const { showSuccessCard } = useActivationContext();

  if (!showSuccessCard) return null;

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">You&apos;re ready to fill openings.</CardTitle>
        <CardDescription>
          Create an opening whenever time becomes available. Customers on your waitlist can be
          notified right away.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild className="min-h-11">
          <Link to="/merchant/openings?action=create">Create opening</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/merchant/qr-code">View QR code</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
