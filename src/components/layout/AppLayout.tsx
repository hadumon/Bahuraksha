import { ReactNode, useState } from 'react';
import AppSidebar from './AppSidebar';
import { Menu } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function AppLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <AppSidebar
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Mobile header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-30 flex items-center px-4 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-foreground tracking-wide">BAHURAKSHA</h1>
        </header>
      )}

      <main className={`min-h-screen transition-all duration-200 ${
        isMobile ? 'ml-0 pt-14' : 'ml-[240px]'
      }`}>
        {children}
      </main>
    </div>
  );
}
