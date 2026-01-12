'use client';

import { use } from 'react';
import AuthenticatedChatPage from '@/components/chats/supplier-chat-client-page';
import { withAuth } from '@/components/with-auth';

// In Next.js 15, params is a Promise
function SupplierChatServerPage({ params }: { params: Promise<{ chatId: string }> }) {
    const { chatId } = use(params);
    // Pass the ID as a simple prop to the client component, which handles all client-side logic and auth.
    return <AuthenticatedChatPage chatId={chatId} />;
}

export default withAuth(SupplierChatServerPage, 'supplier');
