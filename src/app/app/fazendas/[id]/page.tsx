import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FarmResult, FarmResultError, FarmResultSkeleton } from "@/components/farms/farm-result";
import { requireUser } from "@/lib/auth";
import { getFarmDetail, type FarmDetail } from "@/lib/farm-detail";

export const metadata: Metadata = { title: "Resultado da checagem · Rastro" };

export default function FarmPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<FarmResultSkeleton />}>
      <FarmLoader params={params} />
    </Suspense>
  );
}

async function FarmLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/app/fazendas/${id}`);
  let farm: FarmDetail | null;
  try {
    farm = await getFarmDetail(id);
  } catch (error) {
    console.error(error);
    return <FarmResultError />;
  }
  if (!farm) notFound();
  return <FarmResult farm={farm} />;
}
