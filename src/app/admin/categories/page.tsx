
'use client';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Trash2 } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';

import { withAuth } from '@/components/with-auth';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import {
    useFirestore,
    useCollection,
    useMemoFirebase,
    addDocumentNonBlocking,
    updateDocumentNonBlocking,
    deleteDocumentNonBlocking,
  } from '@/firebase';
import { doc } from 'firebase/firestore';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).transform(val => val.toLowerCase().replace(/\s+/g, '_')),
  label: z.string().min(2, { message: 'Label must be at least 2 characters.' }),
});

const bulkImportSchema = z.array(z.object({
  name: z.string(),
  label: z.string(),
}));

function CategoriesContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'categories');
  }, [firestore]);

  const { data: categories, isLoading, refetch } = useCollection(categoriesQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      label: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) return;
    setIsSubmitting(true);

    const newCategory = { ...values, active: true };
    await addDocumentNonBlocking(collection(firestore, 'categories'), newCategory);
    
    toast({
      title: 'Category Added',
      description: `Category "${values.label}" has been successfully created.`,
    });
    form.reset();
    setIsSubmitting(false);
  }

  async function handleBulkImport() {
    if (!firestore) return;
    setIsBulkImporting(true);
    try {
        const parsedJson = JSON.parse(jsonInput);
        const validationResult = bulkImportSchema.safeParse(parsedJson);

        if (!validationResult.success) {
            toast({
                variant: "destructive",
                title: "Invalid JSON format",
                description: "Please provide an array of objects with 'name' and 'label' properties.",
            });
            setIsBulkImporting(false);
            return;
        }

        const categoriesCollection = collection(firestore, 'categories');
        for (const cat of validationResult.data) {
            await addDocumentNonBlocking(categoriesCollection, { ...cat, active: true });
        }

        toast({
            title: "Bulk Import Successful",
            description: `${validationResult.data.length} categories have been imported.`,
        });
        setJsonInput('');

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Import Failed",
            description: "Could not import categories. Check the JSON format.",
        });
    } finally {
        setIsBulkImporting(false);
    }
  }

  async function toggleCategoryStatus(categoryId: string, currentStatus: boolean) {
    if (!firestore) return;
    const categoryRef = doc(firestore, 'categories', categoryId);
    await updateDocumentNonBlocking(categoryRef, { active: !currentStatus });
    
    toast({
        title: `Category ${!currentStatus ? 'Activated' : 'Deactivated'}`,
        description: `The category has been updated.`,
    });
  }

  async function deleteCategory(categoryId: string, categoryLabel: string) {
    if (!firestore) return;
    if (confirm(`Are you sure you want to delete the category "${categoryLabel}"? This cannot be undone.`)) {
        const categoryRef = doc(firestore, 'categories', categoryId);
        await deleteDocumentNonBlocking(categoryRef);
        toast({
            title: 'Category Deleted',
            description: `Category "${categoryLabel}" has been removed.`,
        });
    }
  }

  return (
    <DashboardLayout>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Manage Categories</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Add New Category</CardTitle>
            <CardDescription>Create a new product category for buyers to select.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Label</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Industrial Machinery" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Name/ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., industrial_machinery" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Category
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Bulk Import from JSON</CardTitle>
                <CardDescription>Paste a JSON array of categories to import them all at once.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Textarea
                    placeholder='[{"label": "Textiles & Apparel", "name": "textiles_apparel"}, ...]'
                    className="min-h-[150px] font-mono text-xs"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    disabled={isBulkImporting}
                />
                <Button onClick={handleBulkImport} disabled={isBulkImporting || !jsonInput.trim()}>
                    {isBulkImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import Categories
                </Button>
            </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Existing Categories</CardTitle>
            <CardDescription>View and manage all product categories.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories?.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.label}</TableCell>
                      <TableCell>
                        <Switch
                          checked={cat.active}
                          onCheckedChange={() => toggleCategoryStatus(cat.id, cat.active)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCategory(cat.id, cat.label)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!isLoading && categories?.length === 0 && (
                <p className='text-center text-muted-foreground py-4'>No categories found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function CategoriesPage() {
    const { userRole, loading: isAuthLoading } = useAuth();
    if (isAuthLoading) {
      return (
        <DashboardLayout>
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DashboardLayout>
      );
    }
  
    if (userRole !== 'admin') {
      return <DashboardLayout><div>Unauthorized</div></DashboardLayout>;
    }
  
    return <CategoriesContent />;
}

export default withAuth(CategoriesPage, 'admin');
