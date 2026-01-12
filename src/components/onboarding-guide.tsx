'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    CheckCircle2,
    Circle,
    ChevronRight,
    HelpCircle,
    X,
    Trophy,
    Lightbulb,
    ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface Step {
    id: string;
    title: string;
    description: string;
    targetId: string;
    path: string;
    actionLabel?: string;
}

const BUYER_STEPS: Step[] = [
    {
        id: 'welcome',
        title: 'Welcome to OffshoreBrücke',
        description: 'Your bridge to reliable Indian suppliers. Let\'s get you started with a quick tour.',
        targetId: 'nav-dashboard',
        path: '/buyer',
    },
    {
        id: 'create-requirement',
        title: 'Post a Requirement',
        description: 'Start by telling us what you need. Click here to create your first sourcing requirement.',
        targetId: 'btn-create-requirement',
        path: '/buyer',
        actionLabel: 'Try it now'
    },
    {
        id: 'match-suppliers',
        title: 'Find Smart Matches',
        description: 'Our AI analyzes your requirements to find the best-verified suppliers in our database.',
        targetId: 'nav-requirements',
        path: '/buyer/requirements',
    },
    {
        id: 'chat-suppliers',
        title: 'Direct Communication',
        description: 'Negotiate and discuss details directly with suppliers through our secure chat system.',
        targetId: 'nav-chats',
        path: '/buyer/chats',
    },
    {
        id: 'manage-trades',
        title: 'Secure Trading',
        description: 'Track your shipments, manage invoices, and finalize trades all in one place.',
        targetId: 'nav-trade',
        path: '/buyer/trade',
    },
    {
        id: 'verify-profile',
        title: 'Get Verified',
        description: 'Upload your business documents to become a verified buyer and build trust.',
        targetId: 'nav-profile',
        path: '/profile',
    }
];

