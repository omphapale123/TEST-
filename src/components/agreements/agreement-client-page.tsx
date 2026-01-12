
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

function AgreementPage({ agreementId }: { agreementId: string }) {
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
            router.push(`/${userRole}/trade/${agreementId}`);
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
                                <Button variant="ghost" size="sm" onClick={() => router.push(`/buyer/chats/${agreementId.replace('trade_', '')}`)}>Go to Chat</Button>
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
                                <Button variant="outline" size="sm" className="mt-2" onClick={() => router.push(`/buyer/chats/${agreementId.replace('trade_', '')}`)}>
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
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/buyer/chats/${agreementId.replace('trade_', '')}`)}>
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
                            <h3>Trade Agreement</h3>
                            <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
                            <p>This Trade Agreement ("Agreement") governs all trade-related interactions, negotiations, and transactions facilitated through the OffshoreBrücke platform ("Platform"), operated by <strong>OffshoreBrücke</strong> ("Company", "we", "us", or "our"). By accessing, registering, or conducting any trade discussion or transaction through the Platform, you agree to be legally bound by this Agreement.</p>

                            <h4>1. Trade Facilitation Purpose</h4>
                            <p>OffshoreBrücke is a B2B facilitation and sourcing platform designed to connect <strong>buyers</strong> and <strong>suppliers</strong> for cross-border and domestic trade opportunities. OffshoreBrücke acts solely as an <strong>intermediary and facilitator</strong> and is <strong>not a party</strong> to any commercial agreement, contract, purchase order, or transaction between buyers and suppliers.</p>

                            <h4>2. Role of OffshoreBrücke (Facilitator Only)</h4>
                            <ul>
                                <li>OffshoreBrücke does <strong>not</strong> manufacture, supply, purchase, sell, inspect, ship, insure, or guarantee any goods or services.</li>
                                <li>All negotiations, pricing, quality standards, delivery timelines, compliance obligations, and payments between buyers and suppliers are conducted <strong>at their own risk</strong>.</li>
                                <li>Any agreement entered into between buyers and suppliers is a <strong>direct and independent contract</strong> between those parties.</li>
                            </ul>

                            <h4>3. Supplier Trade Facilitation Fee (Commission)</h4>
                            <ol>
                                <li>The <strong>supplier</strong> agrees to pay OffshoreBrücke a service fee equal to <strong>2% (two percent)</strong> of the <strong>total final deal value</strong> (excluding applicable taxes unless otherwise agreed).</li>
                                <li>The service fee becomes <strong>due and payable immediately upon deal confirmation</strong>, contract signing, invoice issuance, or receipt of payment from the buyer—whichever occurs first.</li>
                                <li>Failure to pay the service fee may result in:
                                    <ul>
                                        <li>Suspension or termination of the supplier account</li>
                                        <li>Legal recovery actions</li>
                                        <li>Blocking of future access to the Platform</li>
                                    </ul>
                                </li>
                                <li>OffshoreBrücke reserves the right to revise service fees with prior notice.</li>
                            </ol>

                            <h4>4. Buyer Trade Risk Acknowledgment</h4>
                            <ol>
                                <li>The buyer explicitly acknowledges that <strong>trading and sourcing through online platforms involves inherent commercial, financial, legal, and operational risks</strong>.</li>
                                <li>OffshoreBrücke <strong>does not guarantee</strong>:
                                    <ul>
                                        <li>Supplier authenticity or performance</li>
                                        <li>Product quality, quantity, or specifications</li>
                                        <li>Delivery timelines</li>
                                        <li>Regulatory or customs compliance</li>
                                        <li>Payment security or dispute resolution outcomes</li>
                                    </ul>
                                </li>
                                <li>The buyer agrees that OffshoreBrücke shall <strong>not be held responsible or liable</strong> for any loss, damage, delay, fraud, misrepresentation, non-performance, or dispute arising from transactions conducted through the Platform.</li>
                            </ol>

                            <h4>5. No Liability, Risk Allocation & Disclaimer</h4>
                            <p>To the maximum extent permitted by law:</p>
                            <ul>
                                <li>OffshoreBrücke shall <strong>not be liable</strong> for any direct, indirect, incidental, consequential, special, or punitive damages.</li>
                                <li>OffshoreBrücke is <strong>not responsible</strong> for business losses, loss of profits, loss of data, shipment issues, customs delays, regulatory penalties, or contract breaches between buyers and suppliers.</li>
                                <li>All information provided on the Platform is offered on an <strong>"as-is" and "as-available" basis</strong> without warranties of any kind.</li>
                            </ul>

                            <h4>6. Due Diligence Responsibility</h4>
                            <p>Both buyers and suppliers are solely responsible for:</p>
                            <ul>
                                <li>Conducting independent due diligence</li>
                                <li>Verifying company credentials, licenses, and certifications</li>
                                <li>Ensuring legal, tax, and regulatory compliance in their respective jurisdictions</li>
                            </ul>
                            <p>OffshoreBrücke may offer verification or informational tools, but these <strong>do not constitute guarantees or legal assurances</strong>.</p>

                            <h4>7. Indemnification</h4>
                            <p>You agree to indemnify, defend, and hold harmless OffshoreBrücke, its directors, officers, employees, and affiliates from any claims, damages, losses, liabilities, costs, or expenses arising from:</p>
                            <ul>
                                <li>Your use of the Platform</li>
                                <li>Any transaction or agreement entered into through the Platform</li>
                                <li>Violation of this Agreement or applicable laws</li>
                            </ul>

                            <h4>8. Termination</h4>
                            <p>OffshoreBrücke reserves the right to suspend or terminate access to the Platform at any time, without notice, in case of:</p>
                            <ul>
                                <li>Breach of this Agreement</li>
                                <li>Non-payment of fees</li>
                                <li>Fraudulent, illegal, or unethical activity</li>
                            </ul>

                            <h4>9. Governing Law, Jurisdiction & Dispute Resolution</h4>
                            <p>This Agreement shall be governed by and construed in accordance with the laws of <strong>Germany</strong>. Any disputes shall be subject to the exclusive jurisdiction of the courts of <strong>Berlin</strong>.</p>

                            <h4>10. Binding Trade Acceptance</h4>
                            <p>By registering on the Platform, clicking "I Agree", or proceeding with any transaction, you confirm that:</p>
                            <ul>
                                <li>You have read and understood this Agreement</li>
                                <li>You voluntarily accept all terms and conditions</li>
                                <li>You are legally authorized to bind the entity you represent</li>
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
                                    <p className="mt-4 text-xs font-semibold">Name: {user?.displayName || trade?.buyerName || 'Authorized Signatory'}</p>
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

// This is now a generic component. The authentication is handled at the page level.
export default withAuth(AgreementPage, 'buyer');
