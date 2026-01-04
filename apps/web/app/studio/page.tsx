import { DashboardHeader } from "@/components/studio/dashboard-header";
import { AnalyticsSummary } from "@/components/studio/analytics-summary";
import { RecentContent } from "@/components/studio/recent-content";

export default function StudioPage() {
    return (
        <div className="p-6">
            <DashboardHeader />
            <AnalyticsSummary />
            <RecentContent />
        </div>
    );
}
