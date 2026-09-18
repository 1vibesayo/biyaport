"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

type ConnectWalletButtonProps = {
  onDisconnect?: () => void;
};

export function ConnectWalletButton({
  onDisconnect,
}: ConnectWalletButtonProps) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [loginPending, setLoginPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const handleLogin = async () => {
    if (!ready || loginPending) return;

    setLoginPending(true);
    try {
      await login();
    } catch (error) {
      console.error("PRIVY LOGIN ERROR:", error);
    } finally {
      setLoginPending(false);
    }
  };

  const handleDisconnect = async () => {
    if (logoutPending) return;

    onDisconnect?.();
    setLogoutPending(true);
    try {
      await logout();
    } catch (error) {
      console.error("PRIVY LOGOUT ERROR:", error);
    } finally {
      setLogoutPending(false);
    }
  };

  if (!ready) {
    return (
      <button
        type="button"
        disabled
        className="touch-manipulation rounded-[10px] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground opacity-70"
      >
        Connect Wallet
      </button>
    );
  }

  if (authenticated && wallet) {
    return (
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={logoutPending}
        className="touch-manipulation rounded-[10px] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {logoutPending ? "Disconnecting" : "Disconnect"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={loginPending}
      aria-busy={loginPending}
      className="touch-manipulation select-none rounded-[10px] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loginPending ? "Opening wallet" : "Connect Wallet"}
    </button>
  );
}
