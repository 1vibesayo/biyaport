"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Search,
  Send,
  ArrowLeft,
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
  formatUnits,
  createPublicClient,
  http,
} from "viem";

import { base } from "viem/chains";

import QRCode from "qrcode";

import { ConnectWalletButton } from "@/components/wallet/connect-wallet";
import { QuickSendWalletButton } from "@/components/wallet/quick-send-wallet";

/*
 * ====================================================
 * CONSTANTS
 * ====================================================
 */

const BASE_CHAIN_ID = 8453;

const BASE_USDT_ADDRESS =
  "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as `0x${string}`;

const BASE_USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

const BASESCAN_TX_URL = "https://basescan.org/tx/";

const RECEIPT_FONT = '"DM Sans", sans-serif';

/*
 * Public Base client.
 *
 * Used for:
 * - Reading token balances
 * - Waiting for transaction confirmation
 */

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

/*
 * ====================================================
 * TYPES
 * ====================================================
 */

type Institution = {
  name: string;
  code: string;
};

type CryptoOption = {
  symbol: string;
  name: string;
  network: string;
  address: `0x${string}`;
  decimals: number;
  logo: string;
};

type CurrencyCode = "NGN" | "KES";

type PaymentState =
  | "form"
  | "processing"
  | "success"
  | "error";

type PaymentStage = 1 | 2 | 3;

/*
 * ====================================================
 * CRYPTO OPTIONS
 * ====================================================
 */

const CRYPTO_OPTIONS: CryptoOption[] = [
  {
    symbol: "USDT",
    name: "Tether USD",
    network: "base",
    address: BASE_USDT_ADDRESS,
    decimals: 6,
    logo: "/usdt-logo.svg",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    network: "base",
    address: BASE_USDC_ADDRESS,
    decimals: 6,
    logo: "/usdc-logo.svg",
  },
];

/*
 * ====================================================
 * CURRENCIES
 * ====================================================
 */

const CURRENCIES: {
  code: CurrencyCode;
  name: string;
  flag: string;
}[] = [
  {
    code: "NGN",
    name: "Nigerian naira",
    flag: "/nigeria-flag.svg",
  },
  {
    code: "KES",
    name: "Kenyan shillings",
    flag: "/kenya-flag.svg",
  },
];

/*
 * ====================================================
 * HOME
 * ====================================================
 */

