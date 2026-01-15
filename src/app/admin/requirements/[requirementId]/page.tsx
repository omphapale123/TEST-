
import AuthenticatedViewRequirementPage from '@/components/requirements/view-requirement-client-page';
import React from 'react';

// Next.js 15 Server Component for Admin
export default async function AdminViewRequirementPage({ params }: { params: Promise<{ requirementId: string }> }) {
    const { requirementId } = await params;
    return <AuthenticatedViewRequirementPage requirementId={requirementId} />;
}
