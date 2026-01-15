
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  allowedRole: string,
) {
  const AuthComponent = (props: P) => {
    const { user, userRole, loading, verificationStatus } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading) {
        if (!user) {
          router.replace('/login');
        } else if (userRole && userRole !== allowedRole && userRole !== 'admin') {
          // Redirect to their own dashboard if they try to access another role's page
          // UNLESS they are an admin, who should have broad access
          router.replace(`/${userRole}`);
        }
      }
    }, [user, userRole, loading, router, allowedRole, verificationStatus]);

    if (loading || !user || !userRole || (allowedRole !== '*' && userRole !== allowedRole && userRole !== 'admin')) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    return <Component {...props} />;
  };

  AuthComponent.displayName = `WithAuth(${Component.displayName || Component.name || 'Component'})`;

  return AuthComponent;
}
