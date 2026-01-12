
'use client';

import ViewRequirementClientPage from '@/components/requirements/view-requirement-client-page';
import { withAuth } from '@/components/with-auth';
import React from 'react';

// This is the SERVER component.
function ViewRequirementServerPage({ params }: { params: Promise<{ requirementId: string }> }) {
    const { requirementId } = React.use(params);
    // Pass the ID as a simple prop to the client component.
    return <ViewRequirementClientPage requirementId={requirementId} />;
}

export default withAuth(ViewRequirementServerPage, 'supplier');
