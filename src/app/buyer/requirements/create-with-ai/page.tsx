'use client';
import { useState, useRef, ChangeEvent, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, Send, Loader2, Sparkles, Bot, User, FileText, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { handleConversation, type ConversationalInput, type ConversationState } from '@/ai/flows/conversational-requirement-flow';


interface Message {
    role: 'user' | 'bot';
    content: string;
    image?: string;
    pdf?: { name: string, content: string };
    spreadsheet?: { name: string, data: string };
}

function CreateWithAiPage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'bot',
            content: "Hello! I'm here to help you create a product requirement. What product are you looking to source?",
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversationState, setConversationState] = useState<ConversationState | null>(null);
    const [isConversationComplete, setIsConversationComplete] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const router = useRouter();

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [pdfPreview, setPdfPreview] = useState<{ name: string, content: string } | null>(null);
    const [spreadsheetPreview, setSpreadsheetPreview] = useState<{ name: string, data: string } | null>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            // Use setTimeout to ensure DOM has updated
            setTimeout(() => {
                const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
                if (scrollContainer) {
                    // Smooth scroll to bottom
                    scrollContainer.scrollTo({
                        top: scrollContainer.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            }, 100);
        }
    }, [messages]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check if it's a spreadsheet file
        const isSpreadsheet = file.name.endsWith('.xlsx') ||
            file.name.endsWith('.xls') ||
            file.name.endsWith('.csv') ||
            file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.type === 'application/vnd.ms-excel' ||
            file.type === 'text/csv';

        if (isSpreadsheet) {
            // Handle spreadsheet files
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Get first sheet
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    // Convert to readable text format
                    let textData = `Spreadsheet: ${file.name}\n\n`;
                    jsonData.forEach((row: any, index: number) => {
                        if (row && row.length > 0) {
                            textData += row.join(' | ') + '\n';
                        }
                    });

                    setSpreadsheetPreview({ name: file.name, data: textData });
                    setImagePreview(null);
                    setPdfPreview(null);
                } catch (error) {
                    console.error('Error parsing spreadsheet:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Error Parsing Spreadsheet',
                        description: 'Could not read the spreadsheet file. Please try again.',
                    });
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            // Handle image and PDF files
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUri = e.target?.result as string;
                if (file.type.startsWith('image/')) {
                    setImagePreview(dataUri);
                    setPdfPreview(null);
                    setSpreadsheetPreview(null);
                } else if (file.type === 'application/pdf') {
                    setPdfPreview({ name: file.name, content: dataUri });
                    setImagePreview(null);
                    setSpreadsheetPreview(null);
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Unsupported File Type',
                        description: 'Please upload an image, PDF, Excel, or CSV file.',
                    });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() && !imagePreview && !pdfPreview && !spreadsheetPreview) return;

        const userMessage: Message = { role: 'user', content: input };
        if (imagePreview) userMessage.image = imagePreview;
        if (pdfPreview) userMessage.pdf = pdfPreview;
        if (spreadsheetPreview) userMessage.spreadsheet = spreadsheetPreview;

        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        setInput('');
        setImagePreview(null);
        setPdfPreview(null);
        setSpreadsheetPreview(null);

        try {
            // Prepare input for conversational flow
            const conversationalInput: ConversationalInput = {
                userMessage: input,
                currentState: conversationState || undefined,
                pdf: pdfPreview || undefined,
                spreadsheet: spreadsheetPreview || undefined,
            };

            // Call the conversational flow
            const result = await handleConversation(conversationalInput);

            // Update conversation state
            setConversationState(result.updatedState);
            setIsConversationComplete(result.isComplete);

            // Add bot response to messages
            const botMessage: Message = {
                role: 'bot',
                content: result.botMessage
            };
            setMessages((prev) => [...prev, botMessage]);

        } catch (error) {
            console.error("AI flow error:", error);
            toast({
                variant: 'destructive',
                title: 'AI Error',
                description: 'Could not process your request. Please try again.',
            });
            const botErrorMessage: Message = {
                role: 'bot',
                content: "I'm sorry, I had trouble understanding that. Could you try rephrasing your request?"
            };
            setMessages((prev) => [...prev, botErrorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRequirement = () => {
        if (!conversationState || !isConversationComplete) return;
        // We'll use session storage to pass the data to the create page
        sessionStorage.setItem('ai-generated-requirement', JSON.stringify(conversationState.collectedData));
        router.push('/buyer/requirements/create');
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-8rem)]">
                <div className="flex items-center mb-4 flex-shrink-0">
                    <h1 className="text-lg font-semibold md:text-2xl flex items-center gap-2">
                        <Sparkles className="text-accent" />
                        Create Requirement with AI
                    </h1>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 h-full">
                    <Card className="md:col-span-2 flex flex-col min-h-0">
                        <CardHeader className="flex-shrink-0">
                            <CardTitle>AI Assistant</CardTitle>
                            <CardDescription>Describe your product requirement. You can also upload images, PDFs, Excel files, or CSV files.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden p-6 min-h-0">
                            <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                                <div className="space-y-4 pb-4">
                                    {messages.map((msg, index) => (
                                        <div key={index} className={cn("flex items-start gap-3", msg.role === 'user' ? 'justify-end' : '')}>
                                            {msg.role === 'bot' && (
                                                <Avatar className="w-8 h-8 border">
                                                    <AvatarFallback><Bot size={16} /></AvatarFallback>
                                                </Avatar>
                                            )}
                                            <div className={cn("rounded-lg p-3 max-w-md", msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                                <p className="text-sm">{msg.content}</p>
                                                {msg.image && <img src={msg.image} alt="Uploaded" className="mt-2 rounded-md max-w-xs" />}
                                                {msg.pdf && (
                                                    <div className="mt-2 flex items-center gap-2 bg-background/50 p-2 rounded-md border">
                                                        <FileText className="h-5 w-5" />
                                                        <span className="text-sm truncate">{msg.pdf.name}</span>
                                                    </div>
                                                )}
                                                {msg.spreadsheet && (
                                                    <div className="mt-2 flex items-center gap-2 bg-background/50 p-2 rounded-md border">
                                                        <FileSpreadsheet className="h-5 w-5" />
                                                        <span className="text-sm truncate">{msg.spreadsheet.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {msg.role === 'user' && (
                                                <Avatar className="w-8 h-8 border">
                                                    <AvatarFallback><User size={16} /></AvatarFallback>
                                                </Avatar>
                                            )}
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex items-start gap-3">
                                            <Avatar className="w-8 h-8 border">
                                                <AvatarFallback><Bot size={16} /></AvatarFallback>
                                            </Avatar>
                                            <div className="rounded-lg p-3 max-w-sm bg-muted flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <p className="text-sm text-muted-foreground">Thinking...</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                        <CardFooter className="p-6 pt-0">
                            <form onSubmit={handleSubmit} className="w-full flex-shrink-0 space-y-2">
                                {(imagePreview || pdfPreview || spreadsheetPreview) && (
                                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                        {imagePreview && <ImageIcon className="h-5 w-5" />}
                                        {pdfPreview && <FileText className="h-5 w-5" />}
                                        {spreadsheetPreview && <FileSpreadsheet className="h-5 w-5" />}
                                        <span className="text-sm text-muted-foreground truncate">
                                            {imagePreview ? 'Image attached' : pdfPreview ? pdfPreview.name : spreadsheetPreview?.name}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        accept="image/*,application/pdf,.xlsx,.xls,.csv"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isLoading}
                                    >
                                        <Paperclip className="h-4 w-4" />
                                    </Button>
                                    <Input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="e.g., 'I need 5000 units of 100% cotton t-shirts...'"
                                        disabled={isLoading}
                                    />
                                    <Button type="submit" disabled={isLoading}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </form>
                        </CardFooter>
                    </Card>
                    <Card className="h-full flex flex-col">
                        <CardHeader className="flex-shrink-0">
                            <CardTitle>Extracted Details</CardTitle>
                            <CardDescription>The AI will fill this in as you chat.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-4 overflow-y-auto">
                            {conversationState?.collectedData ? (
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <p className="font-medium">Title</p>
                                        <p className="text-muted-foreground">{conversationState.collectedData.title || '...'}</p>
                                    </div>
                                    <div>
                                        <p className="font-medium">Product Category</p>
                                        <p className="text-muted-foreground">{conversationState.collectedData.productCategory || '...'}</p>
                                    </div>
                                    <div>
                                        <p className="font-medium">Quantity</p>
                                        <p className="text-muted-foreground">{conversationState.collectedData.quantity?.toLocaleString() || '...'}</p>
                                    </div>
                                    <div>
                                        <p className="font-medium">Target Price</p>
                                        <p className="text-muted-foreground">{conversationState.collectedData.targetPrice ? `€${conversationState.collectedData.targetPrice.toFixed(2)}` : '...'}</p>
                                    </div>
                                    <div>
                                        <p className="font-medium">Destination</p>
                                        <p className="text-muted-foreground">{conversationState.collectedData.destinationCountry || '...'}</p>
                                    </div>
                                    <div>
                                        <p className="font-medium">Description</p>
                                        <p className="text-muted-foreground line-clamp-4">{conversationState.collectedData.description || '...'}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-10">
                                    <p>No details collected yet. Start chatting to begin!</p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" disabled={!isConversationComplete || isLoading} onClick={handleCreateRequirement}>
                                Create Requirement
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </DashboardLayout >
    );
}

export default withAuth(CreateWithAiPage, 'buyer');
