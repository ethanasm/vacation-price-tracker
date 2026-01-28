import { Skeleton } from "@/components/ui/skeleton";

export default function EditTripLoading() {
  return (
    <div className="w-full max-w-[800px] mx-auto px-4 pb-12 flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </div>
      </div>

      {/* Form sections skeleton */}
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border p-6 space-y-4">
          <Skeleton className="h-5 w-28" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div className="rounded-lg border p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="flex justify-end gap-3">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}
