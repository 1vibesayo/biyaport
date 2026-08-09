"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Search,
} from "lucide-react";
import {
  usePrivy,
  useSendTransaction,
  useWallets,
} from "@privy-io/react-auth";
import {
  encodeFunctionData,
  erc20Abi,
  parseUnits,
} from "viem";

import { ConnectWalletButton } from "@/components/wallet/connect-wallet";
import { QuickSendWalletButton } from "@/components/wallet/quick-send-wallet";

/* =========================================================
   BASE / USDT
========================================================= */

const BASE_CHAIN_ID = 8453;

const BASE_USDT_ADDRESS =
  "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as `0x${string}`;

const USDT_DECIMALS = 6;

/* =========================================================
   TYPES
========================================================= */

type Institution = {
  name: string;
  code: string;
};

type CryptoOption = {
  symbol: string;
  name: string;
  network: string;
};

type TransactionResult = {
  success?: boolean;
  orderId?: string;
  status?: string;
  amount?: string | number;
  senderFee?: string | number;
  transactionFee?: string | number;
  receiveAddress?: string;
  validUntil?: string;
  providerNetwork?: string;
  crypto?: string;
  network?: string;
  transactionHash?: string;
  paymentStatus?: string;
};

/* =========================================================
   CRYPTO OPTIONS
========================================================= */

const CRYPTO_OPTIONS: CryptoOption[] = [
  {
    symbol: "USDT",
    name: "Tether USD",
    network: "base",
  },
];

/* =========================================================
   PAGE
========================================================= */

