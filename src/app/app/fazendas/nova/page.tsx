import type { Metadata } from "next";

import { NewFarmWizard } from "@/components/farms/new-farm-wizard";
import { getCoverageOutline, type CoverageOutline } from "@/lib/coverage";

export const metadata: Metadata = { title: "Mapear nova fazenda · Rastro" };

export default async function NewFarmPage() {
  let coverage: CoverageOutline | null = null;
  try {
    coverage = await getCoverageOutline();
  } catch (error) {
    // Without the outline the page still works; the server check decides coverage.
    console.error(error);
  }
  return <NewFarmWizard coverage={coverage} />;
}
