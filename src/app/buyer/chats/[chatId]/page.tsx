'use client';

import { use } from 'react';
import AuthenticatedChatPage from '@/components/chats/buyer-chat-client-page';
import { withAuth } from '@/components/with-auth';

/**
 * In Next.js 15, params in client components is a Promise that must be unwrapped
 */
function ChatServerPage({ params }: { params: Promise<{ chatId: string }> }) {
    const { chatId } = use(params);
    // Pass the ID as a simple prop to the client component.
    return <AuthenticatedChatPage chatId={chatId} />;
}

export default withAuth(ChatServerPage, 'buyer');
