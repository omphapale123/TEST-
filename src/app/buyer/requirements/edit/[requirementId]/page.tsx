
'use client';

import EditRequirementClientPage from '@/components/requirements/edit-requirement-client-page';
import React from 'react';

// This is the SERVER component. It can handle promises and server-side logic.
function EditRequirementServerPage({ params }: { params: Promise<{ requirementId: string }> }) {
    // We get the ID from the params and pass it as a simple prop to the client component.
    const { requirementId } = React.use(params);
    return <EditRequirementClientPage requirementId={requirementId} />;
}

export default EditRequirementServerPage;
