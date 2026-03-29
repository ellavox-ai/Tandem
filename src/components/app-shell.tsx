"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { AuthProvider } from "./auth-provider";

const PUBLIC_PATHS = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AuthProvider>
      <Sidebar />
      <main className="flex-1 ml-[240px] min-h-screen">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </AuthProvider>
  );
}
