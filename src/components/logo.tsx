import { cn } from "@/lib/utils";

const Logo = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "font-bold text-xl font-headline tracking-tight text-foreground",
      className
    )}
  >
    OffshoreBrucke
  </div>
);

export default Logo;
