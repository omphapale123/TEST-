'use client';
import { useUserRole, useUser } from '@/firebase/provider';

export const useAuth = () => {
  const { user, isUserLoading } = useUser();
  const { userRole, verificationStatus, loading: isRoleLoading } = useUserRole();

  return {
    user,
    userRole,
    verificationStatus,
    loading: isUserLoading || isRoleLoading,
  };
};
