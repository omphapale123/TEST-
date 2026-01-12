'use client';
import { useMemo, useState, FormEvent, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare, Send, User, Bot, ArrowLeft, Paperclip, Handshake } from 'lucide-react';
import { collection, query, orderBy, doc, getDoc, serverTimestamp, addDoc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { useUser, useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { createNotification } from '@/lib/notifications';

interface ChatPageProps {
  chatId: string;
}

function ChatPage({ chatId }: ChatPageProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [productName, setProductName] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatRef = useMemoFirebase(() => {
    if (!firestore || !chatId) return null;
    return doc(firestore, 'chats', chatId);
  }, [firestore, chatId]);
  const { data: chatData, isLoading: isLoadingChat } = useDoc(chatRef);

  useEffect(() => {
    if (chatData?.requirementTitle) {
      setProductName(chatData.requirementTitle);
    }
  }, [chatData]);

  const messagesQuery = useMemoFirebase(() => {
    if (!chatRef) return null;
    return query(collection(chatRef, 'messages'), orderBy('createdAt', 'asc'));
  }, [chatRef]);

  useEffect(() => {
    if (!messagesQuery) {
      setMessages([]);
      return;
    }
    const unsubscribe = onSnapshot(messagesQuery, (querySnapshot) => {
      const newMessages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(newMessages);
    }, (error) => {
      console.error("Error fetching messages:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not load messages." });
    });
    return () => unsubscribe();
  }, [messagesQuery, toast]);


  const [dealQuantity, setDealQuantity] = useState(0);
  const [dealPrice, setDealPrice] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (scrollAreaRef.current) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || isSending || !chatRef) return;

    setIsSending(true);
    const textToSend = message;
    setMessage('');

    const messagePayload = {
      senderId: user.uid,
      text: textToSend,
      createdAt: serverTimestamp(),
    };

    try {
      addDocumentNonBlocking(collection(chatRef, 'messages'), messagePayload);

      await updateDoc(chatRef, {
        lastMessage: textToSend,
        lastUpdatedAt: serverTimestamp(),
      });

      // Notify the buyer
      if (chatData?.buyerId) {
        await createNotification(chatData.buyerId, {
          type: 'message',
          title: `New message from ${chatData.supplierName || 'Supplier'}`,
          message: textToSend,
          relatedId: chatId,
        });
      }

    } catch (error) {
      console.error("Error sending message:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to send message." });
      setMessage(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      toast({
        title: "File Selected (Prototype)",
        description: `${file.name} is ready to be sent (upload not implemented).`,
      });
    }
  };

  const handleProposeOffer = async () => {
    if (!user || !chatRef) return;
    const total = dealQuantity * dealPrice;
    const finalProduct = productName || chatData?.requirementTitle || 'Product';
    const offerText = `**New Offer Proposal**\nProduct: ${finalProduct}\nQuantity: ${dealQuantity.toLocaleString()} units\nPrice: €${dealPrice.toFixed(2)} / unit\nTotal: €${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const messagePayload = {
      senderId: user.uid,
      text: offerText,
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(chatRef, 'messages'), messagePayload);

    await updateDoc(chatRef, {
      lastMessage: "New Offer Proposal",
      lastUpdatedAt: serverTimestamp(),
      buyerAgreed: false,
      supplierAgreed: false,
    });

    // Notify the buyer of the new offer
    if (chatData?.buyerId) {
      await createNotification(chatData.buyerId, {
        type: 'message',
        title: 'New Offer Proposal Received',
        message: `${chatData.supplierName || 'Supplier'} has sent a new offer for ${finalProduct}.`,
        relatedId: chatId,
      });
    }

    setIsDialogOpen(false);
    toast({
      title: 'Offer Proposed!',
      description: 'Your new offer has been sent to the buyer.'
    });
  }

  // Monitor agreement status and create trade when both parties agree
  useEffect(() => {
    if (chatData?.buyerAgreed && chatData?.supplierAgreed && user && firestore && chatRef) {
      const createTrade = async () => {
        try {
          const deterministicTradeId = `trade_${chatId}`;
          const tradeRef = doc(firestore, "trades", deterministicTradeId);

          const finalProduct = productName || chatData?.requirementTitle || 'Product';

          console.log("Checking if trade document exists:", deterministicTradeId);
          const tradeSnap = await getDoc(tradeRef);

          if (!tradeSnap.exists()) {
            console.log("Creating trade document:", deterministicTradeId);
            await setDoc(tradeRef, {
              id: tradeRef.id,
              buyerId: chatData.buyerId || 'unknown',
              supplierId: user.uid,
              requirementId: chatData.requirementId || 'unknown',
              requirementTitle: finalProduct,
              buyerName: (chatData.buyerName && chatData.buyerName !== 'Buyer') ? chatData.buyerName : `Buyer #${(chatData.buyerId || 'Unknown').substring(0, 8).toUpperCase()}`,
              supplierName: (chatData.supplierName && chatData.supplierName !== 'Supplier') ? chatData.supplierName : `Supplier #${user.uid.substring(0, 8).toUpperCase()}`,
              value: (chatData.dealQuantity || dealQuantity || 0) * (chatData.dealPrice || dealPrice || 0),
              status: "Ongoing",
              initiated: serverTimestamp(),
              invoiceStatus: "pending",
              shippingDocsStatus: "pending",
            });
          }

          if (!chatData?.tradeCreated) {
            console.log("Updating chat with trade metadata...");
            await updateDoc(chatRef, { tradeCreated: true, tradeId: deterministicTradeId });
          }

          // Remove auto-redirect to allow users to return to chat
          // router.push(`/supplier/agreement/${deterministicTradeId}`);
        } catch (error) {
          console.error("Error creating trade:", error);
          toast({ variant: 'destructive', title: "Error", description: "Failed to finalize the deal. Please try again." });
        }
      };
      createTrade();
    }
  }, [chatData, user, firestore, router, toast, chatId, chatRef, dealPrice, dealQuantity, productName]);

  const handleFinalizeDeal = async () => {
    if (!chatRef) return;

    try {
      await updateDoc(chatRef, {
        supplierAgreed: true,
        dealQuantity: dealQuantity,
        dealPrice: dealPrice,
        dealProductName: productName || chatData?.requirementTitle || 'Product',
        lastUpdatedAt: serverTimestamp(),
      });

      const messagePayload = {
        senderId: user?.uid,
        text: `🤝 **I've agreed to the deal terms!** awaiting buyer confirmation.\nTerms: ${dealQuantity} units @ €${dealPrice}/unit`,
        createdAt: serverTimestamp(),
      };
      addDocumentNonBlocking(collection(chatRef, 'messages'), messagePayload);

      // Notify the buyer of agreement
      if (chatData?.buyerId) {
        await createNotification(chatData.buyerId, {
          type: 'trade',
          title: 'Supplier Agreed to Deal Terms',
          message: `${chatData.supplierName || 'Supplier'} has agreed to the terms for ${productName || chatData?.requirementTitle}. Action required to finalize.`,
          relatedId: chatId,
        });
      }

      toast({
        title: 'Agreement Sent!',
        description: 'Waiting for the buyer to also agree to finalize the deal.'
      });
    } catch (error) {
      console.error("Error agreeing to deal:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to agree to deal." });
    }
  };


  return (
    <DashboardLayout>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="text-lg font-semibold md:text-2xl">Chat</h1>
      </div>
      {isLoadingChat ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : chatData ? (
        <Card className='flex flex-col h-[calc(100vh-12rem)]'>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-6 w-6" />
                Chat with {chatData.buyerName || 'Buyer'}
              </CardTitle>
              <CardDescription>
                Regarding requirement: <span className='font-medium text-foreground'>{chatData.requirementTitle}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 mr-2">
                <Badge variant={chatData.buyerAgreed ? "default" : "outline"} className={cn("text-[10px]", chatData.buyerAgreed && "bg-green-600 hover:bg-green-700")}>
                  Buyer {chatData.buyerAgreed ? "Agreed" : "Pending"}
                </Badge>
                <Badge variant={chatData.supplierAgreed ? "default" : "outline"} className={cn("text-[10px]", chatData.supplierAgreed && "bg-green-600 hover:bg-green-700")}>
                  Supplier {chatData.supplierAgreed ? "Agreed" : "Pending"}
                </Badge>
              </div>
              <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant={chatData.supplierAgreed ? "outline" : "default"}>
                    <Handshake className="mr-2 h-4 w-4" />
                    {chatData.supplierAgreed ? "Change Deal Terms" : "Deal"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Agree to Deal Terms</AlertDialogTitle>
                    <AlertDialogDescription>
                      Agreeing to these terms will notify the buyer. When both parties agree, the deal is finalized.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className='space-y-4 py-4 text-sm'>
                    <div className="space-y-2">
                      <Label htmlFor='product-name'>Product</Label>
                      <Input
                        id="product-name"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="Enter product name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor='quantity'>Quantity</Label>
                        <Input id="quantity" type="number" value={dealQuantity} onChange={e => setDealQuantity(Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor='price'>Price (€ / unit)</Label>
                        <Input id="price" type="number" step="0.01" value={dealPrice} onChange={e => setDealPrice(Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t pt-4 mt-4">
                      <span>Total Price:</span>
                      <span>€{(dealQuantity * dealPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button variant="outline" onClick={handleProposeOffer}>Propose New Terms</Button>
                    <AlertDialogAction onClick={handleFinalizeDeal}>Agree & Finalize Deal</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {chatData?.tradeCreated && chatData?.tradeId && (
                <Button variant="outline" onClick={() => router.push(`/supplier/agreement/${chatData.tradeId}`)}>
                  <Handshake className="mr-2 h-4 w-4" />
                  View Agreement
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
            <ScrollArea className="flex-1 pr-4 -mr-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages?.map((msg, index) => (
                  <div key={msg.id || index} className={cn("flex items-start gap-3", msg.senderId === user?.uid ? 'justify-end' : 'justify-start')}>
                    {msg.senderId !== user?.uid && (
                      <Avatar className="w-8 h-8 border">
                        <AvatarFallback>{chatData?.buyerName?.charAt(0) || 'B'}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn("rounded-lg p-3 max-w-md", msg.senderId === user?.uid ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    {msg.senderId === user?.uid && (
                      <Avatar className="w-8 h-8 border">
                        <AvatarFallback>{chatData?.supplierName?.charAt(0) || 'S'}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {!messages || messages.length === 0 && (
                  <div className='text-center text-muted-foreground pt-10'>
                    <p>No messages yet. Wait for the buyer to start the conversation.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter>
            <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
              <Input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
              />
              <Button type="button" variant="outline" size="icon" onClick={handleFileUploadClick} disabled={isSending}>
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">Attach file</span>
              </Button>
              <Input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isLoadingChat}
              />
              <Button type="submit" disabled={isLoadingChat || isSending || !message.trim()}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Chat Not Found</CardTitle>
            <CardDescription>The chat session you are looking for could not be found.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </DashboardLayout>
  );
}

const AuthenticatedChatPage = withAuth(ChatPage, 'supplier');
export default AuthenticatedChatPage;
