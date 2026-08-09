"use client";

import { usePrivy } from "@privy-io/react-auth";

export function QuickSendWalletButton() {
  const { ready, authenticated, login } = usePrivy();

  if (authenticated) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={login}
      disabled={!ready}
      className="mt-5 h-[52px] w-full rounded-[10px] bg-primary px-4 text-[16px] font-medium text-white transition-colors hover:bg-[#2468f5] disabled:cursor-wait disabled:opacity-50 sm:mt-6 sm:h-[56px]"
    >
      Connect wallet
    </button>
  );
}