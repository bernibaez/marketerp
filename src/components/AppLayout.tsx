import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { pathname } = location;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const isPosPage = pathname.includes('point-of-sale') || pathname.includes('pos');

  const toggleDark = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  if (isPosPage) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 print:h-auto print:w-auto print:overflow-visible print:bg-white">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background print:h-auto print:overflow-visible print:bg-white">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden fade-in print:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <div className="print:hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          currentPath={pathname + (location.search || '')}
        />
      </div>

      <div
        className="flex flex-col flex-1 overflow-hidden transition-all duration-300 print:overflow-visible print:h-auto print:m-0 print:p-0"
        style={{ marginLeft: 0 }}
      >
        <div className="print:hidden">
          <Topbar
            onToggleSidebar={() => setSidebarCollapsed((p) => !p)}
            onToggleMobileSidebar={() => setMobileSidebarOpen((p) => !p)}
            darkMode={darkMode}
            onToggleDark={toggleDark}
            sidebarCollapsed={sidebarCollapsed}
          />
        </div>

        <main className="flex-1 overflow-y-auto scrollbar-thin print:overflow-visible print:h-auto print:p-0 print:m-0">
          <div
            key={pathname}
            className="max-w-[1700px] mx-auto px-5 sm:px-6 lg:px-8 xl:px-10 py-8 page-enter print:max-w-none print:p-0 print:m-0"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
