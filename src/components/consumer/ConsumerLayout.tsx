import { ReactNode } from "react";
import notifyLogo from "@/assets/notify-logo.png";

interface ConsumerLayoutProps {
  businessName?: string;
  children: ReactNode;
}

export const ConsumerLayout = ({ 
  businessName, 
  children 
}: ConsumerLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Simple header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center gap-3">
          <img src={notifyLogo} alt="Notify" className="h-8 w-8" />
          <h1 className="text-lg font-semibold">
            {businessName || "Notify"}
          </h1>
        </div>
      </header>

      {/* Main content - centered, max-width constrained */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Simple footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        <p>Powered by Notify</p>
      </footer>
    </div>
  );
};
