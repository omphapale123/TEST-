'use client';
import { use } from 'react';
import SupplierTradeClientPage from '@/components/supplier/trade-client-page';
import { withAuth } from '@/components/with-auth';

// This is the Client component. It unwraps params using the 'use' hook.
function SupplierTradePage({ params }: { params: Promise<{ tradeId: string }> }) {
    const { tradeId } = use(params);
    // We get the ID from the params and pass it as a simple prop to the client component.
    return <SupplierTradeClientPage tradeId={tradeId} />;
}

export default withAuth(SupplierTradePage, 'supplier');
