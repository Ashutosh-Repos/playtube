import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-[100px]" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: columns }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-12 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function VideosTableSkeleton() {
    return (
        <div className="py-4 space-y-4">
             {/* Toolbar Skeleton */}
            <div className="flex items-center justify-between">
                 <Skeleton className="h-10 w-[250px]" />
                 <Skeleton className="h-10 w-[100px]" />
            </div>
            <TableSkeleton rows={5} columns={6} />
        </div>
    )
}

export function PlaylistsTableSkeleton() {
    return (
        <div className="py-4 space-y-4">
            <TableSkeleton rows={5} columns={4} />
        </div>
    )
}
