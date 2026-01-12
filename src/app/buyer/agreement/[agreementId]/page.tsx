
import AgreementClientPage from '@/components/agreements/agreement-client-page';

// This is the SERVER component. It safely handles params.
async function BuyerAgreementServerPage({ params }: { params: Promise<{ agreementId: string }> }) {
    const { agreementId } = await params;
    // Pass the ID as a simple prop to the client component.
    return <AgreementClientPage agreementId={agreementId} />;
}

export default BuyerAgreementServerPage;
