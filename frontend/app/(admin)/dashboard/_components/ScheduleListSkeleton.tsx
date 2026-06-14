'use client';

/**
 * Shimmer skeleton for the ScheduleList table.
 * Renders 3 placeholder rows with pulsing bars.
 */
export default function ScheduleListSkeleton() {
    return (
        <div className="bg-surface rounded-lg shadow animate-pulse">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
                <div className="h-5 w-40 bg-border rounded" />
            </div>

            {/* Table skeleton */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-background">
                        <tr>
                            {['w-32', 'w-20', 'w-24', 'w-20', 'w-16'].map((w, i) => (
                                <th key={i} className="px-6 py-3 text-left">
                                    <div className={`h-3 ${w} bg-border rounded`} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-border">
                        {[1, 2, 3].map((row) => (
                            <tr key={row}>
                                <td className="px-6 py-4"><div className="h-4 w-48 bg-border rounded" /></td>
                                <td className="px-6 py-4"><div className="h-4 w-16 bg-border rounded" /></td>
                                <td className="px-6 py-4"><div className="h-4 w-20 bg-border rounded" /></td>
                                <td className="px-6 py-4"><div className="h-4 w-20 bg-border rounded" /></td>
                                <td className="px-6 py-4"><div className="h-4 w-12 bg-border rounded" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
