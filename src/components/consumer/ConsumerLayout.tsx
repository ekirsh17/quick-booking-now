import { ReactNode } from "react";
import notifymeIcon from "@/assets/notifyme-icon.png";

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
        <a href="/" className="container mx-auto px-4 py-4 flex items-center justify-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 flex items-center justify-center">
            <img src={notifymeIcon} alt="NotifyMe" className="w-full h-full object-contain rounded-lg" />
          </div>
          <h1 className="text-lg font-semibold">
            {businessName || "NotifyMe"}
          </h1>
        </a>
      </header>

      {/* Main content - centered, max-width constrained */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Simple footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        <p>Powered by NotifyMe</p>
      </footer>
    </div>
  );
};