export default function Home() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const wallet = wallets[0];

  /*
   * ------------------------------------------------
   * CURRENCY
   * ------------------------------------------------
   */

  const [selectedCurrency, setSelectedCurrency] =
    useState<CurrencyCode>("NGN");

  const [currencyDropdownOpen, setCurrencyDropdownOpen] =
    useState(false);

  /*
   * ------------------------------------------------
   * BUY / SELL
   * ------------------------------------------------
   */

  const [tradeMode, setTradeMode] =
    useState<"buy" | "sell">("sell");

  /*
   * ------------------------------------------------
   * FORM STATE
   * ------------------------------------------------
   */

  const [step, setStep] = useState(1);

  const [institutions, setInstitutions] = useState<
    Institution[]
  >([]);

  const [selectedBank, setSelectedBank] =
    useState<Institution | null>(null);

  const [bankDropdownOpen, setBankDropdownOpen] =
    useState(false);

  const [bankSearch, setBankSearch] = useState("");

  const [loadingBanks, setLoadingBanks] = useState(false);

  const [accountNumber, setAccountNumber] = useState("");

  const [accountName, setAccountName] = useState("");

  const [verifyingAccount, setVerifyingAccount] =
    useState(false);

  const [accountError, setAccountError] = useState("");

  /*
   * ------------------------------------------------
   * PAYMENT INPUT
   * ------------------------------------------------
   */

  const [amount, setAmount] = useState("");

  const [selectedCrypto, setSelectedCrypto] =
    useState<CryptoOption | null>(null);

  const [cryptoDropdownOpen, setCryptoDropdownOpen] =
    useState(false);

  const [cryptoSearch, setCryptoSearch] = useState("");

  const [cryptoAmount, setCryptoAmount] = useState("");

  const [loadingQuote, setLoadingQuote] = useState(false);

  const [quoteError, setQuoteError] = useState("");

  /*
   * ------------------------------------------------
   * TOKEN BALANCES
   * ------------------------------------------------
   */

  const [tokenBalances, setTokenBalances] = useState<
    Record<string, string>
  >({});

  const [loadingBalances, setLoadingBalances] =
    useState(false);

  /*
   * ------------------------------------------------
   * NETWORK
   * ------------------------------------------------
   */

  const selectedNetwork = "Base";

  /*
   * ------------------------------------------------
   * PAYMENT STATE
   * ------------------------------------------------
   */

  const [paymentState, setPaymentState] =
    useState<PaymentState>("form");

  const [paymentStage, setPaymentStage] =
    useState<PaymentStage>(1);

  const [paymentError, setPaymentError] = useState("");

  const [transactionHash, setTransactionHash] =
    useState("");

  const [orderId, setOrderId] = useState("");

  const [countdown, setCountdown] = useState(60);

  /*
   * ------------------------------------------------
   * RECEIPT DATA
   * ------------------------------------------------
   */

  const [receiptCryptoAmount, setReceiptCryptoAmount] =
    useState("");

  const [receiptDateTime, setReceiptDateTime] =
    useState("");

  /*
   * ------------------------------------------------
   * REFS
   * ------------------------------------------------
   */

  const bankDropdownRef =
    useRef<HTMLDivElement | null>(null);

  const cryptoDropdownRef =
    useRef<HTMLDivElement | null>(null);

  const currencyDropdownRef =
    useRef<HTMLDivElement | null>(null);

  /*
   * ====================================================
   * CURRENT CURRENCY
   * ====================================================
   */

  const currentCurrency =
    CURRENCIES.find(
      (currency) =>
        currency.code === selectedCurrency
    ) || CURRENCIES[0];

  /*
   * ====================================================
   * LOAD TOKEN BALANCES
   * ====================================================
   */

  useEffect(() => {
    if (!authenticated || !wallet?.address) {
      setTokenBalances({});
      setLoadingBalances(false);
      return;
    }

    let cancelled = false;

    const fetchTokenBalances = async () => {
      setLoadingBalances(true);

      try {
        const balanceEntries =
          await Promise.all(
            CRYPTO_OPTIONS.map(
              async (crypto) => {
                try {
                  const rawBalance =
                    await publicClient.readContract({
                      address: crypto.address,
                      abi: erc20Abi,
                      functionName: "balanceOf",
                      args: [
                        wallet.address as `0x${string}`,
                      ],
                    });

                  const formattedBalance =
                    formatUnits(
                      rawBalance,
                      crypto.decimals
                    );

                  return [
                    crypto.symbol,
                    formattedBalance,
                  ] as const;
                } catch (error) {
                  console.error(
                    `BALANCE FETCH ERROR (${crypto.symbol}):`,
                    error
                  );

                  return [
                    crypto.symbol,
                    "0",
                  ] as const;
                }
              }
            )
          );

        if (!cancelled) {
          setTokenBalances(
            Object.fromEntries(
              balanceEntries
            )
          );
        }
      } catch (error) {
        console.error(
          "TOKEN BALANCE FETCH ERROR:",
          error
        );

        if (!cancelled) {
          setTokenBalances({});
        }
      } finally {
        if (!cancelled) {
          setLoadingBalances(false);
        }
      }
    };

    fetchTokenBalances();

    return () => {
      cancelled = true;
    };
  }, [authenticated, wallet?.address]);

  /*
   * ====================================================
   * LOAD BANKS
   * ====================================================
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
   * ====================================================
   * CLOSE DROPDOWNS
   * ====================================================
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

      if (
        currencyDropdownRef.current &&
        !currencyDropdownRef.current.contains(target)
      ) {
        setCurrencyDropdownOpen(false);
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
   * PROCESSING COUNTDOWN
   * ====================================================
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
   * ====================================================
   * BANK SEARCH
   * ====================================================
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
   * ====================================================
   * VERIFY ACCOUNT
   * ====================================================
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

  /*
   * ====================================================
   * ACCOUNT NUMBER
   * ====================================================
   */

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

  /*
   * ====================================================
   * NEXT
   * ====================================================
   */

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
   * ====================================================
   * BACK TO ACCOUNT DETAILS
   * ====================================================
   */

  const handleBack = () => {
    setStep(1);
    setPaymentError("");
  };

  /*
   * ====================================================
   * CRYPTO SEARCH
   * ====================================================
   */

  const filteredCryptoOptions =
    CRYPTO_OPTIONS.filter(
      (crypto) =>
        crypto.symbol
          .toLowerCase()
          .includes(
            cryptoSearch.toLowerCase()
          ) ||
        crypto.name
          .toLowerCase()
          .includes(
            cryptoSearch.toLowerCase()
          )
    );

  /*
   * ====================================================
   * CRYPTO
   * ====================================================
   */

  const handleCryptoSelect = (
    crypto: CryptoOption
  ) => {
    setSelectedCrypto(crypto);
    setCryptoDropdownOpen(false);

    setCryptoSearch("");
    setCryptoAmount("");
    setQuoteError("");
    setPaymentError("");
  };

  /*
   * ====================================================
   * NAIRA AMOUNT
   * ====================================================
   */

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
   * ====================================================
   * CRYPTO QUOTE
   * ====================================================
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
   * ====================================================
   * DISPLAY PAYMENT AMOUNT
   * ====================================================
   */

  const estimatedPayAmount =
    cryptoAmount &&
    Number.isFinite(Number(cryptoAmount))
      ? Number(cryptoAmount) * 1.05
      : 0;

  const estimatedPayAmountFormatted =
    estimatedPayAmount > 0
      ? estimatedPayAmount.toFixed(6)
      : "";

  /*
   * ====================================================
   * PAY BUTTON STATE
   * ====================================================
   */

  const showPayButton =
    !!selectedCrypto &&
    !!amount &&
    Number(amount) > 0 &&
    !!cryptoAmount &&
    !loadingQuote &&
    !quoteError;

  /*
   * ====================================================
   * RESET PAYMENT
   * ====================================================
   */

  const resetPayment = () => {
    setPaymentState("form");
    setPaymentStage(1);
    setPaymentError("");

    setTransactionHash("");
    setOrderId("");

    setReceiptCryptoAmount("");
    setReceiptDateTime("");

    setCountdown(60);

    setStep(1);
  };

  /*
   * ====================================================
   * PAYMENT
   * ====================================================
   */

  const handlePay = async () => {
    if (!showPayButton) {
      return;
    }

    if (!wallet?.address) {
      setPaymentError(
        "Please connect your wallet first."
      );
      return;
    }

    if (!selectedCrypto) {
      setPaymentError(
        "Please select a crypto to pay with."
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

    /*
     * ================================================
     * CHECK TOKEN BALANCE BEFORE CREATING ORDER
     * ================================================
     */

    const walletBalance = Number(
      tokenBalances[selectedCrypto.symbol] || "0"
    );

    if (
      !Number.isFinite(walletBalance) ||
      walletBalance < estimatedPayAmount
    ) {
      setPaymentError(
        `Insufficient ${selectedCrypto.symbol} balance. You need approximately ${estimatedPayAmountFormatted} ${selectedCrypto.symbol}, but your wallet has ${walletBalance.toFixed(6)} ${selectedCrypto.symbol}.`
      );
      return;
    }

    setPaymentError("");

    setPaymentState("processing");
    setPaymentStage(1);
    setCountdown(60);

    try {
      /*
       * ================================================
       * 1. CREATE PAYCREST ORDER
       * ================================================
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
       * ================================================
       * 2. SAVE ORDER ID
       * ================================================
       */

      setOrderId(
        data?.orderId || ""
      );

      /*
       * ================================================
       * 3. GET PAYCREST RECEIVE ADDRESS
       * ================================================
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

      if (
        !/^0x[a-fA-F0-9]{40}$/.test(
          receiveAddress
        )
      ) {
        throw new Error(
          "Paycrest returned an invalid receiving address."
        );
      }

      /*
       * ================================================
       * 4. PAYCREST IS AUTHORITATIVE
       * ================================================
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
        "----------------------------------------"
      );

      console.log(
        `BIYAPORT ${selectedCrypto.symbol} PAYMENT`
      );

      console.log(
        "Wallet:",
        wallet.address
      );

      console.log(
        `${selectedCrypto.symbol} contract:`,
        selectedCrypto.address
      );

      console.log(
        "Paycrest receive address:",
        receiveAddress
      );

      console.log(
        "Paycrest order amount:",
        orderAmount
      );

      console.log(
        "Paycrest sender fee:",
        senderFee
      );

      console.log(
        "Paycrest transaction fee:",
        transactionFee
      );

      console.log(
        `TOTAL ${selectedCrypto.symbol} TO SEND:`,
        totalCryptoAmount
      );

      console.log(
        "----------------------------------------"
      );

      /*
       * ================================================
       * 5. SWITCH WALLET TO BASE
       * ================================================
       */

      if (wallet.switchChain) {
        await wallet.switchChain(
          BASE_CHAIN_ID
        );
      }

      /*
       * ================================================
       * 6. CONVERT TOKEN AMOUNT
       * ================================================
       */

      const totalUnits = parseUnits(
        totalCryptoAmount.toFixed(
          selectedCrypto.decimals
        ),
        selectedCrypto.decimals
      );

      console.log(
        `${selectedCrypto.symbol} TOKEN UNITS:`,
        totalUnits.toString()
      );

      /*
       * ================================================
       * 7. ENCODE ERC-20 TRANSFER
       * ================================================
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

      console.log(
        "ENCODED TRANSFER DATA:",
        transferData
      );

      /*
       * STAGE 2
       */

      setPaymentStage(2);

      /*
       * ================================================
       * 8. OPEN WALLET CONFIRMATION
       * ================================================
       */

      const result =
        await sendTransaction(
          {
            to: selectedCrypto.address,
            data: transferData,
            value: BigInt(0),
            chainId:
              BASE_CHAIN_ID,
          },
          {
            address:
              wallet.address,
          }
        );

      /*
       * ================================================
       * 9. TRANSACTION HASH
       * ================================================
       */

      const hash = result?.hash;

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
       * STAGE 3
       */

      setPaymentStage(3);

      /*
       * ================================================
       * SAVE RECEIPT DATA
       * ================================================
       */

      setReceiptCryptoAmount(
        totalCryptoAmount.toFixed(
          selectedCrypto.decimals
        )
      );

      setReceiptDateTime(
        formatReceiptDate(new Date())
      );

      /*
       * ================================================
       * 10. WAIT FOR BASE CONFIRMATION
       * ================================================
       */

      await publicClient.waitForTransactionReceipt(
        {
          hash,
          confirmations: 1,
        }
      );

      /*
       * ================================================
       * 11. SUCCESS
       * ================================================
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
   * ====================================================
   * PROCESSING SCREEN
   * ====================================================
   */

  if (
    paymentState === "processing"
  ) {
    const progressPercentage =
      paymentStage === 1
        ? 0
        : paymentStage === 2
        ? 50
        : 100;

    return (
      <PaymentShell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-[590px] rounded-[16px] border border-border bg-card p-8 text-center">

            <div className="relative mx-auto flex h-[96px] w-[96px] items-center justify-center rounded-full bg-[#050511]">
              <div
                className="absolute h-[96px] w-[96px] rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, transparent 45deg, #1557E8 110deg, #1557E8 150deg, transparent 210deg, transparent 360deg)",
                  animation:
                    "biyaport-spin 1.5s linear infinite",
                }}
              />

              <div className="absolute h-[90px] w-[90px] rounded-full bg-[#050511]" />

              <div className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#1557E8]">
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
              {paymentStage === 1 &&
                "Transaction initiated"}

              {paymentStage === 2 &&
                "Waiting for wallet signature"}

              {paymentStage === 3 &&
                "Transaction signed and approved"}
            </p>

            <div className="mt-7 inline-flex rounded-[7px] bg-[#07091b] px-4 py-2 text-[16px] font-medium text-[#1557E8]">
              {countdown >= 60
                ? "1:00"
                : `0:${String(
                    countdown
                  ).padStart(2, "0")}`}
            </div>

            <div className="relative mx-auto mt-8 w-full max-w-[310px]">
              <div className="relative h-[3px] w-full rounded-full bg-[#090d24]">
                <div
                  className="absolute left-0 top-0 h-[3px] rounded-full bg-[#1557E8] transition-all duration-700 ease-in-out"
                  style={{
                    width: `${progressPercentage}%`,
                  }}
                />
              </div>

              <div className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1557E8]" />

              <div
                className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 transition-colors duration-500 ${
                  paymentStage >= 2
                    ? "bg-[#1557E8]"
                    : "bg-[#080b1c]"
                } rounded-full`}
              />

              <div
                className={`absolute right-0 top-1/2 h-3 w-3 translate-x-1/2 -translate-y-1/2 transition-colors duration-500 ${
                  paymentStage >= 3
                    ? "bg-[#1557E8]"
                    : "bg-[#080b1c]"
                } rounded-full`}
              />
            </div>
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
   * ====================================================
   * SUCCESS SCREEN
   * ====================================================
   */

  if (
    paymentState === "success"
  ) {
    return (
      <PaymentShell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-[590px] rounded-[16px] border border-border bg-card p-8 text-center">

            <div className="relative mx-auto flex h-[96px] w-[96px] items-center justify-center rounded-full border-[3px] border-[#1557E8]">
              <div className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[#1557E8]">
                <Check
                  className="h-8 w-8 text-white"
                  strokeWidth={2.2}
                />
              </div>
            </div>

            <h1 className="mt-7 text-[25px] font-semibold tracking-[-0.03em]">
              Transfer Successful
            </h1>

            <p className="mx-auto mt-3 max-w-[500px] text-[16px] leading-[24px] text-muted-foreground">
              You have successfully sent{" "}
              <span className="font-medium text-foreground">
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

            <div className="relative mx-auto mt-8 w-full max-w-[310px]">
              <div className="h-[3px] w-full rounded-full bg-[#1557E8]" />

              <div className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1557E8]" />

              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1557E8]" />

              <div className="absolute right-0 top-1/2 h-3 w-3 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1557E8]" />
            </div>

            <div className="mx-auto mt-7 inline-flex rounded-[7px] bg-[#07091b] px-4 py-2 text-[16px] font-medium text-[#1557E8]">
              1:00
            </div>

            <button
              type="button"
              onClick={() =>
                generateReceipt({
                  amount,
                  cryptoAmount:
                    receiptCryptoAmount ||
                    cryptoAmount,
                  cryptoSymbol:
                    selectedCrypto?.symbol ||
                    "USDT",
                  bankName:
                    selectedBank?.name ||
                    "",
                  accountName,
                  accountNumber,
                  dateTime:
                    receiptDateTime ||
                    formatReceiptDate(
                      new Date()
                    ),
                  transactionHash,
                })
              }
              className="mt-7 flex h-[56px] w-full items-center justify-center rounded-[10px] bg-[#1557E8] text-[16px] font-medium text-white transition hover:opacity-90 active:scale-[0.99]"
            >
              Download receipt
            </button>

            <button
              type="button"
              onClick={resetPayment}
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
   * ====================================================
   * ERROR SCREEN
   * ====================================================
   */

  if (
    paymentState === "error"
  ) {
    return (
      <PaymentShell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-[590px] rounded-[16px] border border-border bg-card p-8 text-center">

            <div className="mx-auto flex h-[80px] w-[80px] items-center justify-center rounded-full bg-destructive/10 text-3xl">
              !
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
                setPaymentStage(1);
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
   * ====================================================
   * MAIN FORM
   * ====================================================
   */

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050511]">
      <Background />

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

              {/* =========================================
                  HEADER
                 ========================================= */}

              <div className="mb-5 flex items-center justify-between">
                <h1 className="text-[20px] font-semibold tracking-[-0.02em] sm:text-[22px]">
                  Quick Port
                </h1>

                <div
                  ref={currencyDropdownRef}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setCurrencyDropdownOpen(
                        (open) => !open
                      )
                    }
                    className="flex h-[44px] items-center gap-2 rounded-[10px] bg-input px-3.5 transition hover:bg-secondary sm:h-[48px] sm:px-4"
                  >
                    <Image
                      src={currentCurrency.flag}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-full object-cover"
                    />

                    <span className="text-[14px] font-semibold">
                      {currentCurrency.code}
                    </span>

                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        currencyDropdownOpen
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </button>

                  {currencyDropdownOpen && (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[220px] overflow-hidden rounded-[12px] border border-border bg-[#070812] p-1.5 shadow-2xl">

                      {CURRENCIES.map(
                        (currency) => (
                          <button
                            key={
                              currency.code
                            }
                            type="button"
                            onClick={() => {
                              setSelectedCurrency(
                                currency.code
                              );

                              setCurrencyDropdownOpen(
                                false
                              );
                            }}
                            className="flex w-full items-center gap-3 rounded-[8px] px-3 py-3 text-left transition hover:bg-secondary"
                          >
                            <Image
                              src={
                                currency.flag
                              }
                              alt=""
                              width={22}
                              height={22}
                              className="h-[22px] w-[22px] rounded-full object-cover"
                            />

                            <div className="flex flex-1 flex-col">
                              <span className="text-[14px] font-medium">
                                {
                                  currency.code
                                }
                              </span>

                              <span className="text-[12px] text-muted-foreground">
                                {
                                  currency.name
                                }
                              </span>
                            </div>

                            {selectedCurrency ===
                              currency.code && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* =========================================
                  BUY / SELL SWITCHER
                 ========================================= */}

              <div className="mb-5 flex h-[52px] rounded-[12px] bg-input p-1">
                <button
                  type="button"
                  disabled
                  className="flex flex-1 cursor-not-allowed items-center justify-center rounded-[9px] text-[14px] font-medium text-muted-foreground opacity-70 sm:text-[15px]"
                >
                  Buy Crypto
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTradeMode("sell")
                  }
                  className={`flex flex-1 items-center justify-center rounded-[9px] text-[14px] font-semibold transition sm:text-[15px] ${
                    tradeMode === "sell"
                      ? "bg-[#050511] text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Sell Crypto
                </button>
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
                  {/* =========================================
                      VERIFIED RECIPIENT DETAILS
                     ========================================= */}

                  <div className="rounded-[10px] bg-input px-5 py-4">
                    <div className="space-y-3 text-[15px] leading-[22px]">

                      <div className="flex items-center justify-between gap-5">
                        <span className="shrink-0 text-muted-foreground">
                          Name
                        </span>

                        <span className="min-w-0 truncate text-right font-semibold text-foreground">
                          {accountName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-5">
                        <span className="shrink-0 text-muted-foreground">
                          Account no
                        </span>

                        <span className="shrink-0 text-right font-semibold text-foreground">
                          {accountNumber}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-5">
                        <span className="shrink-0 text-muted-foreground">
                          Bank Name
                        </span>

                        <span className="min-w-0 truncate text-right font-semibold text-foreground">
                          {selectedBank?.name}
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* =========================================
                      CRYPTO SELECTOR
                     ========================================= */}

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
                      <div className="flex min-w-0 items-center gap-2.5">
                        {selectedCrypto ? (
                          <Image
                            src={
                              selectedCrypto.logo
                            }
                            alt=""
                            width={24}
                            height={24}
                            className="h-6 w-6 shrink-0 object-contain"
                          />
                        ) : null}

                        <span
                          className={
                            selectedCrypto
                              ? "truncate text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {selectedCrypto
                            ? `${selectedCrypto.symbol} · ${selectedCrypto.name}`
                            : "Select Crypto to pay"}
                        </span>
                      </div>

                      <ChevronDown
                        className={`ml-3 h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                          cryptoDropdownOpen
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </button>

                    {cryptoDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[12px] border border-border bg-[#070812] shadow-2xl">

                        <div className="border-b border-border p-3">
                          <div className="flex items-center gap-2">

                            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-border bg-[#050511] px-3">
                              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />

                              <input
                                type="text"
                                value={cryptoSearch}
                                onChange={(event) =>
                                  setCryptoSearch(
                                    event.target.value
                                  )
                                }
                                onClick={(event) =>
                                  event.stopPropagation()
                                }
                                placeholder="Search supported crypto"
                                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
                                autoFocus
                              />
                            </div>

                            <button
                              type="button"
                              onClick={(event) =>
                                event.stopPropagation()
                              }
                              className="flex h-11 shrink-0 items-center gap-2 rounded-[8px] border border-border bg-[#050511] px-3 text-[14px] font-medium"
                            >
                              <Image
                                src="/base-logo.svg"
                                alt=""
                                width={20}
                                height={20}
                                className="h-5 w-5 object-contain"
                              />

                              <span>
                                {selectedNetwork}
                              </span>

                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>

                        <div className="max-h-[260px] overflow-y-auto p-1.5">
                          {filteredCryptoOptions.length >
                          0 ? (
                            filteredCryptoOptions.map(
                              (crypto) => {
                                const balance =
                                  tokenBalances[
                                    crypto.symbol
                                  ];

                                return (
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
                                    className="flex w-full items-center justify-between rounded-[8px] px-3 py-3 text-left transition hover:bg-secondary"
                                  >
                                    <div className="flex min-w-0 items-center gap-3">
                                      <Image
                                        src={
                                          crypto.logo
                                        }
                                        alt=""
                                        width={40}
                                        height={40}
                                        className="h-10 w-10 shrink-0 object-contain"
                                      />

                                      <div className="min-w-0">
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
                                    </div>

                                    <div className="ml-3 flex shrink-0 items-center gap-3">
                                      <div className="text-right">
                                        <div className="text-[14px] font-medium text-foreground">
                                          {loadingBalances
                                            ? "Loading..."
                                            : balance
                                            ? Number(
                                                balance
                                              ).toLocaleString(
                                                "en-US",
                                                {
                                                  maximumFractionDigits:
                                                    6,
                                                }
                                              )
                                            : "0.00"}
                                        </div>

                                        <div className="text-[11px] text-muted-foreground">
                                          {
                                            crypto.symbol
                                          }
                                        </div>
                                      </div>

                                      {selectedCrypto?.symbol ===
                                        crypto.symbol && (
                                        <Check className="h-4 w-4 text-primary" />
                                      )}
                                    </div>
                                  </button>
                                );
                              }
                            )
                          ) : (
                            <div className="px-3 py-8 text-center text-[14px] text-muted-foreground">
                              No supported crypto found.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* =========================================
                      NAIRA AMOUNT
                     ========================================= */}

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
                            {
                              estimatedPayAmountFormatted
                            }{" "}
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

                  {/* =========================================
                      BACK + PAY BUTTONS
                     ========================================= */}

                  <div className="mt-4 flex w-full items-center gap-2">

                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-[10px] border border-border bg-input px-4 text-[15px] font-medium text-foreground transition hover:bg-secondary sm:h-[56px] sm:px-5 sm:text-[16px]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>

                    <button
                      type="button"
                      onClick={handlePay}
                      disabled={!showPayButton}
                      className={`flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-[10px] text-[15px] font-medium transition sm:h-[56px] sm:text-[16px] ${
                        showPayButton
                          ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99]"
                          : "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
                      }`}
                    >
                      {showPayButton
                        ? `Pay ${estimatedPayAmountFormatted} ${selectedCrypto?.symbol}`
                        : "Pay"}
                    </button>

                  </div>

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
    </main>
  );
}

/*
 * ====================================================
 * RECEIPT DATE FORMAT
 * ====================================================
 */

function formatReceiptDate(
  date: Date
) {
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const year = String(
    date.getFullYear()
  ).slice(-2);

  let hours =
    date.getHours();

  const minutes = String(
    date.getMinutes()
  ).padStart(2, "0");

  const ampm =
    hours >= 12
      ? "PM"
      : "AM";

  hours =
    hours % 12 || 12;

  return `${day}/${month}/${year} • ${hours}:${minutes}${ampm}`;
}

/*
 * ====================================================
 * GENERATE RECEIPT
 * ====================================================
 */

async function generateReceipt({
  amount,
  cryptoAmount,
  cryptoSymbol,
  bankName,
  accountName,
  accountNumber,
  dateTime,
  transactionHash,
}: {
  amount: string;
  cryptoAmount: string;
  cryptoSymbol: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  dateTime: string;
  transactionHash: string;
}) {
  if (!transactionHash) {
    return;
  }

  try {
    await Promise.all([
      document.fonts.load(
        `400 25px ${RECEIPT_FONT}`
      ),
      document.fonts.load(
        `500 23px ${RECEIPT_FONT}`
      ),
      document.fonts.load(
        `600 25px ${RECEIPT_FONT}`
      ),
      document.fonts.load(
        `600 34px ${RECEIPT_FONT}`
      ),
      document.fonts.load(
        `700 82px ${RECEIPT_FONT}`
      ),
      document.fonts.load(
        `400 22px ${RECEIPT_FONT}`
      ),
    ]);

    const width = 1024;
    const height = 1450;

    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "Unable to generate receipt."
      );
    }

    ctx.fillStyle = "#050511";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    const backgroundGradient =
      ctx.createRadialGradient(
        width / 2,
        -40,
        0,
        width / 2,
        0,
        760
      );

    backgroundGradient.addColorStop(
      0,
      "rgba(21,87,232,0.16)"
    );

    backgroundGradient.addColorStop(
      0.28,
      "rgba(21,87,232,0.07)"
    );

    backgroundGradient.addColorStop(
      0.68,
      "rgba(21,87,232,0)"
    );

    ctx.fillStyle =
      backgroundGradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    ctx.save();

    ctx.strokeStyle =
      "rgba(21,87,232,0.16)";

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.ellipse(
      width / 2,
      -380,
      500,
      400,
      0,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.strokeStyle =
      "rgba(21,87,232,0.14)";

    ctx.beginPath();

    ctx.ellipse(
      width / 2,
      -490,
      650,
      520,
      0,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.restore();

    const cardX = 68;
    const cardY = 64;
    const cardWidth = 888;
    const cardHeight = 1240;
    const radius = 52;

    ctx.beginPath();

    roundRect(
      ctx,
      cardX,
      cardY,
      cardWidth,
      cardHeight,
      radius
    );

    ctx.fillStyle = "#0f0f1b";
    ctx.fill();

    try {
      const logo =
        await loadImage(
          "/biyaport_logo.svg"
        );

      const logoWidth = 220;
      const logoHeight = 71;

      ctx.drawImage(
        logo,
        (width - logoWidth) / 2,
        128,
        logoWidth,
        logoHeight
      );
    } catch {
      ctx.fillStyle = "#ffffff";

      ctx.font =
        `600 32px ${RECEIPT_FONT}`;

      ctx.textAlign = "center";

      ctx.fillText(
        "BiyaPort",
        width / 2,
        170
      );
    }

    drawDashedLine(
      ctx,
      128,
      238,
      896,
      238
    );

    const formattedNaira =
      Number(
        amount
      ).toLocaleString(
        "en-NG",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      );

    ctx.textAlign = "center";

    ctx.font =
      `700 82px ${RECEIPT_FONT}`;

    ctx.fillStyle = "#ffffff";

    ctx.fillText(
      `₦${formattedNaira}`,
      width / 2,
      370
    );

    ctx.font =
      `600 34px ${RECEIPT_FONT}`;

    ctx.fillStyle = "#ffffff";

    ctx.fillText(
      "Transaction Successful",
      width / 2,
      470
    );

    const labelX = 116;
    const valueX = 908;

    let rowY = 575;

    const rowGap = 84;

    drawReceiptRow(
      ctx,
      "Amount in Crypto",
      `${cryptoAmount} ${cryptoSymbol}`,
      labelX,
      valueX,
      rowY
    );

    rowY += rowGap;

    drawReceiptRow(
      ctx,
      "Bank Name",
      bankName,
      labelX,
      valueX,
      rowY
    );

    rowY += rowGap;

    drawReceiptRow(
      ctx,
      "Account Name",
      accountName,
      labelX,
      valueX,
      rowY
    );

    rowY += rowGap;

    drawReceiptRow(
      ctx,
      "Account Number",
      accountNumber,
      labelX,
      valueX,
      rowY
    );

    rowY += rowGap;

    drawReceiptRow(
      ctx,
      "Date/Time",
      dateTime,
      labelX,
      valueX,
      rowY
    );

    rowY += rowGap;

    drawReceiptRow(
      ctx,
      "Remark",
      "BiyaPort transfer",
      labelX,
      valueX,
      rowY
    );

    drawDashedLine(
      ctx,
      128,
      1088,
      896,
      1088
    );

    const bottomContainerX = 128;
    const bottomContainerY = 1118;
    const bottomContainerWidth = 768;
    const bottomContainerHeight = 150;
    const bottomContainerRadius = 24;

    ctx.beginPath();

    roundRect(
      ctx,
      bottomContainerX,
      bottomContainerY,
      bottomContainerWidth,
      bottomContainerHeight,
      bottomContainerRadius
    );

    ctx.fillStyle = "#050511";
    ctx.fill();

    ctx.strokeStyle =
      "rgba(255,255,255,0.06)";

    ctx.lineWidth = 1;

    ctx.stroke();

    try {
      const icon =
        await loadImage(
          "/Biyaport-icon.svg"
        );

      const iconSize = 92;

      ctx.drawImage(
        icon,
        156,
        bottomContainerY +
          (bottomContainerHeight -
            iconSize) /
            2,
        iconSize,
        iconSize
      );
    } catch {
      ctx.fillStyle =
        "#1557E8";

      ctx.beginPath();

      ctx.arc(
        202,
        bottomContainerY +
          bottomContainerHeight / 2,
        40,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.textAlign = "left";

    ctx.font =
      `500 23px ${RECEIPT_FONT}`;

    ctx.fillStyle =
      "#ffffff";

    ctx.fillText(
      "Scan code to verify this",
      280,
      bottomContainerY + 67
    );

    ctx.fillText(
      "transaction on-chain",
      280,
      bottomContainerY + 101
    );

    const explorerUrl =
      `${BASESCAN_TX_URL}${transactionHash}`;

    const qrDataUrl =
      await QRCode.toDataURL(
        explorerUrl,
        {
          width: 120,
          margin: 1,
          errorCorrectionLevel:
            "M",
          color: {
            dark: "#050511",
            light: "#ffffff",
          },
        }
      );

    const qrImage =
      await loadImage(
        qrDataUrl
      );

    const qrContainerSize = 130;

    const qrContainerX =
      bottomContainerX +
      bottomContainerWidth -
      qrContainerSize -
      10;

    const qrContainerY =
      bottomContainerY +
      (bottomContainerHeight -
        qrContainerSize) / 2;

    ctx.beginPath();

    roundRect(
      ctx,
      qrContainerX,
      qrContainerY,
      qrContainerSize,
      qrContainerSize,
      16
    );

    ctx.fillStyle =
      "#ffffff";

    ctx.fill();

    ctx.drawImage(
      qrImage,
      qrContainerX + 5,
      qrContainerY + 5,
      120,
      120
    );

    ctx.textAlign = "center";

    ctx.font =
      `400 22px ${RECEIPT_FONT}`;

    ctx.fillStyle =
      "#aaaab5";

    ctx.fillText(
      "Send crypto to Nigerian bank accounts, No wallet needed for recipients.",
      width / 2,
      1365
    );

    const blob =
      await new Promise<Blob | null>(
        (resolve) =>
          canvas.toBlob(
            resolve,
            "image/png"
          )
      );

    if (!blob) {
      throw new Error(
        "Unable to create receipt file."
      );
    }

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href = url;

    anchor.download =
      `biyaport-receipt-${transactionHash.slice(
        0,
        10
      )}.png`;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(
      "RECEIPT GENERATION ERROR:",
      error
    );
  }
}

/*
 * ====================================================
 * RECEIPT ROW
 * ====================================================
 */

function drawReceiptRow(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  labelX: number,
  valueX: number,
  y: number
) {
  ctx.textAlign = "left";

  ctx.font =
    `400 25px ${RECEIPT_FONT}`;

  ctx.fillStyle = "#aaaab5";

  ctx.fillText(
    label,
    labelX,
    y
  );

  ctx.textAlign = "right";

  ctx.font =
    `600 25px ${RECEIPT_FONT}`;

  ctx.fillStyle = "#ffffff";

  const maxWidth =
    valueX - labelX - 300;

  let displayValue = value;

  while (
    ctx.measureText(
      displayValue
    ).width > maxWidth &&
    displayValue.length > 5
  ) {
    displayValue =
      displayValue.slice(
        0,
        -1
      );
  }

  if (
    displayValue !== value
  ) {
    displayValue =
      displayValue.slice(
        0,
        -3
      ) + "...";
  }

  ctx.fillText(
    displayValue,
    valueX,
    y
  );
}

/*
 * ====================================================
 * DASHED LINE
 * ====================================================
 */

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  ctx.save();

  ctx.setLineDash([
    8,
    8,
  ]);

  ctx.strokeStyle =
    "rgba(255,255,255,0.14)";

  ctx.lineWidth = 2;

  ctx.beginPath();

  ctx.moveTo(
    x1,
    y1
  );

  ctx.lineTo(
    x2,
    y2
  );

  ctx.stroke();

  ctx.restore();
}

/*
 * ====================================================
 * ROUNDED RECT
 * ====================================================
 */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r =
    Math.min(
      radius,
      width / 2,
      height / 2
    );

  ctx.moveTo(
    x + r,
    y
  );

  ctx.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    r
  );

  ctx.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    r
  );

  ctx.arcTo(
    x,
    y + height,
    x,
    y,
    r
  );

  ctx.arcTo(
    x,
    y,
    x + width,
    y,
    r
  );

  ctx.closePath();
}

/*
 * ====================================================
 * LOAD IMAGE
 * ====================================================
 */

function loadImage(
  src: string
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image =
        new window.Image();

      image.onload = () =>
        resolve(image);

      image.onerror = reject;

      image.src = src;
    }
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
    <main className="relative min-h-screen overflow-hidden bg-[#050511]">

      <Background />

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

    </main>
  );
}

/*
 * ====================================================
 * BACKGROUND
 * ====================================================
 */

function Background() {
  return (
    <>
      <div
        className="pointer-events-none absolute left-1/2 top-[-12vw] h-[55vw] w-[100vw] max-h-[500px] max-w-[900px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(21,87,232,.16) 0%, rgba(21,87,232,.07) 28%, rgba(21,87,232,0) 68%)",
        }}
      />

      <div
        className="pointer-events-none absolute left-1/2 top-[-58vw] h-[66vw] w-[66vw] max-h-[952px] max-w-[952px] -translate-x-1/2 rounded-full"
        style={{
          border:
            "1px solid rgba(21,87,232,.16)",
        }}
      />

      <div
        className="pointer-events-none absolute left-1/2 top-[-68vw] h-[89vw] w-[89vw] max-h-[1276px] max-w-[1276px] -translate-x-1/2 rounded-full"
        style={{
          border:
            "1px solid rgba(21,87,232,.14)",
        }}
      />
    </>
  );
}