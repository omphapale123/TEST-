'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Save, CheckCircle, Clock, KeyRound, Upload, ArrowLeft, Eye } from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, query, where, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { useUser, useFirestore, updateDocumentNonBlocking, useMemoFirebase, useCollection, initializeFirebase, storage } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FALLBACK_CATEGORIES } from '@/constants/categories';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelect } from '@/components/ui/multi-select';

const profileSchema = z.object({
    fullName: z.string().min(2, { message: "Name must be at least 2 characters." }),
    contactNumber: z.string().optional(),
    companyName: z.string().min(2, { message: "Company name must be at least 2 characters." }),
    // Buyer specific
    hrbNumber: z.string().optional(),
    // Supplier specific
    gstNumber: z.string().optional(),
    panNumber: z.string().optional(),
    udyamNumber: z.string().optional(),
    isoCertificate: z.string().optional(),
    isoDocumentUrl: z.string().optional(),
    tuvCertificate: z.string().optional(),
    tuvDocumentUrl: z.string().optional(),
    companyDescription: z.string().optional(),
    specializedCategories: z.array(z.string()).optional(),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"]
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

function ProfilePage() {
    const { user, userRole, verificationStatus, loading: isAuthLoading } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [isEditingVerification, setIsEditingVerification] = useState(false);

    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'categories'), where('active', '==', true));
    }, [firestore]);

    const { data: categories, isLoading: isLoadingCategories } = useCollection(categoriesQuery);
    const [isUploading, setIsUploading] = useState<string | null>(null); // 'iso' | 'tuv' | null

    const categoryOptions = useMemoFirebase(() => {
        let options = categories?.map(c => ({ value: c.id || c.name, label: c.label })) || [];

        if (options.length === 0) {
            options = FALLBACK_CATEGORIES.map(c => ({ value: c.id, label: c.label }));
        }

        // Always ensure 'Other' is an option if not already present
        const hasOther = options.some(opt => opt.value === 'other');
        if (!hasOther) {
            options.push({ value: 'other', label: 'Other' });
        }

        return options;
    }, [categories]);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            fullName: '',
            contactNumber: '',
            companyName: '',
            hrbNumber: '',
            gstNumber: '',
            panNumber: '',
            udyamNumber: '',
            isoCertificate: '',
            isoDocumentUrl: '',
            tuvCertificate: '',
            tuvDocumentUrl: '',
            companyDescription: '',
            specializedCategories: [],
        },
    });

    useEffect(() => {
        if (user && firestore && userDocRef) {
            const fetchUserData = async () => {
                const docSnap = await (await import('firebase/firestore')).getDoc(userDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    form.reset({
                        fullName: data.fullName || '',
                        contactNumber: data.contactNumber || '',
                        companyName: data.companyName || '',
                        hrbNumber: data.hrbNumber || '',
                        gstNumber: data.gstNumber || '',
                        panNumber: data.panNumber || '',
                        udyamNumber: data.udyamNumber || '',
                        isoCertificate: data.isoCertificate || '',
                        tuvCertificate: data.tuvCertificate || '',
                        companyDescription: data.companyDescription || '',
                        specializedCategories: data.specializedCategories || [],
                    });
                }
            };
            fetchUserData();
        }
    }, [user, firestore, userDocRef, form]);


    const passwordForm = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        }
    });

    const handleFileUpload = async (fieldName: 'isoDocumentUrl' | 'tuvDocumentUrl', file: File) => {
        if (!user) return;

        // Firestore has a 1MB limit per document. 
        // Base64 increases size by ~33%, so we limit files to ~500KB to be safe.
        const maxSize = 500 * 1024;
        if (file.size > maxSize) {
            toast({
                variant: 'destructive',
                title: 'File too large',
                description: 'To save on storage costs, please upload a file smaller than 500KB (e.g., a compressed PDF or image).'
            });
            return;
        }

        const type = fieldName === 'isoDocumentUrl' ? 'iso' : 'tuv';
        setIsUploading(type);
        setIsSaving(true);
        console.log(`[Profile] Converting ${fieldName} to Base64:`, file.name);

        try {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
            });

            reader.readAsDataURL(file);
            const base64String = await base64Promise;

            console.log(`[Profile] Base64 conversion successful for ${fieldName}`);
            form.setValue(fieldName, base64String);

            toast({
                title: "Document Added",
                description: "Document prepared for submission."
            });
        } catch (error) {
            console.error("[Profile] Error processing file:", error);
            toast({ variant: 'destructive', title: 'Processing Failed', description: 'Could not process the document.' });
        } finally {
            setIsUploading(null);
            setIsSaving(false);
        }
    };


    const onSubmit = async (data: ProfileFormValues) => {
        if (!userDocRef) return;
        setIsSaving(true);
        console.log("Saving profile data...", data);
        try {
            await updateDocumentNonBlocking(userDocRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });
            console.log("Profile save successful");
            toast({
                title: "Profile Saved",
                description: "Your profile information has been updated.",
            });
        } catch (error) {
            console.error("Error saving profile:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save your profile.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordChange = async (data: PasswordFormValues) => {
        if (!user || !user.email) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
            return;
        }
        setIsChangingPassword(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, data.newPassword);
            toast({
                title: 'Password Updated',
                description: 'Your password has been changed successfully.',
            });
            passwordForm.reset();
            setIsPasswordDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Password Change Failed',
                description: 'The current password you entered is incorrect. Please try again.',
            });
        } finally {
            setIsChangingPassword(false);
        }
    }

    const handleVerify = async () => {
        if (!userDocRef) return;

        const isFormValid = await form.trigger();
        if (!isFormValid || (userRole === 'supplier' && !form.getValues('isoCertificate'))) {
            toast({
                variant: 'destructive',
                title: userRole === 'supplier' && !form.getValues('isoCertificate') ? "ISO Required" : "Incomplete Profile",
                description: userRole === 'supplier' && !form.getValues('isoCertificate')
                    ? "ISO Certificate Number and Document are mandatory for suppliers."
                    : "Please fill out all required profile fields before requesting verification.",
            });
            return;
        }

        if (userRole === 'supplier' && !form.getValues('isoDocumentUrl')) {
            toast({
                variant: 'destructive',
                title: "Document Required",
                description: "Please upload your ISO Certificate document.",
            });
            return;
        }

        setIsSaving(true);
        console.log("[Profile] Submitting verification request...");

        try {
            const values = form.getValues();
            const verificationData: any = {
                verificationStatus: 'pending',
                updatedAt: serverTimestamp(),
            };

            // Add role-specific verification fields
            if (userRole === 'buyer') {
                verificationData.hrbNumber = values.hrbNumber;
            } else if (userRole === 'supplier') {
                verificationData.gstNumber = values.gstNumber;
                verificationData.panNumber = values.panNumber;
                verificationData.udyamNumber = values.udyamNumber;
                verificationData.isoCertificate = values.isoCertificate;
                verificationData.isoDocumentUrl = values.isoDocumentUrl;
                verificationData.tuvCertificate = values.tuvCertificate;
                verificationData.tuvDocumentUrl = values.tuvDocumentUrl;
            }

            console.log("[Profile] Update payload:", verificationData);

            await updateDocumentNonBlocking(userDocRef, verificationData);

            console.log("[Profile] Firestore write successful");

            toast({
                title: "Verification Request Sent",
                description: "Your documents have been submitted to the admin for verification.",
            });

            setIsEditingVerification(false);
            // RELOAD REMOVED: Relying on onSnapshot in Provider to update verificationStatus
        } catch (error) {
            console.error("[Profile] Verification submission error:", error);
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: 'Failed to submit verification request. Please check your connection and try again.'
            });
        } finally {
            console.log("[Profile] Setting isSaving to false");
            setIsSaving(false);
        }
    };

    const VerificationButton = ({ forRole }: { forRole: 'buyer' | 'supplier' }) => {
        if (userRole !== forRole) return null;

        if (isEditingVerification) {
            return (
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingVerification(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={handleVerify} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Submit for Re-verification
                    </Button>
                </div>
            );
        }

        switch (verificationStatus) {
            case 'unverified':
                return (
                    <Button type="button" variant="secondary" onClick={handleVerify} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Request Verification
                    </Button>
                );
            case 'pending':
                return (
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" disabled>
                            <Clock className="mr-2 h-4 w-4" />
                            Pending
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-8 py-0 underline text-primary" onClick={() => setIsEditingVerification(true)}>
                            Edit / Re-upload
                        </Button>
                    </div>
                );
            case 'verified':
                return (
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" disabled className="border-green-500 text-green-600 bg-green-500/10">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Verified
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-8 py-0 underline text-primary" onClick={() => setIsEditingVerification(true)}>
                            Edit Details
                        </Button>
                    </div>
                );
            default:
                return null;
        }
    }

    if (isAuthLoading) {
        return <DashboardLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                </Button>
                <h1 className="text-lg font-semibold md:text-2xl">My Profile</h1>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>User Profile</CardTitle>
                            <CardDescription>Manage your personal, company, and security details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="fullName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Full Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="contactNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contact Number</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="companyName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Company Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {userRole === 'buyer' && (
                                <>
                                    <Separator />
                                    <div>
                                        <h3 className="text-base font-medium">Buyer Verification</h3>
                                        <p className="text-sm text-muted-foreground">Submit your German commercial register number for verification.</p>
                                        <div className="mt-4">
                                            <FormField
                                                control={form.control}
                                                name="hrbNumber"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>HRA / HRB Number</FormLabel>
                                                        <div className="flex items-center gap-2">
                                                            <FormControl>
                                                                <Input {...field} disabled={verificationStatus !== 'unverified' && !isEditingVerification} />
                                                            </FormControl>
                                                            <VerificationButton forRole="buyer" />
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {userRole === 'supplier' && (
                                <>
                                    <Separator />
                                    <div>
                                        <h3 className="text-base font-medium">Company Details</h3>
                                        <p className="text-sm text-muted-foreground">Provide details about your company to help buyers understand your business.</p>
                                        <div className="mt-4 space-y-6">
                                            <FormField
                                                control={form.control}
                                                name="companyDescription"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Company Description</FormLabel>
                                                        <FormControl>
                                                            <Textarea {...field} placeholder="Describe your company's mission, expertise, and what makes you unique." />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="specializedCategories"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Specialized Categories</FormLabel>
                                                        <MultiSelect
                                                            options={categoryOptions}
                                                            selected={field.value || []}
                                                            onChange={field.onChange}
                                                            className="w-full"
                                                            placeholder='Select categories...'
                                                        />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <Separator />
                                    <div>
                                        <h3 className="text-base font-medium">Supplier Verification</h3>
                                        <p className="text-sm text-muted-foreground">Submit your Indian business document numbers for verification.</p>
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="gstNumber"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>GST Number</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} disabled={verificationStatus !== 'unverified' && !isEditingVerification} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="panNumber"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>PAN Number</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} disabled={verificationStatus !== 'unverified' && !isEditingVerification} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="udyamNumber"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Udyam Number</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} disabled={verificationStatus !== 'unverified' && !isEditingVerification} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="isoCertificate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>ISO Certificate Number (Required)</FormLabel>
                                                        <div className="flex items-center gap-2">
                                                            <FormControl>
                                                                <Input {...field} placeholder="e.g., ISO 9001:2015" disabled={verificationStatus !== 'unverified' && !isEditingVerification} />
                                                            </FormControl>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    type="file"
                                                                    className="hidden"
                                                                    id="iso-upload"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleFileUpload('isoDocumentUrl', file);
                                                                    }}
                                                                    disabled={verificationStatus !== 'unverified' && !isEditingVerification}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant={form.watch('isoDocumentUrl') ? "secondary" : "outline"}
                                                                    size="icon"
                                                                    onClick={() => document.getElementById('iso-upload')?.click()}
                                                                    disabled={(verificationStatus !== 'unverified' && !isEditingVerification) || !!isUploading}
                                                                >
                                                                    {isUploading === 'iso' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                                </Button>
                                                                {form.watch('isoDocumentUrl') && (
                                                                    <Button type="button" variant="ghost" size="icon" onClick={() => window.open(form.watch('isoDocumentUrl'), '_blank')}>
                                                                        <Eye className="h-4 w-4 text-primary" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="tuvCertificate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>TUV Certificate Number (Optional)</FormLabel>
                                                        <div className="flex items-center gap-2">
                                                            <FormControl>
                                                                <Input {...field} placeholder="Enter TUV certificate details" disabled={verificationStatus !== 'unverified' && !isEditingVerification} />
                                                            </FormControl>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    type="file"
                                                                    className="hidden"
                                                                    id="tuv-upload"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleFileUpload('tuvDocumentUrl', file);
                                                                    }}
                                                                    disabled={verificationStatus !== 'unverified' && !isEditingVerification}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant={form.watch('tuvDocumentUrl') ? "secondary" : "outline"}
                                                                    size="icon"
                                                                    onClick={() => document.getElementById('tuv-upload')?.click()}
                                                                    disabled={(verificationStatus !== 'unverified' && !isEditingVerification) || !!isUploading}
                                                                >
                                                                    {isUploading === 'tuv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                                </Button>
                                                                {form.watch('tuvDocumentUrl') && (
                                                                    <Button type="button" variant="ghost" size="icon" onClick={() => window.open(form.watch('tuvDocumentUrl'), '_blank')}>
                                                                        <Eye className="h-4 w-4 text-primary" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="mt-6">
                                            <VerificationButton forRole="supplier" />
                                        </div>
                                    </div>
                                </>
                            )}


                            <Separator />

                            <div>
                                <h3 className="text-base font-medium">Security</h3>
                                <p className="text-sm text-muted-foreground">Manage your account security settings.</p>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                    <div>
                                        <FormLabel>Email</FormLabel>
                                        <Input value={user?.email || ''} disabled className="mt-2" />
                                    </div>
                                    <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline">
                                                <KeyRound className="mr-2 h-4 w-4" />
                                                Change Password
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <Form {...passwordForm}>
                                                <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)}>
                                                    <DialogHeader>
                                                        <DialogTitle>Change Password</DialogTitle>
                                                        <DialogDescription>
                                                            Enter your current and new password. After confirming, you will be logged out.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="grid gap-4 py-4">
                                                        <FormField
                                                            control={passwordForm.control}
                                                            name="currentPassword"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Current Password</FormLabel>
                                                                    <FormControl>
                                                                        <Input type="password" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={passwordForm.control}
                                                            name="newPassword"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>New Password</FormLabel>
                                                                    <FormControl>
                                                                        <Input type="password" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={passwordForm.control}
                                                            name="confirmPassword"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Confirm New Password</FormLabel>
                                                                    <FormControl>
                                                                        <Input type="password" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                    <DialogFooter>
                                                        <Button type="submit" disabled={isChangingPassword}>
                                                            {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                            Save new password
                                                        </Button>
                                                    </DialogFooter>
                                                </form>
                                            </Form>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Profile
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </DashboardLayout>
    );
}

const AuthenticatedProfilePage = (props: any) => {
    const { userRole, loading } = useAuth();
    if (loading) return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

    const role = userRole || 'buyer';
    const Component = withAuth(ProfilePage, role);
    return <Component {...props} />;
};

export default AuthenticatedProfilePage;

