"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Search,
  Send,
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
  createPublicClient,
  http,
} from "viem";

import { base } from "viem/chains";

import { ConnectWalletButton } from "@/components/wallet/connect-wallet";
import { QuickSendWalletButton } from "@/components/wallet/quick-send-wallet";

const BASE_CHAIN_ID = 8453;

const BASE_USDT_ADDRESS =
  "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as `0x${string}`;

const USDT_DECIMALS = 6;

/*
 * Paycrest sender fee configured in your dashboard.
 *
 * 5% = 0.05
 */
const SENDER_FEE_PERCENT = 5;

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

type Institution = {
  name: string;
  code: string;
};

type CryptoOption = {
  symbol: string;
  name: string;
  network: string;
};

type PaymentState =
  | "form"
  | "processing"
  | "success"
  | "error";

const CRYPTO_OPTIONS: CryptoOption[] = [
  {
    symbol: "USDT",
    name: "Tether USD",
    network: "base",
  },
];

export default function Home() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const wallet = wallets[0];

  const [step, setStep] = useState(1);

  const [institutions, setInstitutions] = useState<
    Institution[]
  >([]);

  const [selectedBank, setSelectedBank] =
    useState<Institution | null>(null);

  const [bankDropdownOpen, setBankDropdownOpen] =
    useState(false);

  const [bankSearch, setBankSearch] = useState("");

  const [loadingBanks, setLoadingBanks] =
    useState(false);

  const [accountNumber, setAccountNumber] =
    useState("");

  const [accountName, setAccountName] =
    useState("");

  const [verifyingAccount, setVerifyingAccount] =
    useState(false);

  const [accountError, setAccountError] =
    useState("");

  const [amount, setAmount] = useState("");

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

  const [paymentState, setPaymentState] =
    useState<PaymentState>("form");

  const [paymentError, setPaymentError] =
    useState("");

  const [transactionHash, setTransactionHash] =
    useState("");

  const [orderId, setOrderId] = useState("");

  const [countdown, setCountdown] = useState(60);

  const bankDropdownRef =
    useRef<HTMLDivElement | null>(null);

  const cryptoDropdownRef =
    useRef<HTMLDivElement | null>(null);

  /*
   * ------------------------------------------------
   * LOAD BANKS
   * ------------------------------------------------
   */

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

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              "Failed to load banks."
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
          "BANK FETCH ERROR:",
          error
        );
      } finally {
        setLoadingBanks(false);
      }
    };

    fetchBanks();
  }, [authenticated]);

  /*
   * ------------------------------------------------
   * CLOSE DROPDOWNS
   * ------------------------------------------------
   */

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        bankDropdownRef.current &&
        !bankDropdownRef.current.contains(target)
      ) {
        setBankDropdownOpen(false);
      }

      if (
        cryptoDropdownRef.current &&
        !cryptoDropdownRef.current.contains(target)
      ) {
        setCryptoDropdownOpen(false);
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
   * ------------------------------------------------
   * PROCESSING COUNTDOWN
   * ------------------------------------------------
   */

  useEffect(() => {
    if (paymentState !== "processing") {
      return;
    }

    setCountdown(60);

    const interval = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paymentState]);

  /*
   * ------------------------------------------------
   * BANK SEARCH
   * ------------------------------------------------
   */

  const filteredInstitutions =
    institutions.filter((bank) =>
      bank.name
        .toLowerCase()
        .includes(bankSearch.toLowerCase())
    );

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
   * ------------------------------------------------
   * VERIFY ACCOUNT
   * ------------------------------------------------
   */

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

  /*
   * ------------------------------------------------
   * CRYPTO
   * ------------------------------------------------
   */

  const handleCryptoSelect = (
    crypto: CryptoOption
  ) => {
    setSelectedCrypto(crypto);
    setCryptoDropdownOpen(false);

    setCryptoAmount("");
    setQuoteError("");
    setPaymentError("");
  };

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
    setPaymentError("");
  };

  /*
   * ------------------------------------------------
   * CRYPTO QUOTE
   * ------------------------------------------------
   */

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

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              "Unable to get crypto quote."
          );
        }

        const value = Number(
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
   * ------------------------------------------------
   * DISPLAY AMOUNT
   * ------------------------------------------------
   *
   * This is ONLY for the button.
   *
   * Example:
   *
   * Crypto amount = 7.636 USDT
   * Sender fee    = 5%
   * Sender fee    = 0.3818 USDT
   *
   * Button:
   * Pay 8.017800 USDT
   *
   * No fee breakdown is shown to the user.
   */

  const cryptoAmountNumber =
    Number(cryptoAmount);

  const senderFeeAmount =
    cryptoAmountNumber *
    (SENDER_FEE_PERCENT / 100);

  const amountToPay =
    cryptoAmountNumber +
    senderFeeAmount;

  const displayAmountToPay =
    Number.isFinite(amountToPay) &&
    amountToPay > 0
      ? amountToPay.toFixed(6)
      : "";

  /*
   * ------------------------------------------------
   * PAYMENT
   * ------------------------------------------------
   */

  const handlePay = async () => {
    if (!wallet?.address) {
      setPaymentError(
        "Please connect your wallet first."
      );
      return;
    }

    if (
      !selectedCrypto ||
      selectedCrypto.symbol !== "USDT"
    ) {
      setPaymentError(
        "Please select USDT."
      );
      return;
    }

    if (
      !selectedBank ||
      !accountNumber ||
      !accountName ||
      !cryptoAmount
    ) {
      setPaymentError(
        "Some payment information is missing."
      );
      return;
    }

    setPaymentError("");
    setPaymentState("processing");
    setCountdown(60);

    try {
      /*
       * ------------------------------------------------
       * 1. CREATE PAYCREST ORDER
       * ------------------------------------------------
       */

      const response = await fetch(
        "/api/transaction",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            amount: cryptoAmount,
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
        "PAYCREST ORDER RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to create Paycrest order."
        );
      }

      /*
       * ------------------------------------------------
       * 2. SAVE ORDER ID
       * ------------------------------------------------
       */

      setOrderId(
        data?.orderId || ""
      );

      /*
       * ------------------------------------------------
       * 3. RECEIVE ADDRESS
       * ------------------------------------------------
       */

      const receiveAddress =
        data?.receiveAddress ||
        data?.providerAccount
          ?.receiveAddress;

      if (!receiveAddress) {
        throw new Error(
          "Paycrest did not return a receive address."
        );
      }

      /*
       * ------------------------------------------------
       * 4. PAYCREST IS AUTHORITATIVE
       * ------------------------------------------------
       *
       * The actual transaction amount is NOT
       * calculated from our 5% display calculation.
       *
       * Paycrest returns:
       *
       * amount
       * senderFee
       * transactionFee
       *
       * We use those actual values for the
       * blockchain transaction.
       */

      const orderAmount = Number(
        data?.amount
      );

      const senderFee = Number(
        data?.senderFee ?? 0
      );

      const transactionFee = Number(
        data?.transactionFee ?? 0
      );

      if (
        !Number.isFinite(orderAmount) ||
        orderAmount <= 0
      ) {
        throw new Error(
          "Paycrest returned an invalid order amount."
        );
      }

      if (
        !Number.isFinite(senderFee) ||
        senderFee < 0
      ) {
        throw new Error(
          "Paycrest returned an invalid sender fee."
        );
      }

      if (
        !Number.isFinite(transactionFee) ||
        transactionFee < 0
      ) {
        throw new Error(
          "Paycrest returned an invalid transaction fee."
        );
      }

      const totalCryptoAmount =
        orderAmount +
        senderFee +
        transactionFee;

      console.log(
        "PAYCREST AMOUNT:",
        orderAmount
      );

      console.log(
        "PAYCREST SENDER FEE:",
        senderFee
      );

      console.log(
        "PAYCREST TRANSACTION FEE:",
        transactionFee
      );

      console.log(
        "TOTAL CRYPTO TO SEND:",
        totalCryptoAmount
      );

      console.log(
        "PAYCREST RECEIVE ADDRESS:",
        receiveAddress
      );

      /*
       * ------------------------------------------------
       * 5. SWITCH TO BASE
       * ------------------------------------------------
       */

      if (wallet.switchChain) {
        await wallet.switchChain(
          BASE_CHAIN_ID
        );
      }

      /*
       * ------------------------------------------------
       * 6. CONVERT USDT TO UNITS
       * ------------------------------------------------
       */

      const totalUnits = parseUnits(
        totalCryptoAmount.toFixed(6),
        USDT_DECIMALS
      );

      console.log(
        "USDT TRANSFER UNITS:",
        totalUnits.toString()
      );

      /*
       * ------------------------------------------------
       * 7. CREATE ERC20 TRANSFER DATA
       * ------------------------------------------------
       */

      const transferData =
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [
            receiveAddress as `0x${string}`,
            totalUnits,
          ],
        });

      /*
       * ------------------------------------------------
       * 8. TRIGGER PRIVY WALLET
       * ------------------------------------------------
       */

      const result =
        await sendTransaction(
          {
            to: BASE_USDT_ADDRESS,
            data: transferData,
            chainId:
              BASE_CHAIN_ID,
          },
          {
            address:
              wallet.address,
          }
        );

      /*
       * ------------------------------------------------
       * 9. GET TRANSACTION HASH
       * ------------------------------------------------
       */

      const hash = result.hash;

      if (!hash) {
        throw new Error(
          "Wallet transaction was not submitted."
        );
      }

      console.log(
        "BASE TRANSACTION HASH:",
        hash
      );

      setTransactionHash(hash);

      /*
       * ------------------------------------------------
       * 10. WAIT FOR CONFIRMATION
       * ------------------------------------------------
       */

      await publicClient.waitForTransactionReceipt(
        {
          hash,
          confirmations: 1,
        }
      );

      /*
       * ------------------------------------------------
       * 11. SUCCESS
       * ------------------------------------------------
       */

      setPaymentState("success");
    } catch (error) {
      console.error(
        "PAYMENT ERROR:",
        error
      );

      setPaymentState("error");

      setPaymentError(
        error instanceof Error
          ? error.message
          : "Payment failed. Please try again."
      );
    }
  };

  /*
   * ------------------------------------------------
   * PAY BUTTON CONDITION
   * ------------------------------------------------
   */

  const showPayButton =
    !!selectedCrypto &&
    !!amount &&
    Number(amount) > 0 &&
    !!cryptoAmount &&
    !loadingQuote &&
    !quoteError;

  /*
   * ------------------------------------------------
   * PROCESSING SCREEN
   * ------------------------------------------------
   */

  if (
    paymentState === "processing"
  ) {
    return (
      <PaymentShell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-[590px] text-center">
            <div className="relative mx-auto h-[120px] w-[120px]">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, transparent 45deg, #1557E8 110deg, #1557E8 150deg, transparent 210deg, transparent 360deg)",
                  animation:
                    "biyaport-spin 1.5s linear infinite",
                }}
              />

              <div className="absolute inset-[3px] rounded-full bg-[#050511]" />

              <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-[#1557E8]">
                <Send
                  className="h-7 w-7 -rotate-12 text-white"
                  strokeWidth={2.2}
                />
              </div>
            </div>

            <h1 className="mt-7 text-[25px] font-semibold tracking-[-0.03em]">
              Payment Processing
            </h1>

            <p className="mt-3 text-[16px] text-muted-foreground">
              Confirming your transaction and receiving crypto
            </p>

            <div className="mt-7 inline-flex rounded-[7px] bg-[#07091b] px-4 py-2 text-[16px] font-medium text-[#1557E8]">
              {countdown >= 60
                ? "1:00"
                : `0:${String(
                    countdown
                  ).padStart(2, "0")}`}
            </div>

            <div className="mx-auto mt-8 flex w-full max-w-[310px] items-center">
              <div className="h-3 w-3 shrink-0 rounded-full bg-[#1557E8]" />

              <div className="relative h-[3px] flex-1 overflow-hidden bg-[#090d24]">
                <div
                  className="absolute inset-y-0 left-0 bg-[#1557E8]"
                  style={{
                    width: "50%",
                  }}
                />
              </div>

              <div className="h-3 w-3 shrink-0 rounded-full bg-[#1557E8]" />

              <div className="h-[3px] flex-1 bg-[#090d24]" />

              <div className="h-3 w-3 shrink-0 rounded-full bg-[#080b1c]" />
            </div>

            {orderId && (
              <p className="mt-7 break-all text-[12px] text-muted-foreground">
                Order: {orderId}
              </p>
            )}

            {transactionHash && (
              <p className="mt-2 break-all text-[12px] text-muted-foreground">
                Transaction:{" "}
                {transactionHash}
              </p>
            )}
          </div>
        </div>

        <style jsx global>{`
          @keyframes biyaport-spin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </PaymentShell>
    );
  }

  /*
   * ------------------------------------------------
   * SUCCESS SCREEN
   * ------------------------------------------------
   */

  if (
    paymentState === "success"
  ) {
    return (
      <PaymentShell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-[590px] text-center">
            <div className="mx-auto flex h-[100px] w-[100px] items-center justify-center rounded-full bg-[#1557E8]">
              <Check className="h-12 w-12 text-white" />
            </div>

            <h1 className="mt-7 text-[25px] font-semibold tracking-[-0.03em]">
              Transfer Successful
            </h1>

            <p className="mx-auto mt-3 max-w-[460px] text-[16px] leading-[24px] text-muted-foreground">
              You have successfully sent{" "}
              <span className="text-foreground">
                ₦
                {Number(
                  amount
                ).toLocaleString()}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {accountName}
              </span>
            </p>

            <div className="mx-auto mt-8 flex w-full max-w-[310px] items-center">
              <div className="h-3 w-3 shrink-0 rounded-full bg-[#1557E8]" />

              <div className="h-[3px] flex-1 bg-[#1557E8]" />

              <div className="h-3 w-3 shrink-0 rounded-full bg-[#1557E8]" />

              <div className="h-[3px] flex-1 bg-[#1557E8]" />

              <div className="h-3 w-3 shrink-0 rounded-full bg-[#1557E8]" />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!transactionHash) {
                  return;
                }

                window.open(
                  `https://basescan.org/tx/${transactionHash}`,
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
              className="mt-7 flex h-[56px] w-full items-center justify-center rounded-[10px] bg-[#1557E8] text-[16px] font-medium text-white transition hover:opacity-90"
            >
              View in Explorer
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentState("form");
                setStep(1);

                setAmount("");
                setCryptoAmount("");
                setSelectedCrypto(null);

                setTransactionHash("");
                setOrderId("");

                setPaymentError("");
                setQuoteError("");

                setAccountNumber("");
                setAccountName("");
                setSelectedBank(null);

                setBankSearch("");
                setCryptoDropdownOpen(false);
                setBankDropdownOpen(false);
              }}
              className="mt-6 text-[15px] text-muted-foreground underline underline-offset-4 transition hover:text-white"
            >
              Back Home
            </button>
          </div>
        </div>
      </PaymentShell>
    );
  }

  /*
   * ------------------------------------------------
   * ERROR SCREEN
   * ------------------------------------------------
   */

  if (
    paymentState === "error"
  ) {
    return (
      <PaymentShell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-[590px] text-center">
            <div className="mx-auto flex h-[100px] w-[100px] items-center justify-center rounded-full bg-destructive/10">
              <span className="text-[42px] text-destructive">
                !
              </span>
            </div>

            <h1 className="mt-7 text-[25px] font-semibold tracking-[-0.03em]">
              Payment Failed
            </h1>

            <p className="mx-auto mt-3 max-w-[460px] text-[15px] leading-[23px] text-muted-foreground">
              {paymentError ||
                "Something went wrong while processing your payment."}
            </p>

            <button
              type="button"
              onClick={() => {
                setPaymentState("form");
                setPaymentError("");
              }}
              className="mt-8 flex h-[56px] w-full items-center justify-center rounded-[10px] bg-primary text-[16px] font-medium text-primary-foreground transition hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        </div>
      </PaymentShell>
    );
  }

  /*
   * ------------------------------------------------
   * MAIN FORM
   * ------------------------------------------------
   */

  return (
    <div className="relative z-10 min-h-screen">
      <header className="fixed left-0 right-0 top-0 z-[100] px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between rounded-[16px] border border-[#0F0F1B] bg-[#050511]/95 p-3 shadow-2xl backdrop-blur-md">
          <Image
            src="/biyaport_logo.svg"
            alt="Biyaport"
            width={160}
            height={44}
            className="h-[36px] w-auto object-contain sm:h-[44px]"
            priority
          />

          <ConnectWalletButton />
        </div>
      </header>

      <section className="flex min-h-screen items-start justify-center px-4 pb-10 pt-[112px] sm:px-6 sm:pt-[128px]">
        <div className="flex w-full max-w-[590px] flex-col items-center">
          <div className="w-full rounded-[16px] border border-border bg-card p-5">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-[20px] font-semibold tracking-[-0.02em] sm:text-[22px]">
                Quick Send
              </h1>

              <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-input sm:h-12 sm:w-12">
                <Image
                  src="/send-money.png"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 object-contain"
                />
              </div>
            </div>

            {step === 1 && (
              <>
                <div
                  ref={bankDropdownRef}
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
                    className="flex h-[52px] w-full items-center justify-between rounded-[10px] border border-border bg-input px-4 text-left text-[15px] disabled:opacity-50 sm:h-[56px] sm:px-5 sm:text-[16px]"
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
                            value={bankSearch}
                            onChange={(event) =>
                              setBankSearch(
                                event.target.value
                              )
                            }
                            placeholder="Search bank"
                            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                          />
                        </div>
                      </div>

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

                <div className="mt-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter Account number"
                    value={accountNumber}
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
                        {accountName}
                      </div>
                    )}

                  {accountError && (
                    <div className="mt-2 px-1 text-[13px] text-destructive">
                      {accountError}
                    </div>
                  )}
                </div>

                <QuickSendWalletButton />

                {accountName &&
                  !verifyingAccount && (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary text-[15px] font-medium text-primary-foreground hover:opacity-90 sm:h-[56px]"
                    >
                      Next
                    </button>
                  )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="rounded-[10px] bg-input px-5 py-4">
                  <div className="space-y-2 text-[15px] leading-[22px]">
                    <p>
                      Name:{" "}
                      <span className="font-semibold">
                        {accountName}
                      </span>
                    </p>

                    <p>
                      Account no:{" "}
                      <span className="font-semibold">
                        {accountNumber}
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

                <div className="mt-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Enter Amount (₦)"
                    value={amount}
                    onChange={
                      handleAmountChange
                    }
                    className="h-[52px] w-full rounded-[10px] border border-border bg-input px-4 text-[15px] outline-none placeholder:text-muted-foreground sm:h-[56px] sm:px-5 sm:text-[16px]"
                  />

                  {loadingQuote && (
                    <div className="mt-2 flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Calculating crypto amount...
                    </div>
                  )}

                  {cryptoAmount &&
                    !loadingQuote &&
                    !quoteError && (
                      <div className="mt-2 px-1 text-[13px] text-muted-foreground">
                        You will pay approximately{" "}
                        <span className="font-medium text-foreground">
                          {displayAmountToPay}{" "}
                          {
                            selectedCrypto?.symbol
                          }
                        </span>
                      </div>
                    )}

                  {quoteError && (
                    <div className="mt-2 px-1 text-[13px] text-destructive">
                      {quoteError}
                    </div>
                  )}
                </div>

                {showPayButton && (
                  <button
                    type="button"
                    onClick={handlePay}
                    className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary text-[15px] font-medium text-primary-foreground transition hover:opacity-90 sm:h-[56px] sm:text-[16px]"
                  >
                    Pay {displayAmountToPay}{" "}
                    {selectedCrypto?.symbol}
                  </button>
                )}

                {paymentError && (
                  <div className="mt-3 rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                    {paymentError}
                  </div>
                )}
              </>
            )}
          </div>

          <p className="mt-6 w-full px-2 text-center text-[14px] leading-[20px] text-muted-foreground sm:mt-8 sm:px-0 sm:text-[16px] sm:leading-[22px]">
            The fastest way to send crypto to
            Nigerian bank accounts. No wallet needed
            for recipients.
          </p>
        </div>
      </section>
    </div>
  );
}

/*
 * ====================================================
 * PAYMENT SHELL
 * ====================================================
 */

function PaymentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 min-h-screen">
      <header className="fixed left-0 right-0 top-0 z-[100] px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between rounded-[16px] border border-[#0F0F1B] bg-[#050511]/95 p-3 shadow-2xl backdrop-blur-md">
          <Image
            src="/biyaport_logo.svg"
            alt="Biyaport"
            width={160}
            height={44}
            className="h-[36px] w-auto object-contain sm:h-[44px]"
            priority
          />

          <ConnectWalletButton />
        </div>
      </header>

      <section className="min-h-screen overflow-y-auto px-4 pb-12 pt-[112px] sm:px-6 sm:pt-[128px]">
        {children}
      </section>
    </div>
  );
}
