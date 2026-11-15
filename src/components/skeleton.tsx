import { cn } from "@/lib/cn";

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-card bg-charcoal", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <SkeletonBlock className="h-4 w-40 rounded-full" />
      <SkeletonBlock className="h-11 w-64 rounded-xl" />
      <SkeletonBlock className="h-56 rounded-hero" />
      <SkeletonBlock className="h-36 rounded-hero" />
    </div>
  );
}
