import type { ReactNode } from "react";
import Logo from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <Logo className="text-3xl" />
      </div>
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}
