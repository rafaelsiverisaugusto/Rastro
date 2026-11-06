import type { Metadata } from "next";

import { NewFarmWizard } from "@/components/farms/new-farm-wizard";
import { getCoverageOutline, type CoverageOutline } from "@/lib/coverage";

export const metadata: Metadata = { title: "Mapear nova fazenda · Rastro" };

export default async function NewFarmPage() {
  // Visual aid only: without it the page still works (the server check decides coverage).
  const coverage: CoverageOutline | null = await getCoverageOutline();
  return <NewFarmWizard coverage={coverage} />;
}
