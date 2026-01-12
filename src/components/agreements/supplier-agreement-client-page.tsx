
'use client';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FileSignature, ArrowLeft, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

function SupplierAgreementPage({ agreementId }: { agreementId: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const { user, userRole } = useAuth();
    const firestore = useFirestore();
    const [isSigning, setIsSigning] = useState(false);

    const tradeRef = useMemoFirebase(() => {
        if (!firestore || !agreementId) return null;
        return doc(firestore, 'trades', agreementId);
    }, [firestore, agreementId]);

    const { data: trade, isLoading: isLoadingTrade, error: tradeError } = useDoc(tradeRef);

    const handleSignAgreement = async () => {
        if (!firestore || !agreementId || !tradeRef) return;

        setIsSigning(true);
        try {
            await setDoc(tradeRef, {
                status: 'Awaiting Admin Confirmation',
                signedAt: serverTimestamp(),
            }, { merge: true });

            toast({
                title: 'Agreement Signed!',
                description: 'The agreement has been signed and is now awaiting admin confirmation.',
            });

            // Redirect user to their respective trade page
            router.push(`/supplier/trade/${agreementId}`);
        } catch (error) {
            console.error("Error signing agreement:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to sign the agreement. Please try again.',
            });
        } finally {
            setIsSigning(false);
        }
    };

    if (isLoadingTrade) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    if (!trade) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 text-center">
                    {tradeError ? (
                        <>
                            <p className="text-destructive font-semibold">Error Loading Agreement</p>
                            <p className="text-sm text-muted-foreground max-w-md mb-2">
                                {tradeError.message || "You might not have permission to view this trade."}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
                                <Button variant="ghost" size="sm" onClick={() => router.push(`/supplier/chats/${trade?.id || agreementId}`)}>Go to Chat</Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-muted-foreground">Trade document not found yet.</p>
                            <p className="text-xs text-muted-foreground/60 max-w-xs">
                                We are waiting for the trade record to be created in our system. This should happen automatically.
                            </p>
                            <div className="flex flex-col gap-2 items-center mt-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <Button variant="outline" size="sm" className="mt-2" onClick={() => router.push(`/supplier/chats/${agreementId.replace('trade_', '')}`)}>
                                    Return to Chat to Retry
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground/40 mt-4">ID: {agreementId}</p>
                        </>
                    )}
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                </Button>
                <h1 className="text-lg font-semibold md:text-2xl">Sign Agreement</h1>
                <div className="ml-auto">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/supplier/chats/${agreementId.replace('trade_', '')}`)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Go to Chat
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileSignature className="h-6 w-6" />
                        Trade Agreement
                    </CardTitle>
                    <CardDescription>Agreement ID: {agreementId}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ScrollArea className="h-96 w-full rounded-md border p-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <h3>Success Fee Agreement</h3>
                            <p>This Success Fee Agreement (“Agreement”) is entered into as of <strong>{new Date().toLocaleDateString()}</strong> (“Effective Date”) between <strong>Schmidt Ventures UG (haftungsbeschränkt)</strong>, operating under the brand <strong>OffshoreBrücke</strong>, Buchwaldstr. 20, 35619 Braunfels – hereinafter referred to as “OffshoreBrücke” – and the <strong>{trade?.supplierName || 'Client'}</strong> – hereinafter referred to as “Client”.</p>
                            <p>OffshoreBrücke and the Client are hereinafter individually referred to as a “Party” and collectively as the “Parties.”</p>

                            <hr />

                            <h4>1. Purpose of the Agreement</h4>
                            <p>OffshoreBrücke operates a digital platform facilitating the identification, verification, and introduction of international suppliers and business partners. The Client uses the OffshoreBrücke platform to initiate, negotiate, and conclude commercial transactions with third-party buyers. This Agreement governs the success-based remuneration owed to OffshoreBrücke in the event of a successful transaction.</p>

                            <h4>2. Definitions</h4>
                            <h5>2.1 Successful Transaction</h5>
                            <p>A “Successful Transaction” occurs when the Client, directly or indirectly: concludes a legally binding contract (e.g. supply, manufacturing, framework, or service agreement), or places a paid order, or initiates a commercial relationship generating economic value with a buyer that was introduced, identified, verified, or facilitated through the OffshoreBrücke platform.</p>
                            <p>This applies regardless of whether the transaction is concluded: on or off the platform, directly or via affiliates, subsidiaries, or intermediaries, during or after termination of platform usage.</p>

                            <h5>2.2 Transaction Value</h5>
                            <p>“Transaction Value” means the total gross contract value (excluding VAT), including: one-time orders, and recurring payments during the initial 12-month period of the commercial relationship.</p>

                            <h4>3. Success Fee</h4>
                            <h5>3.1 Fee Amount</h5>
                            <p>The Client shall pay OffshoreBrücke a success fee equal to: <strong>2% of the Transaction Value</strong> unless otherwise agreed in writing.</p>

                            <h5>3.2 Fee Trigger</h5>
                            <p>The success fee becomes due and payable upon the earlier of: a) execution of a binding contract; b) issuance of the first invoice by the supplier; or c) first payment made by the Client to the supplier.</p>

                            <h4>4. Payment Terms</h4>
                            <ul>
                                <li>OffshoreBrücke shall issue an invoice upon occurrence of a Successful Transaction.</li>
                                <li>Payment is due within 14 days from invoice date.</li>
                                <li>All amounts are stated net of VAT, where applicable.</li>
                                <li>Late payments may incur statutory default interest under German law.</li>
                            </ul>

                            <h4>5. Reporting & Audit Rights</h4>
                            <p>The Client agrees to: truthfully report concluded transactions upon request; provide reasonable documentation (e.g. contract value, invoices) necessary to verify the Transaction Value. OffshoreBrücke may audit such information once per year upon reasonable notice.</p>

                            <h4>6. Anti-Circumvention</h4>
                            <p>The Client shall not circumvent OffshoreBrücke by: engaging buyers introduced via the platform outside its scope to avoid fees; using affiliates, related parties, or third parties to bypass payment obligations. Any circumvention shall trigger the success fee as if the transaction were concluded directly.</p>

                            <h4>7. Term and Survival</h4>
                            <p>This Agreement enters into force on the Effective Date and remains valid for the duration of the Client’s platform usage. The success fee obligation survives termination for 24 months with respect to buyers introduced during the term.</p>

                            <h4>8. No Exclusivity</h4>
                            <p>This Agreement does not create an exclusive relationship. The Client remains free to work with other platforms or providers.</p>

                            <h4>9. Limitation of Liability</h4>
                            <p>OffshoreBrücke does not guarantee: successful deal closure, supplier performance, or commercial outcomes. Liability is limited to intent and gross negligence, except where mandatory statutory liability applies.</p>

                            <h4>10. Governing Law and Jurisdiction</h4>
                            <p>This Agreement shall be governed by the laws of the Federal Republic of Germany, excluding conflict-of-law provisions. Exclusive jurisdiction shall be Munich, Germany, where legally permissible.</p>

                            <h4>11. Final Provisions</h4>
                            <ul>
                                <li>Amendments require written form.</li>
                                <li>Invalid provisions shall not affect validity of the remainder.</li>
                                <li>This Agreement constitutes the entire agreement regarding success fees.</li>
                            </ul>

                            <hr />

                            <div className="grid grid-cols-2 gap-8 mt-8">
                                <div>
                                    <p className="font-bold border-b border-foreground pb-2">For OffshoreBrücke (Schmidt Ventures UG)</p>
                                    <p className="mt-4 text-xs font-semibold">Name: Lukas Schmidt</p>
                                    <p className="text-xs">Title: Managing Director</p>
                                    <p className="text-xs">Date: {new Date().toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="font-bold border-b border-foreground pb-2">For the Client</p>
                                    <p className="mt-4 text-xs font-semibold">Name: {user?.displayName || trade?.supplierName || 'Authorized Signatory'}</p>
                                    <p className="text-xs italic text-muted-foreground">Title: Digital Signature via Platform</p>
                                    <p className="text-xs">Date: {new Date().toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </CardContent>
                <CardFooter>
                    <Button className="w-full sm:w-auto" onClick={handleSignAgreement} disabled={isSigning}>
                        {isSigning ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileSignature className="mr-2 h-4 w-4" />
                        )}
                        Agree & Sign
                    </Button>
                </CardFooter>
            </Card>
        </DashboardLayout>
    );
}

// The authentication HOC wraps the client component.
export default withAuth(SupplierAgreementPage, 'supplier');
