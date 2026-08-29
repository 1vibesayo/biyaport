"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";

export function ConnectWalletButton() {
  const {
    ready,
    authenticated,
    login,
    logout,
  } = usePrivy();

  const { wallets } = useWallets();

  const wallet = wallets[0];

  const [
    dropdownOpen,
    setDropdownOpen,
  ] = useState(false);

  const dropdownRef =
    useRef<HTMLDivElement | null>(null);

  /*
   * ====================================================
   * CLOSE DROPDOWN WHEN CLICKING OUTSIDE
   * ====================================================
   */

  useEffect(() => {
    const handleClick = (
      event: MouseEvent
    ) => {
      const target =
        event.target as Node;

      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          target
        )
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClick
      );
    };
  }, []);

  /*
   * ====================================================
   * CLOSE DROPDOWN WHEN DISCONNECTED
   * ====================================================
   */

  useEffect(() => {
    if (!authenticated || !wallet) {
      setDropdownOpen(false);
    }
  }, [
    authenticated,
    wallet,
  ]);

  /*
   * ====================================================
   * LOADING
   * ====================================================
   */

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

  /*
   * ====================================================
   * CONNECTED
   * ====================================================
   */

  if (authenticated && wallet) {
    return (
      <div
        ref={dropdownRef}
        className="relative"
      >
        <button
          type="button"
          onClick={() =>
            setDropdownOpen(
              (open) => !open
            )
          }
          className="rounded-[10px] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {`${wallet.address.slice(
            0,
            6
          )}...${wallet.address.slice(-4)}`}
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-[calc(100%+8px)] z-[200] w-[180px] overflow-hidden rounded-[12px] border border-[#1a1a28] bg-[#070812] p-1.5 shadow-2xl">

            <button
              type="button"
              onClick={async () => {
                setDropdownOpen(false);

                try {
                  await logout();
                } catch (error) {
                  console.error(
                    "WALLET LOGOUT ERROR:",
                    error
                  );
                }
              }}
              className="flex w-full items-center rounded-[8px] px-3 py-2.5 text-left text-[14px] text-foreground transition hover:bg-secondary"
            >
              Disconnect
            </button>

          </div>
        )}
      </div>
    );
  }

  /*
   * ====================================================
   * DISCONNECTED
   * ====================================================
   */

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