export function OnboardingGuide() {
    const { user } = useUser();
    const firestore = useFirestore();
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [activeStepId, setActiveStepId] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [isDismissed, setIsDismissed] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

    // Fetch onboarding state from user document
    const userRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);

    const { data: userData } = useDoc(userRef);

    useEffect(() => {
        if (userData?.onboarding) {
            setCompletedSteps(userData.onboarding.completedSteps || []);
            setIsDismissed(userData.onboarding.dismissed || false);
        }
    }, [userData]);

    const progress = useMemo(() => {
        return Math.round((completedSteps.length / BUYER_STEPS.length) * 100);
    }, [completedSteps]);

    const activeStep = useMemo(() => {
        return BUYER_STEPS.find(s => s.id === activeStepId);
    }, [activeStepId]);

    // Handle step completion based on path
    useEffect(() => {
        const matchingStep = BUYER_STEPS.find(s => s.path === pathname && !completedSteps.includes(s.id));
        if (matchingStep && matchingStep.id !== 'welcome') {
            handleCompleteStep(matchingStep.id);
        }
    }, [pathname]);

    const handleCompleteStep = async (stepId: string) => {
        if (completedSteps.includes(stepId)) return;

        const newCompleted = [...completedSteps, stepId];
        setCompletedSteps(newCompleted);

        if (userRef) {
            await updateDoc(userRef, {
                'onboarding.completedSteps': newCompleted
            });
        }
    };

    const toggleTour = (stepId: string) => {
        if (activeStepId === stepId) {
            setActiveStepId(null);
        } else {
            setActiveStepId(stepId);
            const step = BUYER_STEPS.find(s => s.id === stepId);
            if (step && step.path !== pathname) {
                router.push(step.path);
            }
        }
    };

    // Calculate tooltip position
    useEffect(() => {
        if (activeStep) {
            const el = document.getElementById(activeStep.targetId);
            if (el) {
                const rect = el.getBoundingClientRect();
                setTooltipPos({
                    top: rect.top + window.scrollY + (rect.height / 2),
                    left: rect.right + 20
                });
            }
        }
    }, [activeStep, pathname, isOpen]);

    if (isDismissed || !user || userData?.role !== 'buyer') return null;

    return (
        <>
            {/* Tooltip Overlay */}
            {activeStepId && activeStep && (
                <div
                    className="fixed z-[60] p-4 bg-popover text-popover-foreground rounded-lg shadow-xl border w-64 transition-all duration-300 pointer-events-auto"
                    style={{
                        top: `${tooltipPos.top}px`,
                        left: `${tooltipPos.left}px`,
                        transform: 'translateY(-50%)'
                    }}
                >
                    <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-0 h-0 border-y-[10px] border-y-transparent border-r-[15px] border-r-popover" />
                    <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="text-[10px] font-bold">Step {BUYER_STEPS.indexOf(activeStep) + 1}</Badge>
                        <button onClick={() => setActiveStepId(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <h4 className="font-bold text-sm mb-1">{activeStep.title}</h4>
                    <p className="text-xs text-muted-foreground mb-4">{activeStep.description}</p>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground">{BUYER_STEPS.indexOf(activeStep) + 1} of {BUYER_STEPS.length}</span>
                        <Button size="sm" className="h-7 text-[10px]" onClick={() => {
                            const nextIndex = BUYER_STEPS.indexOf(activeStep) + 1;
                            if (nextIndex < BUYER_STEPS.length) {
                                toggleTour(BUYER_STEPS[nextIndex].id);
                            } else {
                                setActiveStepId(null);
                            }
                        }}>
                            {BUYER_STEPS.indexOf(activeStep) === BUYER_STEPS.length - 1 ? 'Finish' : 'Next'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Floating Journey Progress Widget */}
            <div className="fixed bottom-6 right-6 z-50">
                {!isOpen ? (
                    <Button
                        onClick={() => setIsOpen(true)}
                        className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 transition-all duration-300"
                    >
                        {progress === 100 ? <Trophy className="h-6 w-6 text-white" /> : <HelpCircle className="h-7 w-7 text-white" />}
                        <div className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-white">
                            {progress}%
                        </div>
                    </Button>
                ) : (
                    <Card className="w-80 shadow-2xl border-2 animate-in slide-in-from-bottom-5 fade-in duration-300">
                        <CardHeader className="p-4 pb-2">
                            <div className="flex justify-between items-center mb-1">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                                    Your Buyer Journey
                                </CardTitle>
                                <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <CardDescription className="text-xs">
                                {progress === 100 ? "You're all set! You are now a platform expert." : "Complete these steps to master the platform."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-medium">
                                        <span>Progress</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="h-1.5" />
                                </div>
                                <div className="space-y-2">
                                    {BUYER_STEPS.map((step, idx) => {
                                        const isCompleted = completedSteps.includes(step.id);
                                        const isActive = activeStepId === step.id;
                                        return (
                                            <div
                                                key={step.id}
                                                className={cn(
                                                    "group flex items-center gap-3 p-2 rounded-lg text-xs cursor-pointer transition-all",
                                                    isActive ? "bg-primary/10 border-primary/20 border" : "hover:bg-muted"
                                                )}
                                                onClick={() => toggleTour(step.id)}
                                            >
                                                {isCompleted ? (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                ) : (
                                                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                )}
                                                <span className={cn("flex-1", isCompleted && "text-muted-foreground line-through")}>
                                                    {step.title}
                                                </span>
                                                {isActive ? (
                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 animate-pulse">Touring</Badge>
                                                ) : (
                                                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="p-4 pt-0 flex justify-between gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-[10px] h-7 px-2"
                                onClick={async () => {
                                    if (userRef) {
                                        await updateDoc(userRef, { 'onboarding.dismissed': true });
                                        setIsDismissed(true);
                                    }
                                }}
                            >
                                Hide permanently
                            </Button>
                            {progress < 100 && (
                                <Button size="sm" className="h-7 text-[10px] flex-1" onClick={() => {
                                    const next = BUYER_STEPS.find(s => !completedSteps.includes(s.id));
                                    if (next) toggleTour(next.id);
                                }}>
                                    Next Step
                                    <ArrowUpRight className="ml-1 h-3 w-3" />
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                )}
            </div>

            {/* CSS Animation Overlay for highlighting */}
            {activeStepId && (
                <div className="fixed inset-0 z-[55] pointer-events-none">
                    <div className="absolute inset-0 bg-black/40" />
                    <div
                        className="absolute bg-white/0 border-4 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-all duration-300 pointer-events-none"
                        style={(() => {
                            const el = document.getElementById(activeStep?.targetId || '');
                            if (!el) return { width: 0, height: 0, top: 0, left: 0, opacity: 0 };
                            const rect = el.getBoundingClientRect();
                            return {
                                width: `${rect.width + 10}px`,
                                height: `${rect.height + 10}px`,
                                top: `${rect.top - 5}px`,
                                left: `${rect.left - 5}px`,
                                opacity: 1
                            };
                        })()}
                    />
                </div>
            )}
        </>
    );
}
