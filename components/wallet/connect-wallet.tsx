"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";

export function ConnectWalletButton() {
  const {
    ready,
    authenticated,
    login,
    logout,
  } = usePrivy();

  const { wallets } = useWallets();

  const wallet = wallets[0];

  if (!ready) {
    return (
      <button
        type="button"
        disabled
        className="rounded-[10px] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground opacity-70"
      >
        Connect Wallet
      </button>
    );
  }

  if (authenticated && wallet) {
    return (
      <button
        type="button"
        onClick={logout}
        className="rounded-[10px] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {`${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={login}
      className="rounded-[10px] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
    >
      Connect Wallet
    </button>
  );
}