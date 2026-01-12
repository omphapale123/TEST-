
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { collection, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { Combobox } from '@/components/ui/combobox';

const formSchema = z.object({
  title: z.string().min(5, { message: 'Title must be at least 5 characters.' }),
  productCategory: z.string({ required_error: 'Please select a category.' }).min(1, { message: 'Please select a category.' }),
  otherProductCategory: z.string().optional(),
  description: z.string().min(20, { message: 'Description must be at least 20 characters.' }),
  quantity: z.coerce.number().min(1, { message: 'Quantity must be at least 1.' }),
  targetPrice: z.coerce.number().positive({ message: 'Target price must be a positive number.' }),
  destinationCountry: z.string().min(2, { message: 'Please specify a country.' }),
}).refine(data => {
    if (data.productCategory === 'other' && !data.otherProductCategory) {
        return false;
    }
    return true;
}, {
    message: "Please specify the category",
    path: ["otherProductCategory"],
});

type FormValues = z.infer<typeof formSchema>;

interface EditRequirementPageProps {
  requirementId: string;
}

function EditRequirementPage({ requirementId }: EditRequirementPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  
  const requirementRef = useMemoFirebase(() => {
    if (!firestore || !requirementId) return null;
    return doc(firestore, 'requirements', requirementId);
  }, [firestore, requirementId]);

  const { data: requirement, isLoading: isLoadingRequirement } = useDoc(requirementRef);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'categories'), where('active', '==', true));
  }, [firestore]);

  const { data: categories, isLoading: isLoadingCategories } = useCollection(categoriesQuery);
  
  const categoryOptions = useMemo(() => {
    const options = (categories || []).map(c => ({ value: c.name, label: c.label }));
    options.push({ value: 'other', label: 'Other' });
    return options;
  }, [categories]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        title: '',
        productCategory: '',
        otherProductCategory: '',
        description: '',
        quantity: 1,
        targetPrice: 0,
        destinationCountry: 'Germany',
    },
  });

  useEffect(() => {
    if (requirement && categoryOptions.length > 1) {
        const currentFormValues = form.getValues();
        
        // Only update the form if the data has changed and the form isn't dirty
        if (JSON.stringify(currentFormValues) !== JSON.stringify(requirement)) {
            const categoryExists = categoryOptions.some(opt => opt.value === requirement.productCategory);
            
            form.reset({
                title: requirement.title || '',
                productCategory: categoryExists ? requirement.productCategory : 'other',
                otherProductCategory: categoryExists ? '' : requirement.productCategory,
                description: requirement.description || '',
                quantity: requirement.quantity || 1,
                targetPrice: requirement.targetPrice || 0,
                destinationCountry: requirement.destinationCountry || 'Germany',
            });
        }
    }
  }, [requirement, categoryOptions, form]);


  const watchedCategory = useWatch({
    control: form.control,
    name: 'productCategory',
  });

  async function handleSave(values: FormValues, status: 'draft' | 'submitted') {
    if (!user || !firestore || !requirementRef) {
      toast({ variant: 'destructive', title: 'Error', description: 'User or database service not available.' });
      return;
    }

    status === 'draft' ? setIsDraftLoading(true) : setIsSubmitLoading(true);

    const { otherProductCategory, ...payload } = values;
    const finalPayload = {
      ...payload,
      productCategory: values.productCategory === 'other' && values.otherProductCategory ? values.otherProductCategory : values.productCategory,
      status,
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDocumentNonBlocking(requirementRef, finalPayload);
      
      toast({
        title: 'Requirement Updated!',
        description: `Your requirement has been updated and saved as a ${status}.`,
      });
      
      if (status === 'submitted') {
        router.push(`/buyer/requirements/${requirementId}/find-suppliers`);
      }

    } catch (error) {
        console.error("Error updating requirement: ", error);
        toast({
            variant: "destructive",
            title: "Something went wrong",
            description: "Could not update your requirement. Please try again."
        });
    } finally {
      setIsDraftLoading(false);
      setIsSubmitLoading(false);
    }
  }
  
  const isLoading = isDraftLoading || isSubmitLoading || isLoadingRequirement;

  if (isLoadingRequirement && !form.formState.isDirty) {
     return (
        <DashboardLayout>
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        </DashboardLayout>
     )
  }
  
   if (!isLoadingRequirement && !requirement) {
     return (
        <DashboardLayout>
            <Card>
                <CardHeader>
                    <CardTitle className="text-destructive">Requirement Not Found</CardTitle>
                    <CardDescription>
                        The requirement you are trying to edit could not be found.
                    </CardDescription>
                </CardHeader>
            </Card>
        </DashboardLayout>
     )
  }

  return (
    <DashboardLayout>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
        </Button>
        <h1 className="text-lg font-semibold md:text-2xl">Edit Requirement</h1>
      </div>
      <Form {...form}>
        <form>
          <Card>
            <CardHeader>
              <CardTitle>Edit Your Product Requirement</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requirement Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., High-Quality Cotton T-Shirts" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="productCategory"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Product Category</FormLabel>
                    <FormControl>
                       <Combobox
                        options={categoryOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select a category..."
                        searchPlaceholder="Search categories..."
                        emptyMessage={isLoadingCategories ? "Loading categories..." : "No category found."}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchedCategory === 'other' && (
                 <FormField
                    control={form.control}
                    name="otherProductCategory"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Please specify the category</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., Custom Branded Apparel" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              )}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the specifications, materials, and any other important details..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Price (per item, in USD)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="5.50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="destinationCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination Country</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Germany" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-4">
              <Button variant="outline" onClick={form.handleSubmit((values) => handleSave(values, 'draft'))} disabled={isLoading}>
                {isDraftLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save as Draft
              </Button>
              <Button onClick={form.handleSubmit((values) => handleSave(values, 'submitted'))} disabled={isLoading}>
                {isSubmitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Requirement
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </DashboardLayout>
  );
}

export default withAuth(EditRequirementPage, 'buyer');
    