"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Search,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

import { ConnectWalletButton } from "@/components/wallet/connect-wallet";
import { QuickSendWalletButton } from "@/components/wallet/quick-send-wallet";

type Institution = {
  name: string;
  code: string;
};

type CryptoOption = {
  symbol: string;
  name: string;
};

const CRYPTO_OPTIONS: CryptoOption[] = [
  {
    symbol: "USDT",
    name: "Tether USD",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
  },
];

export default function Home() {
  const { authenticated } = usePrivy();

  const [step, setStep] = useState(1);

  const [institutions, setInstitutions] = useState<Institution[]>(
    []
  );

  const [selectedBank, setSelectedBank] =
    useState<Institution | null>(null);

  const [bankDropdownOpen, setBankDropdownOpen] =
    useState(false);

  const [bankSearch, setBankSearch] = useState("");

  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [loadingBanks, setLoadingBanks] = useState(false);
  const [verifyingAccount, setVerifyingAccount] =
    useState(false);

  const [accountError, setAccountError] = useState("");

  const [amount, setAmount] = useState("");

  // Crypto state
  const [selectedCrypto, setSelectedCrypto] =
    useState<CryptoOption | null>(null);

  const [cryptoDropdownOpen, setCryptoDropdownOpen] =
    useState(false);

  const [cryptoAmount, setCryptoAmount] = useState("");

  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const cryptoDropdownRef =
    useRef<HTMLDivElement>(null);

  /*
   * Fetch Nigerian banks once wallet is connected
   */
  useEffect(() => {
    if (!authenticated) {
      setInstitutions([]);
      setSelectedBank(null);
      setBankDropdownOpen(false);
      setAccountNumber("");
      setAccountName("");
      setAccountError("");
      setStep(1);
      return;
    }

    const fetchInstitutions = async () => {
      setLoadingBanks(true);

      try {
        const response = await fetch("/api/institutions", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || "Failed to load banks."
          );
        }

        const banks = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
          ? data
          : [];

        setInstitutions(banks);
      } catch (error) {
        console.error(
          "Failed to fetch institutions:",
          error
        );
      } finally {
        setLoadingBanks(false);
      }
    };

    fetchInstitutions();
  }, [authenticated]);

  /*
   * Close bank dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setBankDropdownOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /*
   * Close crypto dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cryptoDropdownRef.current &&
        !cryptoDropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setCryptoDropdownOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /*
   * Filter banks
   */
  const filteredInstitutions = institutions.filter(
    (bank) =>
      bank.name
        .toLowerCase()
        .includes(bankSearch.toLowerCase())
  );

  /*
   * Select bank
   */
  const handleBankSelect = (
    bank: Institution
  ) => {
    setSelectedBank(bank);
    setBankDropdownOpen(false);
    setBankSearch("");

    setAccountNumber("");
    setAccountName("");
    setAccountError("");
  };

  /*
   * Verify account with Paycrest
   */
  const verifyAccount = async (
    value: string
  ) => {
    if (
      !selectedBank ||
      value.length !== 10
    ) {
      setAccountName("");
      return;
    }

    setVerifyingAccount(true);
    setAccountName("");
    setAccountError("");

    try {
      const response = await fetch(
        "/api/verify-account",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            institution: selectedBank.code,
            accountIdentifier: value,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Unable to verify account."
        );
      }

      const verifiedName = data?.data;

      if (
        !verifiedName ||
        typeof verifiedName !== "string"
      ) {
        throw new Error(
          "Account name could not be retrieved."
        );
      }

      setAccountName(verifiedName);
    } catch (error) {
      console.error(
        "Account verification failed:",
        error
      );

      setAccountName("");

      setAccountError(
        error instanceof Error
          ? error.message
          : "Unable to verify account."
      );
    } finally {
      setVerifyingAccount(false);
    }
  };

  /*
   * Account number input
   */
  const handleAccountNumberChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 10);

    setAccountNumber(value);
    setAccountName("");
    setAccountError("");

    if (value.length === 10) {
      verifyAccount(value);
    }
  };

  /*
   * Move to Step 2
   */
  const handleNext = () => {
    if (
      !accountName ||
      !selectedBank ||
      accountNumber.length !== 10
    ) {
      return;
    }

    setStep(2);
  };

  /*
   * Select crypto
   */
  const handleCryptoSelect = (
    crypto: CryptoOption
  ) => {
    setSelectedCrypto(crypto);
    setCryptoDropdownOpen(false);

    // Clear previous quote when crypto changes
    setCryptoAmount("");
    setQuoteError("");
  };

  /*
   * Fetch Paycrest quote
   */
  useEffect(() => {
    if (!selectedCrypto || !amount) {
      setCryptoAmount("");
      setQuoteError("");
      setLoadingQuote(false);
      return;
    }

    const nairaAmount = Number(amount);

    if (
      !Number.isFinite(nairaAmount) ||
      nairaAmount <= 0
    ) {
      setCryptoAmount("");
      setQuoteError("");
      setLoadingQuote(false);
      return;
    }

    let cancelled = false;

    const getQuote = async () => {
      setLoadingQuote(true);
      setCryptoAmount("");
      setQuoteError("");

      try {
        const response = await fetch(
          "/api/quote",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: selectedCrypto.symbol,
              nairaAmount,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to get crypto quote."
          );
        }

        if (
          !data?.cryptoAmount ||
          !Number.isFinite(
            Number(data.cryptoAmount)
          )
        ) {
          throw new Error(
            "Invalid crypto amount returned."
          );
        }

        if (!cancelled) {
          setCryptoAmount(
            Number(data.cryptoAmount).toFixed(2)
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Crypto quote failed:",
            error
          );

          setCryptoAmount("");

          setQuoteError(
            error instanceof Error
              ? error.message
              : "Unable to get crypto quote."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingQuote(false);
        }
      }
    };

    const timeout = setTimeout(
      getQuote,
      500
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [amount, selectedCrypto]);

  /*
   * Amount input
   */
  const handleAmountChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value
      .replace(/[^0-9.]/g, "");

    setAmount(value);
    setCryptoAmount("");
    setQuoteError("");
  };

  const showPayButton =
    !!selectedCrypto &&
    !!amount &&
    Number(amount) > 0 &&
    !!cryptoAmount &&
    !loadingQuote &&
    !quoteError;

  return (
    <main className="relative h-screen overflow-hidden bg-[#050511] text-foreground">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-12vw] h-[55vw] w-[100vw] max-h-[500px] max-w-[900px] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(21, 87, 232, 0.16) 0%, rgba(21, 87, 232, 0.07) 28%, rgba(21, 87, 232, 0) 68%)",
          }}
        />

        <div
          className="absolute left-1/2 top-[-58vw] h-[66vw] w-[66vw] max-h-[952px] max-w-[952px] -translate-x-1/2 rounded-full"
          style={{
            border:
              "1px solid rgba(21, 87, 232, 0.16)",
          }}
        />

        <div
          className="absolute left-1/2 top-[-68vw] h-[89vw] w-[89vw] max-h-[1276px] max-w-[1276px] -translate-x-1/2 rounded-full"
          style={{
            border:
              "1px solid rgba(21, 87, 232, 0.14)",
          }}
        />

        <div
          className="absolute left-1/2 top-[-79vw] h-[110vw] w-[110vw] max-h-[1586px] max-w-[1586px] -translate-x-1/2 rounded-full"
          style={{
            border:
              "1px solid rgba(21, 87, 232, 0.12)",
          }}
        />

        <div
          className="absolute left-1/2 top-[-96vw] h-[145vw] w-[145vw] max-h-[2082px] max-w-[2082px] -translate-x-1/2 rounded-full"
          style={{
            border:
              "1px solid rgba(21, 87, 232, 0.1)",
          }}
        />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        {/* Floating Navigation */}
        <header className="mx-4 mt-4 flex shrink-0 items-center justify-between rounded-[16px] border border-[#0F0F1B] bg-[#050511] p-3 sm:mx-6 sm:mt-6">
          <Image
            src="/biyaport_logo.svg"
            alt="Biyaport"
            width={160}
            height={44}
            className="h-[36px] w-auto object-contain sm:h-[44px]"
            priority
          />

          <ConnectWalletButton />
        </header>

        {/* Main */}
        <section className="flex min-h-0 flex-1 items-center justify-center px-4">
          <div className="flex w-full max-w-[590px] flex-col items-center">
            {/* Quick Send Card */}
            <div className="w-full rounded-[16px] border border-border bg-card p-5">
              {/* Card Header */}
              <div className="mb-6 flex items-center justify-between">
                <h1 className="text-[20px] font-semibold tracking-[-0.02em] sm:text-[22px]">
                  Quick Send
                </h1>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-input sm:h-12 sm:w-12">
                  <Image
                    src="/send-money.png"
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 object-contain"
                  />
                </div>
              </div>

              {/* =========================
                  STEP 1
                  ========================= */}
              {step === 1 && (
                <>
                  {/* Bank Selector */}
                  <div
                    ref={dropdownRef}
                    className="relative"
                  >
                    <button
                      type="button"
                      disabled={
                        !authenticated ||
                        loadingBanks
                      }
                      onClick={() =>
                        setBankDropdownOpen(
                          (open) => !open
                        )
                      }
                      className="flex h-[52px] w-full items-center justify-between rounded-[10px] border border-border bg-input px-4 text-left text-[15px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-[56px] sm:px-5 sm:text-[16px]"
                    >
                      <span
                        className={
                          selectedBank
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {loadingBanks
                          ? "Loading banks..."
                          : selectedBank?.name ||
                            "Select Bank"}
                      </span>

                      {loadingBanks ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                            bankDropdownOpen
                              ? "rotate-180"
                              : ""
                          }`}
                        />
                      )}
                    </button>

                    {/* Bank Dropdown */}
                    {bankDropdownOpen &&
                      authenticated && (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[12px] border border-border bg-[#070812] shadow-2xl">
                          {/* Search */}
                          <div className="border-b border-border p-3">
                            <div className="flex h-11 items-center gap-2 rounded-[8px] border border-border bg-input px-3">
                              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />

                              <input
                                type="text"
                                value={
                                  bankSearch
                                }
                                onChange={(
                                  event
                                ) =>
                                  setBankSearch(
                                    event.target
                                      .value
                                  )
                                }
                                placeholder="Search bank"
                                autoFocus
                                className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
                              />
                            </div>
                          </div>

                          {/* Banks */}
                          <div className="max-h-[280px] overflow-y-auto p-1.5">
                            {filteredInstitutions.length >
                            0 ? (
                              filteredInstitutions.map(
                                (bank) => (
                                  <button
                                    key={
                                      bank.code
                                    }
                                    type="button"
                                    onClick={() =>
                                      handleBankSelect(
                                        bank
                                      )
                                    }
                                    className="flex w-full items-center justify-between rounded-[8px] px-3 py-3 text-left text-[14px] text-foreground transition-colors hover:bg-secondary"
                                  >
                                    <span>
                                      {
                                        bank.name
                                      }
                                    </span>

                                    {selectedBank?.code ===
                                      bank.code && (
                                      <Check className="h-4 w-4 text-primary" />
                                    )}
                                  </button>
                                )
                              )
                            ) : (
                              <div className="px-3 py-8 text-center text-[14px] text-muted-foreground">
                                No banks found.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Account Number */}
                  <div className="mt-3">
                    <input
                      id="account-number"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Enter Account number"
                      value={accountNumber}
                      onChange={
                        handleAccountNumberChange
                      }
                      disabled={!selectedBank}
                      className="h-[52px] w-full rounded-[10px] border border-border bg-input px-4 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 sm:h-[56px] sm:px-5 sm:text-[16px]"
                    />

                    {/* Verifying */}
                    {verifyingAccount && (
                      <div className="mt-2 flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>
                          Verifying account...
                        </span>
                      </div>
                    )}

                    {/* Account Name */}
                    {accountName &&
                      !verifyingAccount && (
                        <div className="mt-2 px-1 text-[14px] text-muted-foreground">
                          {accountName}
                        </div>
                      )}

                    {/* Error */}
                    {accountError &&
                      !verifyingAccount && (
                        <div className="mt-2 px-1 text-[13px] text-destructive">
                          {accountError}
                        </div>
                      )}
                  </div>

                  {/* Quick Send Wallet */}
                  <QuickSendWalletButton />

                  {/* Next */}
                  {accountName &&
                    !verifyingAccount && (
                      <button
                        type="button"
                        onClick={handleNext}
                        className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary px-5 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:h-[56px] sm:text-[16px]"
                      >
                        Next
                      </button>
                    )}
                </>
              )}

              {/* =========================
                  STEP 2
                  ========================= */}
              {step === 2 && (
                <>
                  {/* Recipient Summary */}
                  <div className="rounded-[10px] bg-input px-5 py-4">
                    <div className="space-y-2 text-[15px] leading-[22px]">
                      <p>
                        Name:{" "}
                        <span className="font-semibold text-foreground">
                          {accountName}
                        </span>
                      </p>

                      <p>
                        Account no:{" "}
                        <span className="font-semibold text-foreground">
                          {accountNumber}
                        </span>
                      </p>

                      <p>
                        Bank Name:{" "}
                        <span className="font-semibold text-foreground">
                          {selectedBank?.name}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Crypto Selector */}
                  <div
                    ref={cryptoDropdownRef}
                    className="relative mt-5"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCryptoDropdownOpen(
                          (open) => !open
                        )
                      }
                      className="flex h-[52px] w-full items-center justify-between rounded-[10px] border border-border bg-input px-4 text-left text-[15px] sm:h-[56px] sm:px-5 sm:text-[16px]"
                    >
                      <span
                        className={
                          selectedCrypto
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {selectedCrypto
                          ? `${selectedCrypto.symbol} · ${selectedCrypto.name}`
                          : "Select Crypto to pay"}
                      </span>

                      <ChevronDown
                        className={`h-5 w-5 text-muted-foreground transition-transform ${
                          cryptoDropdownOpen
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </button>

                    {/* Crypto Dropdown */}
                    {cryptoDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[12px] border border-border bg-[#070812] shadow-2xl">
                        <div className="p-1.5">
                          {CRYPTO_OPTIONS.map(
                            (crypto) => (
                              <button
                                key={
                                  crypto.symbol
                                }
                                type="button"
                                onClick={() =>
                                  handleCryptoSelect(
                                    crypto
                                  )
                                }
                                className="flex w-full items-center justify-between rounded-[8px] px-3 py-3 text-left text-[14px] text-foreground transition-colors hover:bg-secondary"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {crypto.symbol}
                                  </span>
                                  <span className="text-[12px] text-muted-foreground">
                                    {crypto.name}
                                  </span>
                                </div>

                                {selectedCrypto?.symbol ===
                                  crypto.symbol && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="mt-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="Enter Amount (₦)"
                      value={amount}
                      onChange={
                        handleAmountChange
                      }
                      className="h-[52px] w-full rounded-[10px] border border-border bg-input px-4 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary sm:h-[56px] sm:px-5 sm:text-[16px]"
                    />

                    {/* Quote loading */}
                    {loadingQuote && (
                      <div className="mt-2 flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>
                          Calculating crypto amount...
                        </span>
                      </div>
                    )}

                    {/* Quote error */}
                    {quoteError &&
                      !loadingQuote && (
                        <div className="mt-2 px-1 text-[13px] text-destructive">
                          {quoteError}
                        </div>
                      )}
                  </div>

                  {/* Pay Now */}
                  {showPayButton && (
                    <button
                      type="button"
                      className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary px-5 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:h-[56px] sm:text-[16px]"
                    >
                      Pay {cryptoAmount}{" "}
                      {selectedCrypto?.symbol}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Tagline */}
            <p className="mt-6 w-full max-w-[590px] px-2 text-center text-[14px] leading-[20px] text-muted-foreground sm:mt-8 sm:px-0 sm:text-[16px] sm:leading-[22px]">
              The fastest way to send crypto to
              Nigerian bank accounts. No wallet needed
              for recipients.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}