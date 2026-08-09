"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

export function ConnectWalletButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const wallet = wallets[0];

  const [diagnostic, setDiagnostic] = useState("");

  const handleClick = async () => {
    setDiagnostic("1. Button clicked");

    try {
      setDiagnostic(
        `2. Privy ready: ${ready ? "YES" : "NO"}`
      );

      if (authenticated && wallet) {
        setDiagnostic("3. Logging out...");
        await logout();
        setDiagnostic("4. Logout completed");
        return;
      }

      setDiagnostic("3. Calling Privy login...");

      await login();

      setDiagnostic("4. Privy login completed");
    } catch (error) {
      console.error(error);

      setDiagnostic(
        `ERROR: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        className="flex h-11 min-w-[130px] items-center justify-center rounded-[10px] bg-[#1557E8] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
      >
        {authenticated && wallet
          ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
          : "Connect Wallet"}
      </button>

      {/* TEMPORARY MOBILE DEBUG */}
      <div className="max-w-[220px] rounded-lg border border-yellow-500/30 bg-black/80 px-3 py-2 text-[11px] leading-4 text-yellow-300">
        <div>
          Ready: {ready ? "YES" : "NO"}
        </div>

        <div>
          Authenticated:{" "}
          {authenticated ? "YES" : "NO"}
        </div>

        {diagnostic && (
          <div className="mt-1 border-t border-white/10 pt-1">
            {diagnostic}
          </div>
        )}
      </div>
    </div>
  );
}