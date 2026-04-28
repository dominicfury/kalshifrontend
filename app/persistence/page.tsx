import { Construction } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/section";


export default function PersistencePage() {
  return (
    <>
      <PageHeader
        eyebrow="coming soon"
        title="Edge persistence"
        description="How long edges last before fading. The 5+ minute bucket is your actionable hunting ground."
      />
      <EmptyState
        title={
          <span className="inline-flex items-center gap-2">
            <Construction className="size-4 text-amber-400" />
            Persistence histograms land in Phase 8
          </span>
        }
        description="Tracking signal lifetime requires multiple poll cycles per market — we'll add this once we have a few weeks of continuous polling data."
      />
    </>
  );
}
