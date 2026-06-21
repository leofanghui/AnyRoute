"use client";

import { Suspense } from "react";
import { UsageAnalytics, CardSkeleton } from "@/shared/components";
import DiversityScoreCard from "./components/DiversityScoreCard";

function AnalyticsPageContent() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<CardSkeleton />}>
        <UsageAnalytics />
        <DiversityScoreCard />
      </Suspense>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <AnalyticsPageContent />
    </Suspense>
  );
}
