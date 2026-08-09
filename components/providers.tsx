"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  console.log(
    "PRIVY APP ID:",
    appId ? "EXISTS" : "MISSING"
  );

  return (
    <PrivyProvider
      appId={appId!}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#1557E8",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}