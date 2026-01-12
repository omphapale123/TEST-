
import SupplierAgreementClientPage from '@/components/agreements/supplier-agreement-client-page';
import { withAuth } from '@/components/with-auth';

// This is the SERVER component. It safely handles params.
export default async function SupplierAgreementServerPage({ params }: { params: Promise<{ agreementId: string }> }) {
    const { agreementId } = await params;
    // Pass the ID as a simple prop to the client component.
    return <SupplierAgreementClientPage agreementId={agreementId} />;
}
