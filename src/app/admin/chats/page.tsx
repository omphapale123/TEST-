'use client';

import { useState } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { Loader2, MessageSquare, Search, User, UserCheck, Calendar } from 'lucide-react';
import { format } from 'date-fns';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
    useFirestore,
    useCollection,
    useMemoFirebase,
} from '@/firebase';

function AdminChatsPage() {
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');

    // Query all chats
    const chatsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'chats'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore]);

    const { data: allChats, isLoading } = useCollection(chatsQuery);

    const filteredChats = allChats?.filter(chat =>
        chat.buyerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chat.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chat.requirementTitle?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-lg font-semibold md:text-2xl">User Chats Monitoring</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Conversations</CardTitle>
                    <CardDescription>
                        Monitor engagement between buyers and suppliers across the platform.
                    </CardDescription>
                    <div className="relative mt-2">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search by buyer, supplier or requirement..."
                            className="pl-8 w-full md:w-[400px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredChats && filteredChats.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Requirement / Subject</TableHead>
                                    <TableHead>Buyer</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Last Message</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredChats.map((chat) => (
                                    <TableRow key={chat.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{chat.requirementTitle || 'General Inquiry'}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase">ID: {chat.id?.substring(0, 8)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm">{chat.buyerName || 'Unknown Buyer'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="h-4 w-4 text-primary" />
                                                <span className="text-sm border-b border-primary/20">{chat.supplierName || 'Unknown Supplier'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                            <p className="text-sm truncate text-muted-foreground italic">
                                                "{chat.lastMessage || 'No messages yet'}"
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {chat.createdAt?.toDate ? format(chat.createdAt.toDate(), 'PPP') : 'Recently'}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-10">
                            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
                            <p className="text-muted-foreground mt-4">No active conversations found.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}

export default withAuth(AdminChatsPage, 'admin');
