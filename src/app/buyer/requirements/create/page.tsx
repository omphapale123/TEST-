
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { collection, query, where, DocumentReference, serverTimestamp } from 'firebase/firestore';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useUser, useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
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

function CreateRequirementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();

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
    const aiDataString = sessionStorage.getItem('ai-generated-requirement');
    if (aiDataString) {
      try {
        const aiData = JSON.parse(aiDataString);
        form.reset({
          title: aiData.title || '',
          productCategory: aiData.productCategory || '',
          description: aiData.description || '',
          quantity: aiData.quantity || 1,
          targetPrice: aiData.targetPrice || 0,
          destinationCountry: aiData.destinationCountry || 'Germany',
        });
      } catch (e) {
        console.error("Failed to parse AI data from session storage", e);
      } finally {
        sessionStorage.removeItem('ai-generated-requirement');
      }
    }
  }, [form]);

  const watchedCategory = useWatch({
    control: form.control,
    name: 'productCategory',
  });

  async function handleSave(values: FormValues, status: 'draft' | 'submitted') {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to save a requirement.' });
      return;
    }

    status === 'draft' ? setIsDraftLoading(true) : setIsSubmitLoading(true);

    const finalPayload = {
      ...values,
      productCategory: values.productCategory === 'other' ? values.otherProductCategory : values.productCategory,
      buyerId: user.uid,
      status,
      createdAt: serverTimestamp(),
    };
    
    try {
        const docRef = await addDocumentNonBlocking(collection(firestore, 'requirements'), finalPayload);
        toast({
          title: 'Requirement Saved!',
          description: `Your requirement has been saved as a ${status}.`,
        });
        
        if (status === 'submitted') {
          router.push(`/buyer/requirements/${docRef.id}/find-suppliers`);
        } else {
          router.push('/buyer/requirements');
        }
    } catch(error) {
        toast({
            variant: 'destructive',
            title: "Error saving requirement",
            description: "There was an issue saving your requirement. Please try again."
        });
        console.error("Error creating requirement: ", error);
    } finally {
        setIsDraftLoading(false);
        setIsSubmitLoading(false);
    }
  }

  const isLoading = isDraftLoading || isSubmitLoading;

  return (
    <DashboardLayout>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Create Requirement</h1>
      </div>
      <Form {...form}>
        <form>
          <Card>
            <CardHeader>
              <CardTitle>New Product Requirement</CardTitle>
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

export default withAuth(CreateRequirementPage, 'buyer');
