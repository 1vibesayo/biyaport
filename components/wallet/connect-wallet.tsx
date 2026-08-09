"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";

export function ConnectWalletButton() {
  const { authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const wallet = wallets[0];

  const handleClick = async () => {
    if (authenticated && wallet) {
      await logout();
      return;
    }

    await login();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex h-11 min-w-[130px] items-center justify-center rounded-[10px] bg-[#1557E8] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
    >
      {authenticated && wallet
        ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
        : "Connect Wallet"}
    </button>
  );
