'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import Image from 'next/image';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen w-full">
      <div
        className="flex-1 bg-background text-white flex flex-col justify-between p-12 relative"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)',
          backgroundSize: '2rem 2rem',
        }}
      >
        <div className="absolute top-8 left-8">
          <Logo className="text-white text-2xl" />
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-6xl font-bold leading-tight">OffshoreBrucke</h1>
          <p className="text-xl text-muted-foreground mt-4 max-w-md">
            We make global expansion more reliable, accessible and profitable.
          </p>
          <div className="mt-8 flex gap-4">
            <Button asChild size="lg">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="flex-1 bg-black hidden lg:flex items-center justify-center relative overflow-hidden">
        <Image
            src="https://storage.googleapis.com/firebase-studio-app-bucket/project-specific-assets/offshore-bridge/containers-dark.png"
            alt="Bridge Illustration"
            width={800}
            height={600}
            className="object-contain"
        />
      </div>
    </div>
  );
}
