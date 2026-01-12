
'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Bell,
  Home,
  Menu,
  FileText,
  MessageSquare,
  Repeat,
  Users,
  User,
  Phone,
  LayoutGrid,
  CheckCircle,
  Lock,
  Inbox,
  Briefcase,
  Store,
  FilePlus,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UserNav } from '@/components/user-nav';
import { NotificationBell } from '@/components/notification-bell';
import Logo from '@/components/logo';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { OnboardingGuide } from '@/components/onboarding-guide';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { userRole, verificationStatus } = useAuth();
  const { toast } = useToast();

  const isVerified = verificationStatus === 'verified';

  const handleComplianceClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast({
      title: 'Coming Soon!',
      description: 'The compliance dashboard is under development.',
    });
  };

  const navItems = [
    { href: `/${userRole}`, icon: Home, label: 'Dashboard' },
    // Admin
    { href: '/admin/inbox', icon: Inbox, label: 'Inbox', roles: ['admin'] },
    { href: '/admin/users', icon: Users, label: 'Users', roles: ['admin'] },
    { href: '/admin/categories', icon: LayoutGrid, label: 'Categories', roles: ['admin'] },
    { href: '/admin/verify-documents', icon: CheckCircle, label: 'Verify Documents', roles: ['admin'] },
    { href: '/admin/trades', icon: Repeat, label: 'Trades', roles: ['admin'] },
    { href: '/admin/invoice-creation', icon: FilePlus, label: 'Invoice Creation', roles: ['admin'] },
    // Buyer
    { href: `/buyer/requirements`, icon: FileText, label: 'Requirements', roles: ['buyer'] },
    { href: '/buyer/marketplace', icon: Store, label: 'Marketplace', roles: ['buyer'] },
    { href: '/buyer/requests', icon: Briefcase, label: 'Requests', roles: ['buyer'] },
    // Supplier
    { href: `/supplier/marketplace`, icon: Store, label: 'Marketplace', roles: ['supplier'] },
    { href: '/supplier/requests', icon: Briefcase, label: 'Requests', roles: ['supplier'] },
    // Shared
    { href: `/${userRole}/chats`, icon: MessageSquare, label: 'Chats', roles: ['buyer', 'supplier'] },
    { href: `/${userRole}/trade`, icon: Repeat, label: 'Trade', roles: ['buyer', 'supplier'] },
    { href: `/${userRole}/partners`, icon: Users, label: 'Partners', roles: ['buyer', 'supplier'] },
    { href: '#', icon: ShieldCheck, label: 'Compliance', roles: ['buyer', 'supplier'], onClick: handleComplianceClick },
    // General
    { href: `/profile`, icon: User, label: 'Profile' },
    { href: '/contact', icon: Phone, label: 'Contact us' },
  ].filter(item => !item.roles || item.roles.includes(userRole || ''));

  const commonLinkClasses = "flex items-center gap-3 rounded-lg px-3 py-2 transition-all";

  const renderNavItem = (item: any, isMobile = false) => {
    const linkContent = (
      <>
        <item.icon className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
        {item.label}
      </>
    );

    const isActive = (pathname.startsWith(item.href) && item.href !== '#' && item.href !== '/' && item.href !== `/${userRole}` && item.href !== '/profile' && !item.href.includes('requests')) || pathname === item.href || (item.href.includes('profile') && pathname.includes('profile')) || (item.href.includes('/requests') && pathname.includes('/requests'));

    const linkClasses = isMobile
      ? `mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 ${isActive
        ? 'bg-muted text-foreground'
        : 'text-muted-foreground hover:text-foreground'
      }`
      : `${commonLinkClasses} ${isActive
        ? 'bg-muted text-primary'
        : 'text-muted-foreground hover:text-primary'
      }`;

    if (item.onClick) {
      return (
        <a
          key={item.label}
          id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          href={item.href}
          className={linkClasses}
          onClick={item.onClick}
        >
          {linkContent}
        </a>
      );
    }

    return (
      <Link
        key={item.label}
        id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        href={item.href}
        className={linkClasses}
      >
        {linkContent}
      </Link>
    );
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-card md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Logo />
            </Link>
          </div>
          <div className="flex-1 overflow-auto">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              {navItems.map((item) => renderNavItem(item))}
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <nav className="grid gap-2 text-lg font-medium">
                <Link
                  href="#"
                  className="flex items-center gap-2 text-lg font-semibold mb-4"
                >
                  <Logo />
                </Link>
                {navItems.map((item) => renderNavItem(item, true))}
              </nav>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1" />
          <NotificationBell />
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background animate-fade-in">
          {children}
        </main>
      </div>
      <OnboardingGuide />
    </div>
  );
}