export default function Home() {
  const { authenticated } = usePrivy();

  const { wallets } = useWallets();

  const { sendTransaction } =
    useSendTransaction();

  const wallet = wallets[0];

  /* =======================================================
     GENERAL
  ======================================================= */

  const [step, setStep] = useState(1);

  /* =======================================================
     BANK
  ======================================================= */

  const [institutions, setInstitutions] =
    useState<Institution[]>([]);

  const [selectedBank, setSelectedBank] =
    useState<Institution | null>(null);

  const [bankDropdownOpen, setBankDropdownOpen] =
    useState(false);

  const [bankSearch, setBankSearch] =
    useState("");

  const [loadingBanks, setLoadingBanks] =
    useState(false);

  /* =======================================================
     ACCOUNT
  ======================================================= */

  const [accountNumber, setAccountNumber] =
    useState("");

  const [accountName, setAccountName] =
    useState("");

  const [verifyingAccount, setVerifyingAccount] =
    useState(false);

  const [accountError, setAccountError] =
    useState("");

  /* =======================================================
     PAYMENT
  ======================================================= */

  const [amount, setAmount] =
    useState("");

  const [selectedCrypto, setSelectedCrypto] =
    useState<CryptoOption | null>(null);

  const [cryptoDropdownOpen, setCryptoDropdownOpen] =
    useState(false);

  const [cryptoAmount, setCryptoAmount] =
    useState("");

  const [loadingQuote, setLoadingQuote] =
    useState(false);

  const [quoteError, setQuoteError] =
    useState("");

  /* =======================================================
     TRANSACTION
  ======================================================= */

  const [creatingTransaction, setCreatingTransaction] =
    useState(false);

  const [transactionError, setTransactionError] =
    useState("");

  const [transaction, setTransaction] =
    useState<TransactionResult | null>(null);

  /* =======================================================
     REFS
  ======================================================= */

  const bankDropdownRef =
    useRef<HTMLDivElement>(null);

  const cryptoDropdownRef =
    useRef<HTMLDivElement>(null);

  /* =======================================================
     LOAD BANKS
  ======================================================= */

  useEffect(() => {
    if (!authenticated) {
      setInstitutions([]);
      return;
    }

    const fetchBanks = async () => {
      setLoadingBanks(true);

      try {
        const response = await fetch(
          "/api/institutions",
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        console.log(
          "BANK RESPONSE:",
          data
        );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              "Failed to load banks."
          );
        }

        const banks =
          Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data)
            ? data
            : [];

        setInstitutions(banks);
      } catch (error) {
        console.error(
          "BANK FETCH ERROR:",
          error
        );
      } finally {
        setLoadingBanks(false);
      }
    };

    fetchBanks();
  }, [authenticated]);

  /* =======================================================
     CLOSE BANK DROPDOWN
  ======================================================= */

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        bankDropdownRef.current &&
        !bankDropdownRef.current.contains(
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

  /* =======================================================
     CLOSE CRYPTO DROPDOWN
  ======================================================= */

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
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

  /* =======================================================
     BANK SEARCH
  ======================================================= */

  const filteredInstitutions =
    institutions.filter((bank) =>
      bank.name
        .toLowerCase()
        .includes(
          bankSearch.toLowerCase()
        )
    );

  /* =======================================================
     SELECT BANK
  ======================================================= */

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

  /* =======================================================
     VERIFY ACCOUNT
  ======================================================= */

  const verifyAccount = async (
    value: string
  ) => {
    if (
      !selectedBank ||
      value.length !== 10
    ) {
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
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            institution:
              selectedBank.code,
            accountIdentifier:
              value,
          }),
        }
      );

      const data =
        await response.json();

      console.log(
        "VERIFY ACCOUNT RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Unable to verify account."
        );
      }

      const verifiedName =
        data?.data;

      if (
        !verifiedName ||
        typeof verifiedName !==
          "string"
      ) {
        throw new Error(
          "Account name could not be retrieved."
        );
      }

      setAccountName(
        verifiedName
      );
    } catch (error) {
      console.error(
        "ACCOUNT VERIFICATION ERROR:",
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

  /* =======================================================
     ACCOUNT NUMBER
  ======================================================= */

  const handleAccountNumberChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value =
      event.target.value
        .replace(/\D/g, "")
        .slice(0, 10);

    setAccountNumber(value);
    setAccountName("");
    setAccountError("");

    if (value.length === 10) {
      verifyAccount(value);
    }
  };

  /* =======================================================
     NEXT
  ======================================================= */

  const handleNext = () => {
    if (
      !selectedBank ||
      accountNumber.length !== 10 ||
      !accountName
    ) {
      return;
    }

    setStep(2);
  };

  /* =======================================================
     SELECT CRYPTO
  ======================================================= */

  const handleCryptoSelect = (
    crypto: CryptoOption
  ) => {
    setSelectedCrypto(crypto);
    setCryptoDropdownOpen(false);

    setCryptoAmount("");
    setQuoteError("");
    setTransaction(null);
    setTransactionError("");
  };

  /* =======================================================
     AMOUNT
  ======================================================= */

  const handleAmountChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value =
      event.target.value.replace(
        /[^0-9.]/g,
        ""
      );

    setAmount(value);
    setCryptoAmount("");
    setQuoteError("");
    setTransaction(null);
    setTransactionError("");
  };

  /* =======================================================
     QUOTE
  ======================================================= */

  useEffect(() => {
    if (
      !selectedCrypto ||
      !amount ||
      Number(amount) <= 0
    ) {
      setCryptoAmount("");
      return;
    }

    let cancelled = false;

    const getQuote = async () => {
      setLoadingQuote(true);
      setQuoteError("");
      setCryptoAmount("");

      try {
        const response = await fetch(
          "/api/quote",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              token:
                selectedCrypto.symbol,
              nairaAmount:
                Number(amount),
            }),
          }
        );

        const data =
          await response.json();

        console.log(
          "QUOTE RESPONSE:",
          data
        );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              "Unable to get crypto quote."
          );
        }

        const value =
          Number(
            data?.cryptoAmount
          );

        if (
          !Number.isFinite(value) ||
          value <= 0
        ) {
          throw new Error(
            "Invalid crypto amount returned."
          );
        }

        if (!cancelled) {
          setCryptoAmount(
            value.toFixed(6)
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "QUOTE ERROR:",
            error
          );

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

    const timeout =
      setTimeout(
        getQuote,
        500
      );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    amount,
    selectedCrypto,
  ]);

  /* =======================================================
     CREATE PAYCREST ORDER + SEND USDT
  ======================================================= */

  const handleCreateTransaction =
    async () => {
      console.log(
        "========== PAY BUTTON CLICKED =========="
      );

      if (!wallet?.address) {
        setTransactionError(
          "Please connect your wallet first."
        );
        return;
      }

      if (
        !selectedCrypto ||
        selectedCrypto.symbol !==
          "USDT"
      ) {
        setTransactionError(
          "Please select USDT."
        );
        return;
      }

      if (
        selectedCrypto.network !==
        "base"
      ) {
        setTransactionError(
          "USDT payments currently use Base."
        );
        return;
      }

      if (
        !selectedBank ||
        !accountName ||
        !accountNumber ||
        !cryptoAmount
      ) {
        setTransactionError(
          "Some payment information is missing."
        );
        return;
      }

      setCreatingTransaction(true);
      setTransactionError("");
      setTransaction(null);

      try {
        /* -----------------------------------------------
           1. CREATE PAYCREST ORDER
        ------------------------------------------------ */

        const response =
          await fetch(
            "/api/transaction",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                amount:
                  cryptoAmount,

                crypto:
                  selectedCrypto.symbol,

                network:
                  selectedCrypto.network,

                walletAddress:
                  wallet.address,

                institution:
                  selectedBank.code,

                accountNumber,

                accountName,

                reference:
                  `biyaport-${Date.now()}`,
              }),
            }
          );

        const data =
          await response.json();

        console.log(
          "TRANSACTION API RESPONSE:",
          data
        );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to create Paycrest order."
          );
        }

        /* -----------------------------------------------
           2. RECEIVE ADDRESS
        ------------------------------------------------ */

        const receiveAddress =
          data?.receiveAddress ||
          data?.providerAccount
            ?.receiveAddress;

        if (!receiveAddress) {
          throw new Error(
            "Paycrest did not return a receive address."
          );
        }

        /* -----------------------------------------------
           3. NETWORK
        ------------------------------------------------ */

        const providerNetwork =
          String(
            data?.providerNetwork ||
              data?.providerAccount
                ?.network ||
              selectedCrypto.network
          ).toLowerCase();

        if (
          providerNetwork !==
          "base"
        ) {
          throw new Error(
            `Paycrest returned an unexpected network: ${providerNetwork}`
          );
        }

        /* -----------------------------------------------
           4. PAYCREST TOTAL
           
           Paycrest order payment:
           amount + senderFee + transactionFee
        ------------------------------------------------ */

        const orderAmount =
          String(
            data?.amount ??
              cryptoAmount
          );

        const senderFee =
          String(
            data?.senderFee ??
              "0"
          );

        const transactionFee =
          String(
            data?.transactionFee ??
              "0"
          );

        const amountUnits =
          parseUnits(
            orderAmount,
            USDT_DECIMALS
          );

        const senderFeeUnits =
          parseUnits(
            senderFee,
            USDT_DECIMALS
          );

        const transactionFeeUnits =
          parseUnits(
            transactionFee,
            USDT_DECIMALS
          );

        const totalUnits =
          amountUnits +
          senderFeeUnits +
          transactionFeeUnits;

        console.log(
          "ORDER AMOUNT:",
          orderAmount
        );

        console.log(
          "SENDER FEE:",
          senderFee
        );

        console.log(
          "TRANSACTION FEE:",
          transactionFee
        );

        console.log(
          "TOTAL USDT:",
          totalUnits.toString()
        );

        /* -----------------------------------------------
           5. SWITCH WALLET TO BASE
        ------------------------------------------------ */

        if (
          wallet.switchChain
        ) {
          await wallet.switchChain(
            BASE_CHAIN_ID
          );
        }

        /* -----------------------------------------------
           6. ENCODE USDT TRANSFER
        ------------------------------------------------ */

        const transferData =
          encodeFunctionData({
            abi: erc20Abi,

            functionName:
              "transfer",

            args: [
              receiveAddress as `0x${string}`,
              totalUnits,
            ],
          });

        console.log(
          "USDT CONTRACT:",
          BASE_USDT_ADDRESS
        );

        console.log(
          "PAYCREST ADDRESS:",
          receiveAddress
        );

        /* -----------------------------------------------
           7. PRIVY WALLET POPUP
        ------------------------------------------------ */

        console.log(
          "OPENING PRIVY WALLET..."
        );

        const result =
          await sendTransaction(
            {
              to: BASE_USDT_ADDRESS,

              data: transferData,

              value: 0n,

              chainId:
                BASE_CHAIN_ID,
            },
            {
              address:
                wallet.address,
            }
          );

        console.log(
          "TRANSACTION HASH:",
          result.hash
        );

        /* -----------------------------------------------
           8. SUCCESS
        ------------------------------------------------ */

        setTransaction({
          ...data,

          transactionHash:
            result.hash,

          paymentStatus:
            "submitted",
        });
      } catch (error) {
        console.error(
          "PAYMENT ERROR:",
          error
        );

        setTransactionError(
          error instanceof Error
            ? error.message
            : "Payment failed. Please try again."
        );
      } finally {
        setCreatingTransaction(
          false
        );
      }
    };

  /* =======================================================
     PAY BUTTON
  ======================================================= */

  const showPayButton =
    !!selectedCrypto &&
    !!amount &&
    Number(amount) > 0 &&
    !!cryptoAmount &&
    !loadingQuote &&
    !quoteError;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="relative h-screen overflow-hidden bg-[#050511] text-foreground">

      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        <div
          className="absolute left-1/2 top-[-12vw] h-[55vw] w-[100vw] max-h-[500px] max-w-[900px] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(21,87,232,.16) 0%, rgba(21,87,232,.07) 28%, rgba(21,87,232,0) 68%)",
          }}
        />

        <div
          className="absolute left-1/2 top-[-58vw] h-[66vw] w-[66vw] max-h-[952px] max-w-[952px] -translate-x-1/2 rounded-full"
          style={{
            border:
              "1px solid rgba(21,87,232,.16)",
          }}
        />

        <div
          className="absolute left-1/2 top-[-68vw] h-[89vw] w-[89vw] max-h-[1276px] max-w-[1276px] -translate-x-1/2 rounded-full"
          style={{
            border:
              "1px solid rgba(21,87,232,.14)",
          }}
        />

      </div>

      <div className="relative z-10 flex h-full flex-col">

        {/* HEADER */}

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

        {/* CONTENT */}

        <section className="flex min-h-0 flex-1 items-center justify-center px-4">

          <div className="flex w-full max-w-[590px] flex-col items-center">

            <div className="w-full rounded-[16px] border border-border bg-card p-5">

              {/* TITLE */}

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

              {/* STEP 1 */}

              {step === 1 && (
                <>

                  {/* BANK */}

                  <div
                    ref={
                      bankDropdownRef
                    }
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
                          (open) =>
                            !open
                        )
                      }
                      className="flex h-[52px] w-full items-center justify-between rounded-[10px] border border-border bg-input px-4 text-left text-[15px] disabled:cursor-not-allowed disabled:opacity-50 sm:h-[56px] sm:px-5 sm:text-[16px]"
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
                          className={`h-5 w-5 text-muted-foreground transition-transform ${
                            bankDropdownOpen
                              ? "rotate-180"
                              : ""
                          }`}
                        />
                      )}

                    </button>

                    {bankDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[12px] border border-border bg-[#070812] shadow-2xl">

                        <div className="border-b border-border p-3">

                          <div className="flex h-11 items-center gap-2 rounded-[8px] border border-border bg-input px-3">

                            <Search className="h-4 w-4 text-muted-foreground" />

                            <input
                              type="text"
                              value={
                                bankSearch
                              }
                              onChange={(
                                event
                              ) =>
                                setBankSearch(
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder="Search bank"
                              className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
                            />

                          </div>

                        </div>

                        <div className="max-h-[280px] overflow-y-auto p-1.5">

                          {filteredInstitutions.length >
                          0 ? (
                            filteredInstitutions.map(
                              (
                                bank
                              ) => (

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
                                  className="flex w-full items-center justify-between rounded-[8px] px-3 py-3 text-left text-[14px] hover:bg-secondary"
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

                  {/* ACCOUNT NUMBER */}

                  <div className="mt-3">

                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter Account number"
                      value={
                        accountNumber
                      }
                      onChange={
                        handleAccountNumberChange
                      }
                      disabled={
                        !selectedBank
                      }
                      className="h-[52px] w-full rounded-[10px] border border-border bg-input px-4 text-[15px] outline-none placeholder:text-muted-foreground disabled:opacity-50 sm:h-[56px] sm:px-5 sm:text-[16px]"
                    />

                    {verifyingAccount && (
                      <div className="mt-2 flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Verifying account...
                      </div>
                    )}

                    {accountName &&
                      !verifyingAccount && (
                        <div className="mt-2 px-1 text-[14px] text-muted-foreground">
                          {
                            accountName
                          }
                        </div>
                      )}

                    {accountError && (
                      <div className="mt-2 px-1 text-[13px] text-destructive">
                        {
                          accountError
                        }
                      </div>
                    )}

                  </div>

                  <QuickSendWalletButton />

                  {accountName &&
                    !verifyingAccount && (
                      <button
                        type="button"
                        onClick={
                          handleNext
                        }
                        className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary text-[15px] font-medium text-primary-foreground hover:opacity-90 sm:h-[56px] sm:text-[16px]"
                      >
                        Next
                      </button>
                    )}

                </>
              )}

              {/* STEP 2 */}

              {step === 2 && (
                <>

                  {/* RECIPIENT */}

                  <div className="rounded-[10px] bg-input px-5 py-4">

                    <div className="space-y-2 text-[15px] leading-[22px]">

                      <p>
                        Name:{" "}
                        <span className="font-semibold">
                          {
                            accountName
                          }
                        </span>
                      </p>

                      <p>
                        Account no:{" "}
                        <span className="font-semibold">
                          {
                            accountNumber
                          }
                        </span>
                      </p>

                      <p>
                        Bank Name:{" "}
                        <span className="font-semibold">
                          {
                            selectedBank?.name
                          }
                        </span>
                      </p>

                    </div>

                  </div>

                  {/* CRYPTO */}

                  <div
                    ref={
                      cryptoDropdownRef
                    }
                    className="relative mt-5"
                  >

                    <button
                      type="button"
                      onClick={() =>
                        setCryptoDropdownOpen(
                          (open) =>
                            !open
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

                    {cryptoDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[12px] border border-border bg-[#070812] shadow-2xl">

                        <div className="p-1.5">

                          {CRYPTO_OPTIONS.map(
                            (
                              crypto
                            ) => (

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
                                className="flex w-full items-center justify-between rounded-[8px] px-3 py-3 text-left text-[14px] hover:bg-secondary"
                              >

                                <div>

                                  <div className="font-medium">
                                    {
                                      crypto.symbol
                                    }
                                  </div>

                                  <div className="text-[12px] text-muted-foreground">
                                    {
                                      crypto.name
                                    }
                                  </div>

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

                  {/* NAIRA */}

                  <div className="mt-3">

                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Enter Amount (₦)"
                      value={amount}
                      onChange={
                        handleAmountChange
                      }
                      className="h-[52px] w-full rounded-[10px] border border-border bg-input px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-primary sm:h-[56px] sm:px-5 sm:text-[16px]"
                    />

                    {loadingQuote && (
                      <div className="mt-2 flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Calculating crypto amount...
                      </div>
                    )}

                    {quoteError && (
                      <div className="mt-2 px-1 text-[13px] text-destructive">
                        {
                          quoteError
                        }
                      </div>
                    )}

                  </div>

                  {/* PAY */}

                  {showPayButton && (
                    <button
                      type="button"
                      disabled={
                        creatingTransaction
                      }
                      onClick={
                        handleCreateTransaction
                      }
                      className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary px-5 text-[15px] font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:h-[56px] sm:text-[16px]"
                    >

                      {creatingTransaction ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Preparing payment...
                        </>
                      ) : (
                        `Pay ${cryptoAmount} ${selectedCrypto?.symbol}`
                      )}

                    </button>
                  )}

                  {/* ERROR */}

                  {transactionError && (
                    <div className="mt-3 rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                      {
                        transactionError
                      }
                    </div>
                  )}

                  {/* SUCCESS */}

                  {transaction?.transactionHash && (
                    <div className="mt-4 rounded-[10px] border border-border bg-input p-4">

                      <div className="flex items-center gap-2">

                        <Check className="h-4 w-4 text-primary" />

                        <p className="font-medium">
                          Payment submitted
                        </p>

                      </div>

                      <p className="mt-3 text-[12px] text-muted-foreground">
                        Transaction hash
                      </p>

                      <p className="mt-1 break-all text-[12px]">
                        {
                          transaction.transactionHash
                        }
                      </p>

                      <p className="mt-3 text-[12px] text-muted-foreground">
                        Paycrest order
                      </p>

                      <p className="mt-1 break-all text-[12px]">
                        {
                          transaction.orderId
                        }
                      </p>

                    </div>
                  )}

                </>
              )}

            </div>

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