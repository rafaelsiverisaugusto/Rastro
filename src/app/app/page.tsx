import type { Metadata } from "next";
import { Suspense } from "react";

import { FarmList, FarmListError, FarmListSkeleton } from "@/components/app/farm-list";
import { requireUser } from "@/lib/auth";
import { listMyFarms, type FarmSummary } from "@/lib/farms";

export const metadata: Metadata = { title: "Minhas fazendas · Rastro" };

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
      <Suspense fallback={<FarmListSkeleton />}>
        <Farms />
      </Suspense>
    </main>
  );
}

async function Farms() {
  const user = await requireUser("/app");
  let farms: FarmSummary[];
  try {
    farms = await listMyFarms();
  } catch (error) {
    console.error(error);
    return <FarmListError />;
  }
  return <FarmList farms={farms} isDemo={user.isDemo} />;
}
