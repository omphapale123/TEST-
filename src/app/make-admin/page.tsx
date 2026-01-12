'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
} from 'firebase/firestore';

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import AuthLayout from '@/components/auth-layout';
import { withAuth } from '@/components/with-auth';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

function MakeAdminPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const db = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!db) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore not initialized.',
      });
      setIsLoading(false);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', values.email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'User not found',
          description: `No user found with email: ${values.email}`,
        });
        setIsLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;

      // Set custom claim first
      const roleResponse = await fetch('/api/set-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: userId, role: 'admin' }),
      });

      if (!roleResponse.ok) {
        const errorData = await roleResponse.json();
        throw new Error(errorData.error || 'Failed to set admin role on the server.');
      }
      
      // Then update the Firestore document
      const userDocRef = doc(db, 'users', userId);
      await writeBatch(db).update(userDocRef, { role: 'admin' }).commit();

      toast({
        title: 'Success',
        description: `${values.email} has been made an admin.`,
      });
      form.reset();
    } catch (error: any) {
       console.error("Error making admin:", error);
       toast({
          variant: 'destructive',
          title: 'Operation Failed',
          description: error.message || 'An unexpected error occurred.'
       });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>Make Admin</CardTitle>
          <CardDescription>
            Enter the email of the user you want to grant admin privileges to.
            This user must exist.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Email</FormLabel>
                    <FormControl>
                      <Input placeholder="user@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardContent>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Grant Admin Rights
              </Button>
            </CardContent>
          </form>
        </Form>
      </Card>
    </AuthLayout>
  );
}

export default withAuth(MakeAdminPage, 'admin');
