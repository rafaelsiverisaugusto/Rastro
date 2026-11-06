import { Suspense, type ReactNode } from "react";

import { AppHeaderView } from "@/components/app/app-header";
import { requireUser } from "@/lib/auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <Suspense fallback={<AppHeaderView isDemo={false} />}>
        <AppHeader />
      </Suspense>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

async function AppHeader() {
  const user = await requireUser();
  return <AppHeaderView isDemo={user.isDemo} />;
}
