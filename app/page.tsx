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
  Copy,
  Wallet,
  Share2,
  Download,
  ArrowRight,
  RefreshCw,
  ArrowLeftRight,
  CreditCard,
  History,
  Home as HomeIcon,
  Coins,
  Settings,
  Menu,
  X,
} from "lucide-react";

import {
  usePrivy,
  useSendTransaction,
  useWallets,
} from "@privy-io/react-auth";

import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  maxUint256,
  parseUnits,
  createPublicClient,
  http,
  keccak256,
  stringToHex,
} from "viem";

import { base, baseSepolia, bsc } from "viem/chains";

import QRCode from "qrcode";

import { ConnectWalletButton } from "@/components/wallet/connect-wallet";
import { QuickSendWalletButton } from "@/components/wallet/quick-send-wallet";

/*
 * ====================================================
 * CONSTANTS
 * ====================================================
 */

const BASE_CHAIN_ID = 8453;
const BSC_CHAIN_ID = 56;

const BASE_USDT_ADDRESS =
  "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as `0x${string}`;

const BASE_USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

const BSC_USDT_ADDRESS =
  "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`;

const BSC_USDC_ADDRESS =
  "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as `0x${string}`;

const USDT_DECIMALS = 6;
const USDC_DECIMALS = 6;

const BSC_USDT_DECIMALS = 18;
const BSC_USDC_DECIMALS = 18;

const BASESCAN_TX_URL =
  "https://basescan.org/tx/";

const BSCSCAN_TX_URL =
  "https://bscscan.com/tx/";

const RECEIPT_FONT = '"DM Sans", sans-serif';

/*
 * ====================================================
 * B-CODES
 * ====================================================
 *
 * B-Codes are currently being integrated/tested on Base
 * Sepolia. Quick Port keeps its existing Base/BSC config.
 */
const BCODE_CHAIN_ID = 84532;
const BCODE_CONTRACT_ADDRESS =
  "0x8a7826FDBBE26CB8Fced97893A4144997F0fE74D" as `0x${string}`;
const BCODE_BASE_SEPOLIA_USDT =
  "0x2C6c7c00ACa9B9D8446d107367485079b0471706" as `0x${string}`;
const BCODE_BASE_SEPOLIA_USDC =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
const BCODE_TOKEN_DECIMALS = 6;
const BCODE_FEE_BPS = 200;
const BCODE_BPS_DENOMINATOR = 10_000;
const BCODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BCODE_APP_PARAM = "bcode";

const BCODE_CONTRACT_ABI = [
  {
  type: "function",
  name: "getBCode",
  stateMutability: "view",
  inputs: [
    {
      name: "codeHash",
      type: "bytes32",
    },
  ],
  outputs: [
    {
      name: "creator",
      type: "address",
    },
    {
      name: "token",
      type: "address",
    },
    {
      name: "amount",
      type: "uint256",
    },
    {
      name: "redeemed",
      type: "bool",
    },
    {
      name: "cancelled",
      type: "bool",
    },
    {
      name: "code",
      type: "string",
    },
  ],
},

  {
    type: "function",
    name: "getBCodeHashesByCreator",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },

  {
    type: "function",
    name: "cancelBCode",
    stateMutability: "nonpayable",
    inputs: [{ name: "codeHash", type: "bytes32" }],
    outputs: [],
  },

  {
    type: "function",
    name: "isRedeemable",
    stateMutability: "view",
    inputs: [{ name: "codeHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },

  {
    type: "function",
    name: "creationNonces",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },

  {
    type: "function",
    name: "createBCodeWithSignature",
    stateMutability: "nonpayable",
    inputs: [
      { name: "creator", type: "address" },
      { name: "codeHash", type: "bytes32" },
      { name: "code", type: "string" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const BCODE_PUBLIC_CLIENT = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
});

const getBCodeTokenConfig = (symbol: "USDT" | "USDC") =>
  symbol === "USDT"
    ? {
        address: BCODE_BASE_SEPOLIA_USDT,
        decimals: BCODE_TOKEN_DECIMALS,
        logo: "/usdt-logo.svg",
        name: "Tether USD",
        symbol: "USDT" as const,
      }
    : {
        address: BCODE_BASE_SEPOLIA_USDC,
        decimals: BCODE_TOKEN_DECIMALS,
        logo: "/usdc-logo.svg",
        name: "USD Coin",
        symbol: "USDC" as const,
      };

function generateBCodeValue() {
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);

  let first = "";
  let second = "";

  for (let i = 0; i < 4; i += 1) {
    first += BCODE_CHARSET[values[i] % BCODE_CHARSET.length];
    second += BCODE_CHARSET[values[i + 4] % BCODE_CHARSET.length];
  }

  return `B-${first}-${second}`;
}

function hashBCodeForClient(code: string) {
  return keccak256(stringToHex(code.trim().toUpperCase()));
}

function isValidBCodeFormat(code: string) {
  return /^B-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(
    code.trim().toUpperCase()
  );
}


type NetworkKey = "base" | "bnb-smart-chain" | "base-sepolia";

type NetworkConfig = {
  key: NetworkKey;
  name: string;
  shortName: string;
  chainId: number;
  chain: typeof base | typeof bsc;
  explorerTx: string;
  logo: string;
};

const NETWORKS: NetworkConfig[] = [
  {
    key: "base",
    name: "Base",
    shortName: "Base",
    chainId: BASE_CHAIN_ID,
    chain: base,
    explorerTx: BASESCAN_TX_URL,
    logo: "/base-logo.svg",
  },
  {
    key: "bnb-smart-chain",
    name: "BNB Smart Chain",
    shortName: "BNB Chain",
    chainId: BSC_CHAIN_ID,
    chain: bsc,
    explorerTx: BSCSCAN_TX_URL,
    logo: "/bsc-logo.svg",
  },
];

const getNetworkConfig = (
  network: NetworkKey
) =>
  NETWORKS.find(
    (item) => item.key === network
  ) || NETWORKS[0];

const getTokenConfig = (
  network: NetworkKey,
  symbol: "USDT" | "USDC"
) => {
  if (network === "base") {
    return symbol === "USDT"
      ? {
          address: BASE_USDT_ADDRESS,
          decimals: USDT_DECIMALS,
        }
      : {
          address: BASE_USDC_ADDRESS,
          decimals: USDC_DECIMALS,
        };
  }

  return symbol === "USDT"
    ? {
        address: BSC_USDT_ADDRESS,
        decimals: BSC_USDT_DECIMALS,
      }
    : {
        address: BSC_USDC_ADDRESS,
        decimals: BSC_USDC_DECIMALS,
      };
};

const getPublicClient = (network: NetworkKey) =>
  createPublicClient({
    chain: getNetworkConfig(network).chain,
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

type CryptoSymbol = "USDT" | "USDC" | "ETH" | "BNB";

type CryptoOption = {
  symbol: CryptoSymbol;
  name: string;
  network: NetworkKey;
  address: `0x${string}` | null;
  decimals: number;
  logo: string;
};

type TokenBalance = {
  USDT: string;
  USDC: string;
  ETH?: string;
  BNB?: string;
};

type CurrencyCode = "NGN" | "KES";

type PaymentState =
  | "form"
  | "processing"
  | "success"
  | "error";

type PaymentStage = 1 | 2 | 3;

type OnrampState =
  | "idle"
  | "creating"
  | "awaiting-transfer"
  | "processing"
  | "success"
  | "error";

type OnrampPaymentAccount = {
  institution?: string;
  bankName?: string;
  accountIdentifier?: string;
  accountNumber?: string;
  accountName?: string;
  amountToTransfer?: string | number;
  validUntil?: string;
};

type OnrampOrder = {
  id?: string;
  orderId?: string;
  amount?: string | number;
  amountIn?: string;
  amountToReceive?: string | number;
  cryptoAmount?: string | number;
  rate?: string | number;
  paymentAccount?: OnrampPaymentAccount;
  providerAccount?: OnrampPaymentAccount;
  validUntil?: string;
};

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
    decimals: USDT_DECIMALS,
    logo: "/usdt-logo.svg",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    network: "base",
    address: BASE_USDC_ADDRESS,
    decimals: USDC_DECIMALS,
    logo: "/usdc-logo.svg",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    network: "base",
    address: null,
    decimals: 18,
    logo: "/eth-logo.svg",
  },

  {
    symbol: "USDT",
    name: "Tether USD",
    network: "bnb-smart-chain",
    address: BSC_USDT_ADDRESS,
    decimals: BSC_USDT_DECIMALS,
    logo: "/usdt-logo.svg",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    network: "bnb-smart-chain",
    address: BSC_USDC_ADDRESS,
    decimals: BSC_USDC_DECIMALS,
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
  symbol: string;
}[] = [
  {
    code: "NGN",
    name: "Nigerian naira",
    flag: "/nigeria-flag.svg",
    symbol: "₦",
  },
  {
    code: "KES",
    name: "Kenyan shillings",
    flag: "/kenya-flag.svg",
    symbol: "KSh",
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

  const [mainView, setMainView] =
    useState<"quickport" | "bcodes" | "swap">("quickport");

  const [bcodeDeepLink, setBcodeDeepLink] =
    useState("");

/*
   * ------------------------------------------------
   * B-CODE DEEP LINK
   * ------------------------------------------------
   */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get(BCODE_APP_PARAM);

    if (code && isValidBCodeFormat(code)) {
      setBcodeDeepLink(code.trim().toUpperCase());
      setMainView("bcodes");
    }
  }, []);

  const openBCodes = () => {
    setMainView("bcodes");
  };

  const backToQuickPort = () => {
    setMainView("quickport");
    setBcodeDeepLink("");

    const url = new URL(window.location.href);
    url.searchParams.delete(BCODE_APP_PARAM);
    window.history.replaceState({}, "", url.toString());
  };

  const handleQuickPortNavigation = () => {
    backToQuickPort();
  };

  const handleBCodesNavigation = () => {
    openBCodes();
  };

  const openSwap = () => {
    setMainView("swap");
  };

  const handleSwapNavigation = () => {
    openSwap();
  };

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
   * OFFRAMP FORM STATE
   * ------------------------------------------------
   */

  const [step, setStep] = useState(1);

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

  const [accountNumber, setAccountNumber] =
    useState("");

  const [accountName, setAccountName] =
    useState("");

  const [verifyingAccount, setVerifyingAccount] =
    useState(false);

  const [accountError, setAccountError] =
    useState("");

  /*
   * ------------------------------------------------
   * OFFRAMP PAYMENT INPUT
   * ------------------------------------------------
   */

  const [amount, setAmount] = useState("");

  const [selectedCrypto, setSelectedCrypto] =
    useState<CryptoOption | null>(null);

  const [cryptoDropdownOpen, setCryptoDropdownOpen] =
    useState(false);

  const [cryptoSearch, setCryptoSearch] =
    useState("");

  const [cryptoAmount, setCryptoAmount] =
    useState("");

  const [loadingQuote, setLoadingQuote] =
    useState(false);

  const [settlementAmount, setSettlementAmount] =
    useState<number | null>(null);

  const [quoteError, setQuoteError] =
    useState("");

  /*
   * ------------------------------------------------
   * TOKEN BALANCES
   * ------------------------------------------------
   */

  const [tokenBalances, setTokenBalances] =
    useState<TokenBalance>({
      USDT: "0.00",
      USDC: "0.00",
    });

  const [loadingBalances, setLoadingBalances] =
    useState(false);

  /*
   * ------------------------------------------------
   * NETWORK
   * ------------------------------------------------
   */

  const [selectedNetwork, setSelectedNetwork] =
    useState<NetworkKey>("base");

  const handleNetworkChange = (network: NetworkKey) => {
    setSelectedNetwork(network);
    setSelectedCrypto(null);
    setCryptoSearch("");
    setCryptoAmount("");
    setQuoteError("");
    setPaymentError("");
    setOnrampCryptoSearch("");
    setOnrampCryptoAmount("");
    setOnrampLocalAmount("");
    setOnrampRate("");
    setOnrampQuoteError("");
  };

  /*
   * ------------------------------------------------
   * OFFRAMP PAYMENT STATE
   * ------------------------------------------------
   */

  const [paymentState, setPaymentState] =
    useState<PaymentState>("form");

  const [paymentStage, setPaymentStage] =
    useState<PaymentStage>(1);

  const [paymentError, setPaymentError] =
    useState("");

  const [transactionHash, setTransactionHash] =
    useState("");

  const [orderId, setOrderId] =
    useState("");

  const [countdown, setCountdown] =
    useState(60);

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
   * ====================================================
   * ONRAMP STATE
   * ====================================================
   */

  const [onrampStep, setOnrampStep] =
    useState<1 | 2 | 3>(1);

  const [onrampCryptoAmount, setOnrampCryptoAmount] =
    useState("");

  const [onrampLocalAmount, setOnrampLocalAmount] =
    useState("");

  const [onrampRate, setOnrampRate] =
    useState("");

  const [onrampWalletAddress, setOnrampWalletAddress] =
    useState("");

  const [onrampQuoteLoading, setOnrampQuoteLoading] =
    useState(false);

  const [onrampQuoteError, setOnrampQuoteError] =
    useState("");

  const [onrampState, setOnrampState] =
    useState<OnrampState>("idle");

  const [onrampOrderId, setOnrampOrderId] =
    useState("");

  const [onrampPaymentAccount, setOnrampPaymentAccount] =
    useState<OnrampPaymentAccount | null>(null);

  const [onrampPaymentAmount, setOnrampPaymentAmount] =
    useState("");

  const [onrampExpiry, setOnrampExpiry] =
    useState<string | null>(null);

  const [onrampCountdown, setOnrampCountdown] =
    useState(0);

  const [onrampError, setOnrampError] =
    useState("");

  const [onrampStatusMessage, setOnrampStatusMessage] =
    useState("");

  const [onrampRefundBank, setOnrampRefundBank] =
    useState<Institution | null>(null);

  const [onrampRefundAccountNumber, setOnrampRefundAccountNumber] =
    useState("");

  const [onrampRefundAccountName, setOnrampRefundAccountName] =
    useState("");

  const [onrampRefundVerifying, setOnrampRefundVerifying] =
    useState(false);

  const [onrampRefundError, setOnrampRefundError] =
    useState("");

  const [onrampBankDropdownOpen, setOnrampBankDropdownOpen] =
    useState(false);

  const [onrampBankSearch, setOnrampBankSearch] =
    useState("");

  const [onrampCryptoDropdownOpen, setOnrampCryptoDropdownOpen] =
    useState(false);

  const [onrampCryptoSearch, setOnrampCryptoSearch] =
    useState("");

  const [onrampSenderFee, setOnrampSenderFee] =
    useState("");

  /*
   * ====================================================
   * REFS
   * ====================================================
   */

  const bankDropdownRef =
    useRef<HTMLDivElement | null>(null);

  const cryptoDropdownRef =
  useRef<HTMLDivElement | null>(null);


  const currencyDropdownRef =
    useRef<HTMLDivElement | null>(null);

  const onrampBankDropdownRef =
    useRef<HTMLDivElement | null>(null);

  const onrampCryptoDropdownRef =
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
   * LOAD BANKS
   * ====================================================
   */

  useEffect(() => {
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
}, []);

  /*
   * ====================================================
   * TOKEN BALANCES
   * ====================================================
   */

  const refreshTokenBalances = async () => {
  if (!wallet?.address) {
    setTokenBalances({
      USDT: "0.00",
      USDC: "0.00",
      ETH: "0.00",
    });

    return;
  }

  setLoadingBalances(true);

  try {
    const client = getPublicClient(selectedNetwork);
    const usdtConfig = getTokenConfig(
      selectedNetwork,
      "USDT"
    );
    const usdcConfig = getTokenConfig(
      selectedNetwork,
      "USDC"
    );

    const [
      usdtBalance,
      usdcBalance,
      ethBalance,
    ] = await Promise.all([
      client.readContract({
        address: usdtConfig.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [
          wallet.address as `0x${string}`,
        ],
      }),

      client.readContract({
        address: usdcConfig.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [
          wallet.address as `0x${string}`,
        ],
      }),

      client.getBalance({
        address:
          wallet.address as `0x${string}`,
      }),
    ]);

    setTokenBalances({
      USDT: Number(
        formatUnits(
          usdtBalance,
          usdtConfig.decimals
        )
      ).toFixed(2),

      USDC: Number(
        formatUnits(
          usdcBalance,
          usdcConfig.decimals
        )
      ).toFixed(2),

      ETH: Number(
        formatUnits(
          ethBalance,
          18
        )
      ).toFixed(4),
    });
  } catch (error) {
    console.error(
      "TOKEN BALANCE ERROR:",
      error
    );

    setTokenBalances({
      USDT: "0.00",
      USDC: "0.00",
      ETH: "0.00",
    });
  } finally {
    setLoadingBalances(false);
  }
};

  useEffect(() => {
    if (!authenticated || !wallet?.address) {
      setTokenBalances({
      USDT: "0.00",
      USDC: "0.00",
      ETH: "0.00",
    });

      return;
    }

    refreshTokenBalances();
  }, [
    authenticated,
    wallet?.address,
    selectedNetwork,
  ]);

  /*
   * ====================================================
   * RESET WHEN WALLET DISCONNECTS
   * ====================================================
   */

  useEffect(() => {
    if (authenticated && wallet?.address) {
      return;
    }

    setStep(1);

    setSelectedBank(null);
    setBankDropdownOpen(false);
    setBankSearch("");

    setAccountNumber("");
    setAccountName("");
    setAccountError("");
    setVerifyingAccount(false);

    setSelectedCrypto(null);
    setCryptoDropdownOpen(false);
    setCryptoSearch("");

    setAmount("");
    setCryptoAmount("");
    setLoadingQuote(false);
    setQuoteError("");

    setPaymentState("form");
    setPaymentStage(1);
    setPaymentError("");

    setTransactionHash("");
    setOrderId("");

    setReceiptCryptoAmount("");
    setReceiptDateTime("");

    setCountdown(60);

    setTokenBalances({
      USDT: "0.00",
      USDC: "0.00",
    });

    resetOnramp();
  }, [
    authenticated,
    wallet?.address,
  ]);

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

      if (
        onrampBankDropdownRef.current &&
        !onrampBankDropdownRef.current.contains(target)
      ) {
        setOnrampBankDropdownOpen(false);
      }

      if (
        onrampCryptoDropdownRef.current &&
        !onrampCryptoDropdownRef.current.contains(target)
      ) {
        setOnrampCryptoDropdownOpen(false);
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
   * OFFRAMP COUNTDOWN
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
   * ONRAMP EXPIRY COUNTDOWN
   * ====================================================
   */

  useEffect(() => {
    if (!onrampExpiry) {
      setOnrampCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const expiryTime =
        new Date(onrampExpiry).getTime();

      const remaining = Math.max(
        0,
        Math.floor(
          (expiryTime - Date.now()) / 1000
        )
      );

      setOnrampCountdown(remaining);
    };

    updateCountdown();

    const interval = setInterval(
      updateCountdown,
      1000
    );

    return () =>
      clearInterval(interval);
  }, [onrampExpiry]);

  /*
   * ====================================================
   * BANK SEARCH
   * ====================================================
   */

  const filteredInstitutions =
    institutions.filter((bank) =>
      bank.name
        .toLowerCase()
        .includes(
          bankSearch.toLowerCase()
        )
    );

  const filteredOnrampInstitutions =
    institutions.filter((bank) =>
      bank.name
        .toLowerCase()
        .includes(
          onrampBankSearch.toLowerCase()
        )
    );

  /*
   * ====================================================
   * OFFRAMP BANK SELECT
   * ====================================================
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
   * ====================================================
   * VERIFY OFFRAMP ACCOUNT
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

      const verifiedName =
        data?.data;

      if (
        !verifiedName ||
        typeof verifiedName !== "string"
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

  /*
   * ====================================================
   * OFFRAMP ACCOUNT NUMBER
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
   * OFFRAMP NEXT
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
   * OFFRAMP BACK
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
      crypto.network === selectedNetwork &&
      (
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
      )
  );

  const filteredOnrampCryptoOptions =
  CRYPTO_OPTIONS.filter(
    (crypto) =>
      crypto.network === selectedNetwork &&
      (
        crypto.symbol
          .toLowerCase()
          .includes(
            onrampCryptoSearch.toLowerCase()
          ) ||
        crypto.name
          .toLowerCase()
          .includes(
            onrampCryptoSearch.toLowerCase()
          )
      )
  );

  /*
   * ====================================================
   * OFFRAMP CRYPTO
   * ====================================================
   */

  const handleCryptoSelect = (
    crypto: CryptoOption
    ) => {
    setSelectedNetwork(crypto.network);
    setSelectedCrypto(crypto);
    setCryptoDropdownOpen(false);

    setCryptoSearch("");
    setCryptoAmount("");
    setQuoteError("");
    setPaymentError("");
  };

  /*
   * ====================================================
   * OFFRAMP NAIRA AMOUNT
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
   * OFFRAMP CRYPTO QUOTE
   * ====================================================
   */

  useEffect(() => {
    if (
      tradeMode !== "sell" ||
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
          network:
            selectedCrypto.network,
          currency:
            selectedCurrency,
          nairaAmount:
            Number(amount),
          walletAddress:
            wallet?.address,
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

const returnedSettlementAmount =
  Number(data?.settlementAmount);

if (
  selectedCrypto.symbol === "ETH" &&
  (!Number.isFinite(
    returnedSettlementAmount
  ) ||
    returnedSettlementAmount <= 0)
) {
  throw new Error(
    "Invalid USDC settlement amount returned for ETH."
  );
}

if (!cancelled) {
  setCryptoAmount(
    value.toFixed(6)
  );

  setSettlementAmount(
    selectedCrypto.symbol === "ETH"
      ? returnedSettlementAmount
      : null
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
  }, [
    amount,
    selectedCrypto,
    tradeMode,
  ]);

  /*
   * ====================================================
   * OFFRAMP DISPLAY PAYMENT AMOUNT
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

  const showPayButton =
    !!selectedCrypto &&
    !!amount &&
    Number(amount) > 0 &&
    !!cryptoAmount &&
    !loadingQuote &&
    !quoteError;

  /*
   * ====================================================
   * ONRAMP CRYPTO SELECT
   * ====================================================
   */

  const handleOnrampCryptoSelect = (
    crypto: CryptoOption
  ) => {
    setSelectedNetwork(crypto.network);
    setSelectedCrypto(crypto);
    setOnrampCryptoDropdownOpen(false);
    setOnrampCryptoSearch("");

    setOnrampCryptoAmount("");
    setOnrampLocalAmount("");
    setOnrampRate("");
    setOnrampQuoteError("");
  };

  /*
   * ====================================================
   * ONRAMP CRYPTO AMOUNT
   * ====================================================
   */

  const handleOnrampCryptoAmountChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value =
      event.target.value.replace(
        /[^0-9.]/g,
        ""
      );

    setOnrampCryptoAmount(value);
    setOnrampLocalAmount("");
    setOnrampRate("");
    setOnrampQuoteError("");
  };

  /*
   * ====================================================
   * ONRAMP QUOTE
   *
   * IMPORTANT:
   * The amount entered here is crypto.
   *
   * Example:
   * 1 USDT -> backend fetches Paycrest rate
   * -> converts 1 USDT to NGN/KES
   * -> returns local currency amount.
   * ====================================================
   */

  useEffect(() => {
  if (
    tradeMode !== "buy" ||
    !selectedCrypto ||
    !onrampCryptoAmount ||
    Number(onrampCryptoAmount) <= 0
  ) {
    setOnrampLocalAmount("");
    setOnrampSenderFee("");
    return;
  }

  let cancelled = false;

  const getOnrampQuote = async () => {
    setOnrampQuoteLoading(true);
    setOnrampQuoteError("");

    try {
      const response = await fetch(
        "/api/onramp/quote",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Number(onrampCryptoAmount),
            crypto: selectedCrypto.symbol,
            network: selectedCrypto.network,
            currency: selectedCurrency,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Unable to get onramp quote."
        );
      }

      /*
       * Paycrest quote
       *
       * IMPORTANT:
       * Keep this as the ORIGINAL Paycrest quote.
       *
       * Do NOT add the 5% here.
       *
       * Example:
       * Paycrest quote = ₦1,385.78
       * onrampLocalAmount = ₦1,385.78
       */
      const localAmount = Number(
        data?.localAmount ??
          data?.fiatAmount ??
          data?.amountToPay ??
          data?.amount
      );

      if (
        !Number.isFinite(localAmount) ||
        localAmount <= 0
      ) {
        throw new Error(
          "Invalid local currency amount returned."
        );
      }

      if (!cancelled) {
        /*
         * Store ONLY the Paycrest quote.
         *
         * Do NOT multiply by 1.05 here.
         */
        setOnrampLocalAmount(
          localAmount.toFixed(2)
        );

        /*
         * Sender fee is not used here.
         *
         * Paycrest will return the actual
         * amountToTransfer when the order
         * is created.
         */
        setOnrampSenderFee("");

        if (
          data?.rate !== undefined &&
          data?.rate !== null
        ) {
          setOnrampRate(
            String(data.rate)
          );
        }
      }
    } catch (error) {
      if (!cancelled) {
        console.error(
          "ONRAMP QUOTE ERROR:",
          error
        );

        setOnrampLocalAmount("");
        setOnrampSenderFee("");

        setOnrampQuoteError(
          error instanceof Error
            ? error.message
            : "Unable to get onramp quote."
        );
      }
    } finally {
      if (!cancelled) {
        setOnrampQuoteLoading(false);
      }
    }
  };

  const timeout = setTimeout(
    getOnrampQuote,
    500
  );

  return () => {
    cancelled = true;
    clearTimeout(timeout);
  };
}, [
  onrampCryptoAmount,
  selectedCrypto,
  selectedCurrency,
  tradeMode,
]);
/*
   * ====================================================
   * ONRAMP REFUND BANK SELECT
   * ====================================================
   */

  const handleOnrampRefundBankSelect = (
    bank: Institution
  ) => {
    setOnrampRefundBank(bank);
    setOnrampBankDropdownOpen(false);
    setOnrampBankSearch("");

    setOnrampRefundAccountNumber("");
    setOnrampRefundAccountName("");
    setOnrampRefundError("");
  };

  /*
   * ====================================================
   * ONRAMP REFUND ACCOUNT VERIFICATION
   * ====================================================
   */

  const verifyOnrampRefundAccount = async (
    value: string
  ) => {
    if (
      !onrampRefundBank ||
      value.length !== 10
    ) {
      return;
    }

    setOnrampRefundVerifying(true);
    setOnrampRefundAccountName("");
    setOnrampRefundError("");

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
              onrampRefundBank.code,
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

      const verifiedName =
        data?.data;

      if (
        !verifiedName ||
        typeof verifiedName !== "string"
      ) {
        throw new Error(
          "Account name could not be retrieved."
        );
      }

      setOnrampRefundAccountName(
        verifiedName
      );
    } catch (error) {
      console.error(
        "ONRAMP REFUND ACCOUNT ERROR:",
        error
      );

      setOnrampRefundAccountName("");

      setOnrampRefundError(
        error instanceof Error
          ? error.message
          : "Unable to verify account."
      );
    } finally {
      setOnrampRefundVerifying(false);
    }
  };

  /*
   * ====================================================
   * ONRAMP REFUND ACCOUNT NUMBER
   * ====================================================
   */

  const handleOnrampRefundAccountNumberChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value =
      event.target.value
        .replace(/\D/g, "")
        .slice(0, 10);

    setOnrampRefundAccountNumber(
      value
    );

    setOnrampRefundAccountName("");
    setOnrampRefundError("");

    if (value.length === 10) {
      verifyOnrampRefundAccount(value);
    }
  };

  /*
   * ====================================================
   * ONRAMP MODAL 1 CONTINUE
   * ====================================================
   */

  const handleOnrampStepOneContinue = () => {
    if (
      !selectedCrypto ||
      !onrampCryptoAmount ||
      Number(onrampCryptoAmount) <= 0 ||
      !onrampLocalAmount ||
      !onrampWalletAddress
    ) {
      return;
    }

    const validAddress =
      /^0x[a-fA-F0-9]{40}$/.test(
        onrampWalletAddress.trim()
      );

    if (!validAddress) {
      setOnrampQuoteError(
        `Please enter a valid ${getNetworkConfig(selectedNetwork).name} wallet address.`
      );
      return;
    }

    setOnrampQuoteError("");
    setOnrampStep(2);
  };

  /*
   * ====================================================
   * ONRAMP MODAL 2 BACK
   * ====================================================
   */

  const handleOnrampBackToStepOne = () => {
    setOnrampStep(1);
    setOnrampError("");
  };

 /*
 * ====================================================
 * ONRAMP CREATE PAYCREST ORDER
 * ====================================================
 */

const handleCreateOnrampOrder = async () => {
  if (
    !selectedCrypto ||
    !onrampCryptoAmount ||
    !onrampLocalAmount ||
    !onrampWalletAddress ||
    !onrampRefundBank ||
    onrampRefundAccountNumber.length !== 10 ||
    !onrampRefundAccountName
  ) {
    return;
  }

  setOnrampError("");
  setOnrampStatusMessage("");
  setOnrampState("creating");

  try {
    const response = await fetch(
      "/api/onramp/transaction",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(onrampLocalAmount),
          amountIn: "fiat",
          currency: selectedCurrency,
          crypto: selectedCrypto.symbol,
          network: selectedCrypto.network,
          walletAddress: onrampWalletAddress.trim(),

          institution: onrampRefundBank.code,
          accountNumber: onrampRefundAccountNumber,
          accountName: onrampRefundAccountName,

          destination: {
            type: "crypto",
            currency: selectedCrypto.symbol,
            network: selectedCrypto.network,
            recipient: {
              address: onrampWalletAddress.trim(),
            },
          },

          reference: `biyaport-onramp-${Date.now()}`,
        }),
      }
    );

    const data = await response.json();

    console.log(
      "PAYCREST ONRAMP ORDER RESPONSE:",
      JSON.stringify(data, null, 2)
    );

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          "Unable to create onramp order."
      );
    }

    /*
     * The current Biyaport API returns:
     *
     * {
     *   success: true,
     *   order: {
     *     id: "...",
     *     providerAccount: {...}
     *   }
     * }
     *
     * Keep the fallbacks because this makes the
     * frontend tolerant of either wrapped or direct
     * Paycrest response shapes.
     */

    const order =
      data?.order ||
      data?.data ||
      data;

    console.log(
      "EXTRACTED PAYCREST ORDER:",
      JSON.stringify(order, null, 2)
    );

    const returnedOrderId =
      order?.orderId ||
      order?.id ||
      data?.data?.id ||
      data?.order?.id ||
      data?.orderId ||
      data?.id;

    const paymentAccount =
      order?.providerAccount ||
      data?.data?.providerAccount ||
      data?.order?.providerAccount ||
      data?.providerAccount;

    console.log(
      "EXTRACTED PAYCREST ORDER ID:",
      returnedOrderId
    );

    console.log(
      "EXTRACTED PAYCREST PROVIDER ACCOUNT:",
      JSON.stringify(paymentAccount, null, 2)
    );

    if (!returnedOrderId) {
      throw new Error(
        "Paycrest did not return an order ID."
      );
    }

    if (!paymentAccount) {
      throw new Error(
        "Paycrest did not return a payment account."
      );
    }

    const accountNumber =
      paymentAccount.accountIdentifier ||
      paymentAccount.accountNumber;

    const paymentAmount =
      paymentAccount.amountToTransfer ??
      data?.data?.amountToTransfer ??
      data?.amountToTransfer ??
      order?.amount;

    const validUntil =
      paymentAccount.validUntil ||
      order?.validUntil ||
      data?.data?.validUntil ||
      data?.validUntil;

    if (!accountNumber) {
      throw new Error(
        "Paycrest did not return the payment account number."
      );
    }

    if (
      paymentAmount === undefined ||
      paymentAmount === null
    ) {
      throw new Error(
        "Paycrest did not return the amount to transfer."
      );
    }

    /*
     * Store the Paycrest order ID.
     */
    setOnrampOrderId(
      String(returnedOrderId)
    );

    /*
     * Store provider bank account.
     */
    setOnrampPaymentAccount(
      paymentAccount
    );

    /*
     * Store exact amount Paycrest requires.
     */
    setOnrampPaymentAmount(
      String(paymentAmount)
    );

    /*
     * Store expiry time.
     */
    setOnrampExpiry(
      validUntil
        ? String(validUntil)
        : null
    );

    /*
     * Move to the payment instruction screen.
     */
    setOnrampStep(3);

    setOnrampState(
      "awaiting-transfer"
    );

    setOnrampStatusMessage(
      "Transfer the exact amount to the account shown below."
    );

    console.log(
      "BIYAPORT ONRAMP READY FOR BANK TRANSFER:",
      {
        orderId: String(returnedOrderId),
        accountNumber,
        paymentAmount: String(paymentAmount),
        validUntil: validUntil || null,
      }
    );
  } catch (error) {
    console.error(
      "ONRAMP ORDER ERROR:",
      error
    );

    setOnrampState("error");

    setOnrampError(
      error instanceof Error
        ? error.message
        : "Unable to create onramp order."
    );
  }
};


/*
 * ====================================================
 * ONRAMP STATUS
 * ====================================================
 *
 * Paycrest v2 order lifecycle includes:
 *
 * initiated
 * deposited
 * pending
 * fulfilling
 * fulfilled
 * validated
 * settling
 * settled
 * cancelled
 * refunding
 * refunded
 * expired
 *
 * For onramp, "settled" means the stablecoins
 * have been delivered and the order is complete.
 *
 * Paycrest recommends:
 *
 * GET /v2/sender/orders/:id
 *
 * or webhooks.
 */

const checkOnrampStatus =
  async () => {
    if (!onrampOrderId) {
      console.log(
        "ONRAMP STATUS: No order ID yet."
      );

      return;
    }

    try {
      console.log(
        "CHECKING PAYCREST ONRAMP STATUS:",
        onrampOrderId
      );

      const response =
        await fetch(
          `/api/onramp/status?orderId=${encodeURIComponent(
            onrampOrderId
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      console.log(
        "PAYCREST ONRAMP STATUS RESPONSE:",
        JSON.stringify(data, null, 2)
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Unable to check order status."
        );
      }

      /*
       * Support the possible response shapes:
       *
       * { status: "settled" }
       *
       * { data: { status: "settled" } }
       *
       * { order: { status: "settled" } }
       *
       * { data: { data: { status: "settled" } } }
       */

      const rawStatus =
        data?.status ||
        data?.data?.status ||
        data?.order?.status ||
        data?.data?.data?.status ||
        "";

      const status =
        String(rawStatus)
          .trim()
          .toLowerCase();

      console.log(
        "BIYAPORT NORMALIZED ONRAMP STATUS:",
        status
      );

      /*
       * --------------------------------------------
       * SUCCESS
       * --------------------------------------------
       *
       * Paycrest's documented final status is:
       *
       * settled
       */

      if (
        status === "settled" ||
        status === "completed" ||
        status === "success"
      ) {
        console.log(
          "BIYAPORT ONRAMP COMPLETE:",
          onrampOrderId
        );

        setOnrampState("success");

        setOnrampStatusMessage(
          "Your crypto has been sent to your wallet."
        );

        return;
      }

      /*
       * --------------------------------------------
       * FAILURE / REFUND
       * --------------------------------------------
       */

      if (
        status === "failed" ||
        status === "cancelled" ||
        status === "expired" ||
        status === "refunded"
      ) {
        console.error(
          "BIYAPORT ONRAMP FAILED:",
          {
            orderId: onrampOrderId,
            status,
            response: data,
          }
        );

        setOnrampState("error");

        setOnrampError(
          data?.message ||
            data?.error ||
            `Order ${status}.`
        );

        return;
      }

      /*
       * --------------------------------------------
       * REFUND IN PROGRESS
       * --------------------------------------------
       */

      if (status === "refunding") {
        setOnrampStatusMessage(
          "Your transfer could not be completed. Your refund is being processed."
        );

        return;
      }

      /*
       * --------------------------------------------
       * DEPOSIT DETECTED
       * --------------------------------------------
       */

      if (status === "deposited") {
        setOnrampStatusMessage(
          "Your bank transfer has been received. Processing your crypto..."
        );

        return;
      }

      /*
       * --------------------------------------------
       * PROVIDER PROCESSING
       * --------------------------------------------
       */

      if (
        status === "pending" ||
        status === "fulfilling" ||
        status === "fulfilled" ||
        status === "validated" ||
        status === "settling"
      ) {
        /*
         * Give the user a more accurate message
         * depending on where Paycrest says the order is.
         */

        if (status === "pending") {
          setOnrampStatusMessage(
            "Your bank transfer is being confirmed."
          );
        } else if (
          status === "fulfilling"
        ) {
          setOnrampStatusMessage(
            "Your bank transfer has been confirmed. Sending your crypto..."
          );
        } else if (
          status === "fulfilled" ||
          status === "validated"
        ) {
          setOnrampStatusMessage(
            "Your crypto transfer is being finalized..."
          );
        } else if (
          status === "settling"
        ) {
          setOnrampStatusMessage(
            "Your crypto has been sent. Finalizing the transaction..."
          );
        }

        return;
      }

      /*
       * --------------------------------------------
       * UNKNOWN STATUS
       * --------------------------------------------
       *
       * Don't falsely mark the order as failed.
       * Keep polling and expose the status in the
       * console so we can diagnose it.
       */

      console.warn(
        "UNKNOWN PAYCREST ONRAMP STATUS:",
        {
          orderId: onrampOrderId,
          status,
          response: data,
        }
      );

      setOnrampStatusMessage(
        "We're checking the status of your transaction..."
      );
    } catch (error) {
      /*
       * A temporary status request failure should
       * NOT mark the user's transaction as failed.
       *
       * The next polling attempt will retry it.
       */

      console.error(
        "ONRAMP STATUS ERROR:",
        error
      );
    }
  };


/*
 * ====================================================
 * ONRAMP "I HAVE MADE THE TRANSFER"
 * ====================================================
 */

const handleOnrampTransferMade =
  async () => {
    if (!onrampOrderId) {
      console.warn(
        "ONRAMP TRANSFER MADE: No order ID."
      );

      return;
    }

    console.log(
      "BIYAPORT USER CONFIRMED BANK TRANSFER:",
      onrampOrderId
    );

    setOnrampState(
      "processing"
    );

    setOnrampStatusMessage(
      "Waiting for your bank transfer to be confirmed."
    );

    /*
     * Check immediately instead of making the user
     * wait for the first 5-second polling interval.
     */
    await checkOnrampStatus();
  };


/*
 * ====================================================
 * ONRAMP POLLING
 * ====================================================
 *
 * Once the user clicks "I have made the transfer",
 * check Paycrest every 5 seconds.
 *
 * This continues until:
 *
 * success
 * error
 * or the component is unmounted.
 */

useEffect(() => {
  if (
    onrampState !== "processing" ||
    !onrampOrderId
  ) {
    return;
  }

  console.log(
    "BIYAPORT ONRAMP POLLING STARTED:",
    onrampOrderId
  );

  const interval =
    setInterval(() => {
      checkOnrampStatus();
    }, 5000);

  return () => {
    console.log(
      "BIYAPORT ONRAMP POLLING STOPPED:",
      onrampOrderId
    );

    clearInterval(interval);
  };
}, [
  onrampState,
  onrampOrderId,
]);


/*
 * ====================================================
 * RESET ONRAMP
 * ====================================================
 */

function resetOnramp() {
  setOnrampStep(1);

  setOnrampCryptoAmount("");
  setOnrampLocalAmount("");
  setOnrampRate("");
  setOnrampWalletAddress("");

  setOnrampQuoteLoading(false);
  setOnrampQuoteError("");

  setOnrampState("idle");
  setOnrampOrderId("");

  setOnrampPaymentAccount(null);
  setOnrampPaymentAmount("");
  setOnrampExpiry(null);
  setOnrampCountdown(0);

  setOnrampError("");
  setOnrampStatusMessage("");

  setOnrampRefundBank(null);
  setOnrampRefundAccountNumber("");
  setOnrampRefundAccountName("");
  setOnrampRefundVerifying(false);
  setOnrampRefundError("");

  setOnrampBankDropdownOpen(false);
  setOnrampBankSearch("");

  setOnrampCryptoDropdownOpen(false);
  setOnrampCryptoSearch("");
}


/*
 * ====================================================
 * OFFRAMP RESET
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

  setSelectedBank(null);
  setBankSearch("");

  setAccountNumber("");
  setAccountName("");
  setAccountError("");

  setSelectedCrypto(null);
  setCryptoSearch("");
  setCryptoAmount("");
  setAmount("");
  setQuoteError("");
};


/*
 * ====================================================
 * RESET WHEN WALLET AUTH CHANGES
 * ====================================================
 */

useEffect(() => {
  if (!authenticated) {
    resetPayment();
    resetOnramp();
  }
}, [authenticated]);
  /*
   * ====================================================
   * OFFRAMP PAYMENT
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
        "Please select a cryptocurrency."
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

    setPaymentState(
      "processing"
    );

    setPaymentStage(1);
    setCountdown(60);

    try {
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

          settlementAmount:
            selectedCrypto.symbol === "ETH"
              ? settlementAmount
              : undefined,
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

      setOrderId(
        data?.orderId || ""
      );

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

      const orderAmount =
        Number(
        data?.paycrestAmount ??
        data?.amount
      );

      const senderFee =
        Number(
          data?.senderFee ?? 0
        );

      const transactionFee =
        Number(
          data?.transactionFee ?? 0
        );

      if (
        !Number.isFinite(
          orderAmount
        ) ||
        orderAmount <= 0
      ) {
        throw new Error(
          "Paycrest returned an invalid order amount."
        );
      }

      if (
        !Number.isFinite(
          senderFee
        ) ||
        senderFee < 0
      ) {
        throw new Error(
          "Paycrest returned an invalid sender fee."
        );
      }

      if (
        !Number.isFinite(
          transactionFee
        ) ||
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

      const networkConfig = getNetworkConfig(
        selectedCrypto.network
      );

      if (wallet.switchChain) {
        await wallet.switchChain(
          networkConfig.chainId
        );
      }

      setPaymentStage(2);

let result;

if (selectedCrypto.symbol === "ETH") {
  const swapTransaction =
    data?.transaction;

  if (
    !swapTransaction?.to ||
    !swapTransaction?.data
  ) {
    throw new Error(
      "0x did not return a valid ETH swap transaction."
    );
  }

  result =
    await sendTransaction(
      {
        to:
          swapTransaction.to as `0x${string}`,

        data:
          swapTransaction.data as `0x${string}`,

        value:
          BigInt(
            swapTransaction.value ?? "0"
          ),

        chainId:
          networkConfig.chainId,
      },
      {
        address:
          wallet.address,
      }
    );
} else {
  const totalUnits =
    parseUnits(
      totalCryptoAmount.toFixed(
        selectedCrypto.decimals
      ),
      selectedCrypto.decimals
    );

  const transferData =
    encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [
        receiveAddress as `0x${string}`,
        totalUnits,
      ],
    });

  result =
    await sendTransaction(
      {
        to:
          selectedCrypto.address!,

        data:
          transferData,

        value:
          BigInt(0),

        chainId:
          networkConfig.chainId,
      },
      {
        address:
          wallet.address,
      }
    );
}

      const hash =
        result?.hash;

      if (!hash) {
        throw new Error(
          "Wallet transaction was not submitted."
        );
      }

      setTransactionHash(
        hash
      );

      setPaymentStage(3);

      if (selectedCrypto.symbol === "ETH") {
  const ethValue =
    BigInt(
      data?.transaction?.value ?? "0"
    );

  setReceiptCryptoAmount(
    formatUnits(
      ethValue,
      18
    )
  );
} else {
  setReceiptCryptoAmount(
    totalCryptoAmount.toFixed(
      selectedCrypto.decimals
    )
  );
}

      setReceiptDateTime(
        formatReceiptDate(
          new Date()
        )
      );

      await getPublicClient(
        selectedCrypto.network
      ).waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      await refreshTokenBalances();

      setPaymentState(
        "success"
      );
    } catch (error) {
      console.error(
        "PAYMENT ERROR:",
        error
      );

      setPaymentState(
        "error"
      );

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
    paymentState ===
    "processing"
  ) {
    const progressPercentage =
      paymentStage === 1
        ? 0
        : paymentStage === 2
        ? 50
        : 100;

    return (
      <PaymentShell
        onQuickPort={handleQuickPortNavigation}
        onBCodes={handleBCodesNavigation}
        onSwap={handleSwapNavigation}
      >
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
    paymentState ===
    "success"
  ) {
    return (
      <PaymentShell
        onQuickPort={handleQuickPortNavigation}
        onBCodes={handleBCodesNavigation}
        onSwap={handleSwapNavigation}
      >
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
                  network:
                    selectedCrypto?.network ||
                    "base",
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
    paymentState ===
    "error"
  ) {
    return (
      <PaymentShell
        onQuickPort={handleQuickPortNavigation}
        onBCodes={handleBCodesNavigation}
        onSwap={handleSwapNavigation}
      >
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
                setPaymentState(
                  "form"
                );
                setPaymentStage(
                  1
                );
                setPaymentError(
                  ""
                );
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
   * B-CODES VIEW
   * ====================================================
   */

  if (mainView === "bcodes") {
    return (
      <BCodeView
        initialRedeemCode={bcodeDeepLink}
        onBackHome={backToQuickPort}
      />
    );
  }

  if (mainView === "swap") {
    return <SwapView onBackHome={backToQuickPort} />;
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
        <SiteNav
          onQuickPort={handleQuickPortNavigation}
          onBCodes={handleBCodesNavigation}
          onSwap={handleSwapNavigation}
        />

        <section className="flex min-h-screen items-start justify-center px-4 pb-10 pt-[112px] sm:px-6 sm:pt-[128px]">
          <div className="flex w-full max-w-[590px] flex-col items-center">

            <div className="w-full rounded-[16px] border border-border bg-card p-5">

              {!(
  tradeMode === "buy" &&
  onrampStep === 3 
) && (
  <>
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
                  key={currency.code}
                  type="button"
                  onClick={() => {
                    setSelectedCurrency(
                      currency.code
                    );

                    setCurrencyDropdownOpen(
                      false
                    );

                    if (
                      tradeMode ===
                      "buy"
                    ) {
                      setOnrampLocalAmount(
                        ""
                      );
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-[8px] px-3 py-3 text-left transition hover:bg-secondary"
                >
                  <Image
                    src={currency.flag}
                    alt=""
                    width={22}
                    height={22}
                    className="h-[22px] w-[22px] rounded-full object-cover"
                  />

                  <div className="flex flex-1 flex-col">
                    <span className="text-[14px] font-medium">
                      {currency.code}
                    </span>

                    <span className="text-[12px] text-muted-foreground">
                      {currency.name}
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
        onClick={() => {
          setTradeMode("buy");
          setSelectedCrypto(null);
          setOnrampStep(1);
          setPaymentState("form");
          setPaymentError("");
        }}
        className={`flex flex-1 items-center justify-center rounded-[9px] text-[14px] font-semibold transition sm:text-[15px] ${
          tradeMode === "buy"
            ? "bg-[#050511] text-foreground shadow-sm"
            : "text-muted-foreground"
        }`}
      >
        Buy Crypto
      </button>

      <button
        type="button"
        onClick={() => {
          setTradeMode("sell");
          setSelectedCrypto(null);
          setOnrampStep(1);
          setOnrampState("idle");
          setPaymentError("");
        }}
        className={`flex flex-1 items-center justify-center rounded-[9px] text-[14px] font-semibold transition sm:text-[15px] ${
          tradeMode === "sell"
            ? "bg-[#050511] text-foreground shadow-sm"
            : "text-muted-foreground"
        }`}
      >
        Sell Crypto
      </button>

    </div>
  </>
)}

              {/* =================================================
                  ONRAMP
                 ================================================= */}

              {tradeMode ===
                "buy" && (
                <>

                  {/* =========================================
ONRAMP MODAL 1
========================================= */}

              {onrampStep ===
                1 && (
                <>

                  <div
                    ref={
                      onrampCryptoDropdownRef
                    }
                    className="relative"
                  >

                    <div className="flex h-[56px] w-full items-center rounded-[10px] border border-border bg-input">

                      {/* CRYPTO SELECTOR - LEFT */}

                      <button
                        type="button"
                        onClick={() =>
                          setOnrampCryptoDropdownOpen(
                            (open) =>
                              !open
                          )
                        }
                        className="flex h-full shrink-0 items-center gap-2 border-r border-border px-3.5"
                      >

                        {selectedCrypto ? (
                          <Image
                            src={
                              selectedCrypto.logo
                            }
                            alt=""
                            width={
                              22
                            }
                            height={
                              22
                            }
                            className="h-[22px] w-[22px] object-contain"
                          />
                        ) : null}

                        <span
                          className={
                            selectedCrypto
                              ? "text-[16px] font-semibold"
                              : "text-[16px] text-muted-foreground"
                          }
                        >
                          {selectedCrypto?.symbol ||
                            "Select Crypto"}
                        </span>

                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            onrampCryptoDropdownOpen
                              ? "rotate-180"
                              : ""
                          }`}
                        />
                      </button>

                      {/* AMOUNT INPUT - RIGHT */}

                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter amount"
                        value={
                          onrampCryptoAmount
                        }
                        onChange={
                          handleOnrampCryptoAmountChange
                        }
                        className="min-w-0 flex-1 bg-transparent px-4 text-left text-[16px] outline-none placeholder:text-muted-foreground"
                      />

                    </div>

                    {onrampCryptoDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[12px] border border-border bg-[#070812] shadow-2xl">

                        <div className="border-b border-border p-3">
  <div className="flex items-center gap-2">

    {/* SEARCH */}

    <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-border bg-[#050511] px-3">

      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />

      <input
        type="text"
        value={onrampCryptoSearch}
        onChange={(event) =>
          setOnrampCryptoSearch(
            event.target.value
          )
        }
        placeholder="Search supported crypto"
        className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
        autoFocus
      />

    </div>

    {/* NETWORK SELECTOR */}

    <div className="shrink-0">
      <NetworkSelector
        value={selectedNetwork}
        onChange={handleNetworkChange}
      />
    </div>

  </div>
</div>

                        <div className="max-h-[220px] overflow-y-auto p-1.5">

                          {filteredOnrampCryptoOptions.length >
                          0 ? (
                            filteredOnrampCryptoOptions.map(
                              (
                                crypto
                              ) => (
                                <button
                                  key={`${crypto.network}-${crypto.symbol}`}
                                  type="button"
                                  onClick={() =>
                                    handleOnrampCryptoSelect(
                                      crypto
                                    )
                                  }
                                  className="flex w-full items-center justify-between rounded-[8px] px-3 py-3 text-left transition hover:bg-secondary"
                                >

                                  <div className="flex items-center gap-3">

                                    <Image
                                      src={
                                        crypto.logo
                                      }
                                      alt=""
                                      width={
                                        40
                                      }
                                      height={
                                        40
                                      }
                                      className="h-10 w-10 object-contain"
                                    />

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

                                  </div>

                                  {selectedCrypto?.network ===
                                    crypto.network &&
                                    selectedCrypto?.symbol === crypto.symbol && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}

                                </button>
                              )
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

                  {/* AMOUNT TO PAY */}

{onrampCryptoAmount &&
  selectedCrypto &&
  !onrampQuoteError && (
    <div className="mt-3 px-1 text-[14px]">
      {onrampQuoteLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Calculating ...
        </div>
      ) : onrampLocalAmount ? (
        <div className="flex items-center gap-1 text-[14px]">
          <span className="font-normal text-foreground">
            Amount:
          </span>

          <span className="font-bold text-foreground">
            {currentCurrency.symbol}
            {(
              Number(onrampLocalAmount) +
              Number(onrampSenderFee || 0)
            ).toLocaleString(
              "en-NG",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
          </span>
        </div>
      ) : null}
    </div>
  )}

                  {onrampQuoteError && (
                    <div className="mt-3 px-1 text-[13px] text-destructive">
                      {
                        onrampQuoteError
                      }
                    </div>
                  )}

                  {/* WALLET ADDRESS */}

                  <div className="mt-5">
                    <input
                      type="text"
                      value={
                        onrampWalletAddress
                      }
                      onChange={(
                        event
                      ) =>
                        setOnrampWalletAddress(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Enter wallet address"
                      className="h-[56px] w-full rounded-[10px] border border-border bg-input px-4 text-[15px] outline-none placeholder:text-muted-foreground sm:px-5 sm:text-[16px]"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={
                      !selectedCrypto ||
                      !onrampCryptoAmount ||
                      Number(
                        onrampCryptoAmount
                      ) <= 0 ||
                      !onrampLocalAmount ||
                      onrampQuoteLoading ||
                      !onrampWalletAddress
                    }
                    onClick={
                      handleOnrampStepOneContinue
                    }
                    className={`mt-4 flex h-[56px] w-full items-center justify-center rounded-[10px] text-[15px] font-medium transition sm:text-[16px] ${
                      selectedCrypto &&
                      onrampCryptoAmount &&
                      Number(
                        onrampCryptoAmount
                      ) > 0 &&
                      onrampLocalAmount &&
                      !onrampQuoteLoading &&
                      onrampWalletAddress
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
                    }`}
                  >
                    Continue
                  </button>
                </>
              )}

                  {/* =========================================
    ONRAMP MODAL 2
   ========================================= */}

{onrampStep === 2 && (
  <>
    {/* =========================================
        ORDER SUMMARY
       ========================================= */}

    <div className="rounded-[10px] bg-input px-5 py-4">
      <div className="space-y-4 text-[15px] leading-[22px]">

        {/* RECIPIENT ADDRESS */}
        <div className="flex items-center justify-between gap-5">
          <span className="shrink-0 text-muted-foreground">
            Recipient address
          </span>

          <span className="max-w-[240px] truncate text-right font-semibold text-foreground">
            {shortenAddress(onrampWalletAddress)}
          </span>
        </div>

        {/* AMOUNT TO RECEIVE */}
        <div className="flex items-center justify-between gap-5">
          <span className="shrink-0 text-muted-foreground">
            Amount to receive
          </span>

          <span className="text-right font-semibold text-foreground">
            {onrampCryptoAmount}{" "}
            {selectedCrypto?.symbol}

            <span className="block text-[12px] font-normal text-muted-foreground">
              {selectedCrypto
                ? getNetworkConfig(selectedCrypto.network).name
                : "Network"}
            </span>
          </span>
        </div>

        {/* TRANSACTION FEE */}
        <div className="flex items-center justify-between gap-5">
          <span className="shrink-0 text-muted-foreground">
            Transaction fee
          </span>

          <span className="text-right font-semibold text-foreground">
            {currentCurrency.symbol}
            {(
              Number(onrampLocalAmount || 0) * 0.05
            ).toLocaleString("en-NG", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* AMOUNT TO PAY */}
        <div className="flex items-center justify-between gap-5">
          <span className="shrink-0 text-muted-foreground">
            Amount to pay
          </span>

          <span className="text-right font-semibold text-foreground">
            {currentCurrency.symbol}
            {(
              Number(onrampLocalAmount || 0) * 1.05
            ).toLocaleString("en-NG", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

      </div>
    </div>

    {/* =========================================
        REFUND BANK ACCOUNT
       ========================================= */}

    <div className="mt-5 mb-3 text-[15px] font-bold">
      Refund bank account
    </div>

    {/* BANK SELECTOR */}
    <div
      ref={onrampBankDropdownRef}
      className="relative"
    >
      <button
        type="button"
        disabled={loadingBanks}
        onClick={() =>
          setOnrampBankDropdownOpen(
            (open) => !open
          )
        }
        className="flex h-[56px] w-full items-center justify-between rounded-[10px] border border-border bg-input px-4 text-left text-[15px] disabled:opacity-50 sm:px-5 sm:text-[16px]"
      >
        <span
          className={
            onrampRefundBank
              ? "text-foreground"
              : "text-muted-foreground"
          }
        >
          {loadingBanks
            ? "Loading banks..."
            : onrampRefundBank?.name ||
              "Select Bank"}
        </span>

        {loadingBanks ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform ${
              onrampBankDropdownOpen
                ? "rotate-180"
                : ""
            }`}
          />
        )}
      </button>

      {/* BANK DROPDOWN */}
      {onrampBankDropdownOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[12px] border border-border bg-[#070812] shadow-2xl">

          {/* SEARCH */}
          <div className="border-b border-border p-3">
            <div className="flex h-11 items-center gap-2 rounded-[8px] border border-border bg-input px-3">
              <Search className="h-4 w-4 text-muted-foreground" />

              <input
                type="text"
                value={onrampBankSearch}
                onChange={(event) =>
                  setOnrampBankSearch(
                    event.target.value
                  )
                }
                placeholder="Search bank"
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              />
            </div>
          </div>

          {/* BANK LIST */}
          <div className="max-h-[280px] overflow-y-auto p-1.5">
            {filteredOnrampInstitutions.length >
            0 ? (
              filteredOnrampInstitutions.map(
                (bank) => (
                  <button
                    key={bank.code}
                    type="button"
                    onClick={() =>
                      handleOnrampRefundBankSelect(
                        bank
                      )
                    }
                    className="flex w-full items-center justify-between rounded-[8px] px-3 py-3 text-left text-[14px] hover:bg-secondary"
                  >
                    <span>
                      {bank.name}
                    </span>

                    {onrampRefundBank?.code ===
                      bank.code && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                )
              )
            ) : (
              <div className="px-3 py-8 text-center text-[14px] text-muted-foreground">
                {loadingBanks
                  ? "Loading banks..."
                  : "No banks found."}
              </div>
            )}
          </div>

        </div>
      )}
    </div>

    {/* =========================================
        ACCOUNT NUMBER
       ========================================= */}

    <div className="mt-3">
      <input
        type="text"
        inputMode="numeric"
        placeholder="Enter Account number"
        value={
          onrampRefundAccountNumber
        }
        onChange={
          handleOnrampRefundAccountNumberChange
        }
        disabled={!onrampRefundBank}
        className="h-[56px] w-full rounded-[10px] border border-border bg-input px-4 text-[15px] outline-none placeholder:text-muted-foreground disabled:opacity-50 sm:px-5 sm:text-[16px]"
      />

      {/* VERIFYING */}
      {onrampRefundVerifying && (
        <div className="mt-2 flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Verifying account...
        </div>
      )}

      {/* VERIFIED ACCOUNT NAME */}
      {onrampRefundAccountName &&
        !onrampRefundVerifying && (
          <div className="mt-2 px-1 text-[14px] text-muted-foreground">
            {onrampRefundAccountName}
          </div>
        )}

      {/* ACCOUNT ERROR */}
      {onrampRefundError && (
        <div className="mt-2 px-1 text-[13px] text-destructive">
          {onrampRefundError}
        </div>
      )}
    </div>

    {/* =========================================
        ACTION BUTTONS
       ========================================= */}

    <div className="mt-4 flex w-full items-center gap-2">

      {/* BACK */}
      <button
        type="button"
        onClick={
          handleOnrampBackToStepOne
        }
        className="flex h-[56px] shrink-0 items-center justify-center gap-2 rounded-[10px] border border-border bg-input px-4 text-[15px] font-medium transition hover:bg-secondary sm:px-5 sm:text-[16px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* CONTINUE */}
      <button
        type="button"
        onClick={
          handleCreateOnrampOrder
        }
        disabled={
          !onrampRefundBank ||
          onrampRefundAccountNumber.length !==
            10 ||
          !onrampRefundAccountName ||
          onrampRefundVerifying ||
          onrampState === "creating"
        }
        className={`flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-[10px] text-[15px] font-medium transition sm:text-[16px] ${
          onrampRefundBank &&
          onrampRefundAccountNumber.length ===
            10 &&
          onrampRefundAccountName &&
          !onrampRefundVerifying &&
          onrampState !== "creating"
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
        }`}
      >
        {onrampState === "creating" ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating...
          </span>
        ) : (
          "Continue"
        )}
      </button>

    </div>

    {/* ONRAMP ERROR */}
    {onrampError && (
      <div className="mt-3 rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        {onrampError}
      </div>
    )}
  </>
)}
                  {/* =========================================
                      ONRAMP MODAL 3
                     ========================================= */}

                  {onrampStep ===
                    3 && (
                    <>
{onrampState ===
"processing" ? (
  <div className="py-10 text-center">

    <div className="relative mx-auto flex h-[80px] w-[80px] items-center justify-center rounded-full bg-[#050511]">

      <div
        className="absolute h-[80px] w-[80px] rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, transparent 45deg, #1557E8 110deg, #1557E8 150deg, transparent 210deg, transparent 360deg)",
          animation:
            "biyaport-spin 1.5s linear infinite",
        }}
      />

      <div className="absolute h-[74px] w-[74px] rounded-full bg-[#050511]" />

    </div>

    <h2 className="mt-6 text-[20px] font-semibold">
      Transfer Processing
    </h2>

    <p className="mt-2 text-[14px] leading-[21px] text-muted-foreground">
      {onrampStatusMessage}
    </p>

    <div className="mt-5 inline-flex rounded-[7px] bg-[#05091C] px-4 py-2 text-[14px] font-medium text-[#1557E8]">
      Checking payment status...
    </div>
  </div>
                      ) : onrampState ===
                        "success" ? (
                        <div className="py-10 text-center">

                          <div className="mx-auto flex h-[80px] w-[80px] items-center justify-center rounded-full border-[3px] border-[#1557E8]">
                            <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#1557E8]">
                              <Check className="h-7 w-7 text-white" />
                            </div>
                          </div>

                          <h2 className="mt-6 text-[20px] font-semibold">
                            Purchase Successful
                          </h2>

                          <p className="mt-2 text-[14px] leading-[21px] text-muted-foreground">
                            {
                              onrampCryptoAmount
                            }{" "}
                            {
                              selectedCrypto?.symbol
                            }{" "}
                            has been sent to your wallet.
                          </p>

                          <button
                            type="button"
                            onClick={() => {
                              resetOnramp();
                            }}
                            className="mt-7 flex h-[56px] w-full items-center justify-center rounded-[10px] bg-primary text-[15px] font-medium text-primary-foreground transition hover:opacity-90"
                          >
                            Back Home
                          </button>
                        </div>
                      ) : (
                        <>

                          {/* PAYMENT SUMMARY */}

                          <div className="rounded-[10px] bg-input px-5 py-4">
                            <div className="space-y-4 text-[15px] leading-[22px]">

                              <div className="flex items-center justify-between gap-5">
                                <span className="shrink-0 text-muted-foreground">
                                  Bank name
                                </span>

                                <span className="max-w-[250px] truncate text-right font-semibold text-foreground">
                                  {
                                    onrampPaymentAccount?.bankName ||
                                    onrampPaymentAccount?.institution ||
                                    "—"
                                  }
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-5">
                                <span className="shrink-0 text-muted-foreground">
                                  Account Number
                                </span>

                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="max-w-[180px] truncate text-right font-semibold text-foreground">
                                    {
                                      onrampPaymentAccount?.accountIdentifier ||
                                      onrampPaymentAccount?.accountNumber ||
                                      "—"
                                    }
                                  </span>

                                  <CopyButton
                                    value={
                                      onrampPaymentAccount?.accountIdentifier ||
                                      onrampPaymentAccount?.accountNumber ||
                                      ""
                                    }
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-5">
                                <span className="shrink-0 text-muted-foreground">
                                  Account Name
                                </span>

                                <span className="max-w-[250px] truncate text-right font-semibold text-foreground">
                                  {
                                    onrampPaymentAccount?.accountName ||
                                    "—"
                                  }
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-5">
                                <span className="shrink-0 text-muted-foreground">
                                  Amount
                                </span>

                                <div className="flex items-center gap-2">
                                  <span className="text-right font-semibold text-foreground">
                                    {
                                      currentCurrency.symbol
                                    }
                                    {Number(
                                      onrampPaymentAmount ||
                                        0
                                    ).toLocaleString(
                                      "en-NG",
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}
                                  </span>

                                  <CopyButton
                                    value={`${currentCurrency.symbol}${onrampPaymentAmount}`}
                                  />
                                </div>
                              </div>

                            </div>
                          </div>

                          {/* EXPIRY */}

                          <div className="mt-5 text-center text-[14px] leading-[21px] text-muted-foreground">
                            This account is for this transaction only and expires in
                          </div>

                          <div className="mt-3 flex justify-center">
                            <div className="inline-flex rounded-[7px] bg-[#05091C] px-4 py-2 text-[16px] font-semibold text-[#1557E8]">
                              {formatCountdown(
                                onrampCountdown
                              )}
                            </div>
                          </div>

                          {onrampCountdown ===
                            0 &&
                            onrampExpiry && (
                              <div className="mt-2 text-center text-[13px] text-destructive">
                                This payment account has expired.
                              </div>
                            )}

                          <div className="mt-6 flex w-full items-center gap-2">

                            <button
                              type="button"
                              onClick={() => {
                                setOnrampStep(
                                  2
                                );
                                setOnrampError(
                                  ""
                                );
                              }}
                              className="flex h-[56px] shrink-0 items-center justify-center gap-2 rounded-[10px] border border-border bg-input px-4 text-[15px] font-medium transition hover:bg-secondary sm:px-5 sm:text-[16px]"
                            >
                              <ArrowLeft className="h-4 w-4" />
                              Back
                            </button>

                            <button
                              type="button"
                              disabled={
                                !onrampOrderId ||
                                (!!onrampExpiry &&
                                  onrampCountdown ===
                                    0)
                              }
                              onClick={
                                handleOnrampTransferMade
                              }
                              className={`flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-[10px] text-[15px] font-medium transition sm:text-[16px] ${
                                onrampOrderId &&
                                (!onrampExpiry ||
                                  onrampCountdown >
                                    0)
                                  ? "bg-primary text-primary-foreground hover:opacity-90"
                                  : "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
                              }`}
                            >
                              I have made the transfer
                            </button>
                          </div>

                          {onrampError && (
                            <div className="mt-3 rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                              {
                                onrampError
                              }
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {/* =================================================
                  OFFRAMP
                 ================================================= */}

              {tradeMode ===
                "sell" && (
                <>
                  {step ===
                    1 && (
                    <>
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
                                  className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
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
                            className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary text-[15px] font-medium text-primary-foreground hover:opacity-90 sm:h-[56px]"
                          >
                            Next
                          </button>
                        )}
                    </>
                  )}

                  {step ===
                    2 && (
                    <>
                      <div className="rounded-[10px] bg-input px-5 py-4">
                        <div className="space-y-3 text-[15px] leading-[22px]">

                          <div className="flex items-center justify-between gap-5">
                            <span className="shrink-0 text-muted-foreground">
                              Name
                            </span>

                            <span className="min-w-0 truncate text-right font-semibold text-foreground">
                              {
                                accountName
                              }
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-5">
                            <span className="shrink-0 text-muted-foreground">
                              Account no
                            </span>

                            <span className="shrink-0 text-right font-semibold text-foreground">
                              {
                                accountNumber
                              }
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-5">
                            <span className="shrink-0 text-muted-foreground">
                              Bank Name
                            </span>

                            <span className="min-w-0 truncate text-right font-semibold text-foreground">
                              {
                                selectedBank?.name
                              }
                            </span>
                          </div>

                        </div>
                      </div>

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
                          <div className="flex min-w-0 items-center gap-2.5">
                            {selectedCrypto ? (
                              <Image
                                src={
                                  selectedCrypto.logo
                                }
                                alt=""
                                width={
                                  24
                                }
                                height={
                                  24
                                }
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
                                    value={
                                      cryptoSearch
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      setCryptoSearch(
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    onClick={(
                                      event
                                    ) =>
                                      event.stopPropagation()
                                    }
                                    placeholder="Search supported crypto"
                                    className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
                                    autoFocus
                                  />
                                </div>

                                <NetworkSelector
                                  value={selectedNetwork}
                                  onChange={handleNetworkChange}
                                />
                              </div>
                            </div>

                            <div className="max-h-[220px] overflow-y-auto p-1.5">
                              {filteredCryptoOptions.length >
                              0 ? (
                                filteredCryptoOptions.map(
                                  (
                                    crypto
                                  ) => {
                                    const balance =
                                      tokenBalances[
                                        crypto.symbol
                                      ];

                                    return (
                                      <button
                                        key={`${crypto.network}-${crypto.symbol}`}
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
                                            width={
                                              40
                                            }
                                            height={
                                              40
                                            }
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

                                        <div className="ml-3 flex shrink-0 flex-col items-end">
                                          <span className="text-[14px] font-medium text-foreground">
                                            {loadingBalances
                                              ? "..."
                                              : balance}
                                          </span>

                                          <span className="text-[11px] text-muted-foreground">
                                            {
                                              crypto.symbol
                                            }
                                          </span>
                                        </div>

                                        {selectedCrypto?.network ===
                                          crypto.network &&
                                          selectedCrypto?.symbol === crypto.symbol && (
                                          <Check className="ml-3 h-4 w-4 shrink-0 text-primary" />
                                        )}
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

                      <div className="mt-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Enter Amount (₦)"
                          value={
                            amount
                          }
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
                            {
                              quoteError
                            }
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex w-full items-center gap-2">

                        <button
                          type="button"
                          onClick={
                            handleBack
                          }
                          className="flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-[10px] border border-border bg-input px-4 text-[15px] font-medium text-foreground transition hover:bg-secondary sm:h-[56px] sm:px-5 sm:text-[16px]"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back
                        </button>

                        <button
                          type="button"
                          onClick={
                            handlePay
                          }
                          disabled={
                            !showPayButton
                          }
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
                          {
                            paymentError
                          }
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <p className="mt-6 w-full px-2 text-center text-[14px] leading-[20px] text-muted-foreground sm:mt-8 sm:px-0 sm:text-[16px] sm:leading-[22px]">
              Send crypto to
              local bank accounts. No wallet needed
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
 * B-CODE VIEW
 * ====================================================
 */

function BCodeView({
  initialRedeemCode,
  onBackHome,
}: {
  initialRedeemCode?: string;
  onBackHome: () => void;
}) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const wallet = wallets[0];

  type BCodeMode = "generate" | "redeem";
  type GenerateStep = 1 | 2;
  type GenerateState = "idle" | "processing" | "success" | "error";
  type RedeemStep = 1 | 2;
  type RedeemState = "idle" | "processing" | "success" | "error";
  type BCodeStage = 1 | 2 | 3;

  const [mode, setMode] = useState<BCodeMode>(
    initialRedeemCode ? "redeem" : "generate"
  );

  /*
   * ====================================================
   * GENERATE STATE
   * ====================================================
   */

  const [generateStep, setGenerateStep] =
    useState<GenerateStep>(1);

  const [generateNetwork, setGenerateNetwork] =
    useState<NetworkKey>("base-sepolia");

  const [generateToken, setGenerateToken] =
    useState<"USDT" | "USDC">("USDC");

  const [
    generateCryptoDropdownOpen,
    setGenerateCryptoDropdownOpen,
  ] = useState(false);

  const [generateCryptoSearch, setGenerateCryptoSearch] =
    useState("");

  const generateCryptoDropdownRef =
    useRef<HTMLDivElement | null>(null);

  const [generateAmount, setGenerateAmount] =
    useState("");

  const [generatedCode, setGeneratedCode] =
    useState("");

  const [generatedHash, setGeneratedHash] =
    useState<`0x${string}` | "">("");

  const [generateState, setGenerateState] =
    useState<GenerateState>("idle");

  const [generateStage, setGenerateStage] =
    useState<BCodeStage>(1);

  const [generateError, setGenerateError] =
    useState("");

  const [generateTxHash, setGenerateTxHash] =
    useState("");

  const [generatedQr, setGeneratedQr] =
    useState("");

  /*
   * ====================================================
   * MY B-CODES STATE
   * ====================================================
   */

  type BCodeHistoryItem = {
    hash: `0x${string}`;
    creator: `0x${string}`;
    token: `0x${string}`;
    amount: bigint;
    redeemed: boolean;
    cancelled: boolean;
    code: string;
  };

  const [myBCodesOpen, setMyBCodesOpen] =
    useState(false);
  const [myBCodesFilter, setMyBCodesFilter] =
    useState<"all" | "active" | "cancelled" | "redeemed">("all");
  const [expandedBCodeHash, setExpandedBCodeHash] =
    useState<`0x${string}` | null>(null);
  const [myBCodes, setMyBCodes] =
    useState<BCodeHistoryItem[]>([]);
  const [myBCodesLoading, setMyBCodesLoading] =
    useState(false);
  const [myBCodesError, setMyBCodesError] =
    useState("");
  const [copiedBCode, setCopiedBCode] =
    useState<string | null>(null);
  const [cancelHash, setCancelHash] =
    useState<`0x${string}` | null>(null);
  const [cancelLoading, setCancelLoading] =
    useState(false);
  const [cancelError, setCancelError] =
    useState("");

  /*
   * ====================================================
   * REDEEM STATE
   * ====================================================
   */

  const [redeemStep, setRedeemStep] =
    useState<RedeemStep>(1);

  const [redeemCode, setRedeemCode] = useState(
    initialRedeemCode || ""
  );

  const [redeemInput, setRedeemInput] = useState("");

  const handleRedeemInput = (value: string) => {
    const raw = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);

    let formatted = raw;

    if (raw.length > 4) {
      formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    }

    setRedeemInput(formatted);
    setRedeemCode(`B-${formatted}`);
    setRedeemError("");
  };

  const [redeemState, setRedeemState] =
    useState<RedeemState>("idle");

  const [redeemStage, setRedeemStage] =
    useState<BCodeStage>(1);

  const [redeemError, setRedeemError] =
    useState("");

  const [redeemToken, setRedeemToken] =
    useState<"USDT" | "USDC" | "">("");

  const [redeemAmount, setRedeemAmount] =
    useState("");

  const [redeemRecipient, setRedeemRecipient] =
    useState("");

  const [redeemTxHash, setRedeemTxHash] =
    useState("");

  /*
   * ====================================================
   * GENERATE CRYPTO SEARCH
   * ====================================================
   */

  const filteredGenerateCryptoOptions = (
    ["USDT", "USDC"] as const
  ).filter((symbol) =>
    symbol
      .toLowerCase()
      .includes(
        generateCryptoSearch.trim().toLowerCase()
      )
  );

  /*
   * ====================================================
   * CLOSE CRYPTO DROPDOWN ON OUTSIDE CLICK
   * ====================================================
   */

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        generateCryptoDropdownRef.current &&
        !generateCryptoDropdownRef.current.contains(target)
      ) {
        setGenerateCryptoDropdownOpen(false);
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
   * ====================================================
   * INITIAL REDEEM CODE
   * ====================================================
   */

  useEffect(() => {
    if (initialRedeemCode) {
      const code =
        initialRedeemCode.trim().toUpperCase();

      setRedeemCode(code);

      setRedeemInput(
        code.startsWith("B-")
          ? code.slice(2)
          : code
      );
    }
  }, [initialRedeemCode]);

  /*
   * ====================================================
   * NETWORK LABEL
   * ====================================================
   */

  const generateNetworkLabel =
    getNetworkConfig(generateNetwork).name;

  /*
   * ====================================================
   * GENERATE FEE
   * ====================================================
   */

  const generateFee =
    generateAmount &&
    Number(generateAmount) > 0
      ? Number(generateAmount) *
        (BCODE_FEE_BPS / BCODE_BPS_DENOMINATOR)
      : 0;

  const generateTotal =
    generateAmount &&
    Number(generateAmount) > 0
      ? Number(generateAmount) + generateFee
      : 0;

  /*
   * ====================================================
   * SWITCH MODE
   * ====================================================
   */

  const switchMode = (nextMode: BCodeMode) => {
    setMode(nextMode);

    setGenerateState("idle");
    setGenerateStage(1);
    setGenerateError("");

    setRedeemState("idle");
    setRedeemStage(1);
    setRedeemError("");

    if (
      nextMode === "redeem" &&
      initialRedeemCode
    ) {
      setRedeemCode(
        initialRedeemCode.trim().toUpperCase()
      );
    }
  };

  /*
   * ====================================================
   * VALIDATE B-CODE
   * ====================================================
   */

  const validateBCode = async () => {
    const code =
      redeemCode.trim().toUpperCase();

    setRedeemError("");

    if (!isValidBCodeFormat(code)) {
      setRedeemError(
        "Enter a valid B-Code in the format B-XXXX-XXXX."
      );

      return false;
    }

    try {
  const codeHash =
    hashBCodeForClient(code);

  const bcode =
    await BCODE_PUBLIC_CLIENT.readContract({
      address:
        BCODE_CONTRACT_ADDRESS,
      abi:
        BCODE_CONTRACT_ABI,
      functionName:
        "getBCode",
      args: [
        codeHash,
      ],
    });

  const [
    creator,
    tokenAddress,
    amount,
    redeemed,
    cancelled,
  ] = bcode;

  if (
    creator ===
    "0x0000000000000000000000000000000000000000"
  ) {
    setRedeemError(
      "This B-Code does not exist."
    );

    return false;
  }

  if (redeemed) {
    setRedeemError(
      "This B-Code has already been redeemed."
    );

    return false;
  }

  if (cancelled) {
    setRedeemError(
      "This B-Code has been cancelled."
    );

    return false;
  }

  const token =
    tokenAddress.toLowerCase();

  if (
    token ===
    BCODE_BASE_SEPOLIA_USDC.toLowerCase()
  ) {
    setRedeemToken("USDC");
  } else if (
    token ===
    BCODE_BASE_SEPOLIA_USDT.toLowerCase()
  ) {
    setRedeemToken("USDT");
  } else {
    setRedeemToken("");

    setRedeemError(
      "This B-Code contains an unsupported token."
    );

    return false;
  }

  // Continue with the rest of your redeem logic here...

      setRedeemAmount(
        formatUnits(
          amount,
          BCODE_TOKEN_DECIMALS
        )
      );

      setRedeemCode(code);
      setRedeemStep(2);

      return true;
    } catch (error) {
      console.error(
        "B-CODE VALIDATION ERROR:",
        error
      );

      setRedeemError(
        error instanceof Error
          ? error.message
          : "Unable to validate this B-Code."
      );

      return false;
    }
  };

  /*
   * ====================================================
   * GENERATE CONTINUE
   * ====================================================
   */

  const handleGenerateContinue = async () => {
    if (
      !authenticated ||
      !wallet?.address
    ) {
      setGenerateError(
        "Connect your wallet first."
      );

      return;
    }

    const numericAmount =
      Number(generateAmount);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      setGenerateError(
        "Enter an amount greater than zero."
      );

      return;
    }

    const token =
      getBCodeTokenConfig(
        generateToken
      );

    const amountUnits =
      parseUnits(
        numericAmount.toFixed(
          BCODE_TOKEN_DECIMALS
        ),
        token.decimals
      );

    const feeUnits =
      (amountUnits *
        BigInt(BCODE_FEE_BPS)) /
      BigInt(
        BCODE_BPS_DENOMINATOR
      );

    if (feeUnits <= 0n) {
      setGenerateError(
        "Amount is too small to cover the 2% creation fee."
      );

      return;
    }

    setGenerateError("");
    setGenerateStep(2);
  };

  /*
   * ====================================================
   * CHECK TOKEN ALLOWANCE
   * ====================================================
   */

  const checkTokenAllowance = async ({
    tokenAddress,
    owner,
    requiredAmount,
  }: {
    tokenAddress: `0x${string}`;
    owner: `0x${string}`;
    requiredAmount: bigint;
  }) => {
    const allowance =
      await BCODE_PUBLIC_CLIENT.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [
          owner,
          BCODE_CONTRACT_ADDRESS,
        ],
      });

    return allowance >= requiredAmount;
  };

  /*
   * ====================================================
   * ONE-TIME TOKEN APPROVAL
   * ====================================================
   */

  const enableBCodeToken = async ({
    tokenAddress,
  }: {
    tokenAddress: `0x${string}`;
  }) => {
    if (!wallet?.address) {
      throw new Error(
        "Connect your wallet first."
      );
    }

    const approvalData =
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [
          BCODE_CONTRACT_ADDRESS,
          maxUint256,
        ],
      });

    const approvalResult =
      await sendTransaction(
        {
          to: tokenAddress,
          data: approvalData,
          value: 0n,
          chainId: BCODE_CHAIN_ID,
        },
        {
          address:
            wallet.address,
        }
      );

    if (!approvalResult?.hash) {
      throw new Error(
        "Token approval was not submitted."
      );
    }

    await BCODE_PUBLIC_CLIENT.waitForTransactionReceipt(
      {
        hash:
          approvalResult.hash as `0x${string}`,
        confirmations: 1,
      }
    );

    return approvalResult.hash;
  };

  /*
   * ====================================================
   * SIGN B-CODE CREATION
   * ====================================================
   */

  const signBCodeCreation = async ({
    codeHash,
    tokenAddress,
    amount,
    nonce,
    deadline,
  }: {
    codeHash: `0x${string}`;
    tokenAddress: `0x${string}`;
    amount: bigint;
    nonce: bigint;
    deadline: bigint;
  }) => {
    if (!wallet?.address) {
      throw new Error(
        "Connect your wallet first."
      );
    }

    const provider =
      await wallet.getEthereumProvider();

    const typedData = {
  types: {
    EIP712Domain: [
      {
        name: "name",
        type: "string",
      },
      {
        name: "version",
        type: "string",
      },
      {
        name: "chainId",
        type: "uint256",
      },
      {
        name: "verifyingContract",
        type: "address",
      },
    ],

    CreateBCode: [
      {
        name: "creator",
        type: "address",
      },
      {
        name: "codeHash",
        type: "bytes32",
      },
      {
        name: "token",
        type: "address",
      },
      {
        name: "amount",
        type: "uint256",
      },
      {
        name: "nonce",
        type: "uint256",
      },
      {
        name: "deadline",
        type: "uint256",
      },
    ],
  },

  primaryType: "CreateBCode",

  domain: {
    name: "Biyaport B-Codes",
    version: "1",
    chainId: BCODE_CHAIN_ID,
    verifyingContract: BCODE_CONTRACT_ADDRESS,
  },

  message: {
    creator: wallet.address,
    codeHash,
    token: tokenAddress,
    amount: amount.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  },
};

    const signature =
      await provider.request({
        method:
          "eth_signTypedData_v4",
        params: [
          wallet.address,
          JSON.stringify(
            typedData
          ),
        ],
      });

    return signature as `0x${string}`;
  };

  /*
 * ====================================================
 * CREATE B-CODE
 * ====================================================
 */

const handleCreateBCode = async () => {
  if (
    !authenticated ||
    !wallet?.address
  ) {
    setGenerateError(
      "Connect your wallet first."
    );

    return;
  }

  /*
   * ====================================================
   * CURRENT TEST NETWORK
   * ====================================================
   */

  if (
    generateNetwork !==
    "base-sepolia"
  ) {
    setGenerateError(
      "B-Codes are currently only available on Base Sepolia."
    );

    return;
  }

  const numericAmount =
    Number(generateAmount);

  if (
    !Number.isFinite(
      numericAmount
    ) ||
    numericAmount <= 0
  ) {
    setGenerateError(
      "Enter an amount greater than zero."
    );

    return;
  }

  const token =
    getBCodeTokenConfig(
      generateToken
    );

  const amountUnits =
    parseUnits(
      numericAmount.toFixed(
        BCODE_TOKEN_DECIMALS
      ),
      token.decimals
    );

  const feeUnits =
    (amountUnits *
      BigInt(
        BCODE_FEE_BPS
      )) /
    BigInt(
      BCODE_BPS_DENOMINATOR
    );

  if (feeUnits <= 0n) {
    setGenerateError(
      "Amount is too small to cover the 2% creation fee."
    );

    return;
  }

  /*
   * The contract pulls:
   *
   * B-Code amount + 2% creation fee
   */
  const totalRequired =
    amountUnits +
    feeUnits;

  setGenerateState(
    "processing"
  );

  setGenerateStage(1);
  setGenerateError("");

  try {
    /*
     * ====================================================
     * SWITCH WALLET TO B-CODE NETWORK
     * ====================================================
     */

    if (wallet.switchChain) {
      await wallet.switchChain(
        BCODE_CHAIN_ID
      );
    }

      /*
     * ====================================================
     * GENERATE UNIQUE B-CODE
     * ====================================================
     */

    let code =
      generateBCodeValue();

    let codeHash =
      hashBCodeForClient(
        code
      );

    let codeIsAvailable =
      false;

    for (
      let attempt = 0;
      attempt < 5;
      attempt += 1
    ) {
      const existing =
  await BCODE_PUBLIC_CLIENT.readContract({
    address:
      BCODE_CONTRACT_ADDRESS,
    abi:
      BCODE_CONTRACT_ABI,
    functionName:
      "getBCode",
    args: [
      codeHash,
    ],
  });

const [creator] =
  existing;

if (
  creator ===
  "0x0000000000000000000000000000000000000000"
) {
  codeIsAvailable =
    true;

  break;
}

code =
  generateBCodeValue();

codeHash =
  hashBCodeForClient(
    code
  );
}

if (!codeIsAvailable) {
  throw new Error(
    "Unable to generate a unique B-Code. Please try again."
  );
}

    /*
     * Keep these available for the success screen.
     */

    setGeneratedCode(
      code
    );

    setGeneratedHash(
      codeHash
    );

    /*
     * ====================================================
     * CHECK ALLOWANCE
     * ====================================================
     *
     * The contract requires:
     *
     * amount + 2% fee
     *
     * If allowance is already sufficient,
     * the user does not see another approval.
     */

    const allowanceSufficient =
      await checkTokenAllowance({
        tokenAddress:
          token.address,
        owner:
          wallet.address as `0x${string}`,
        requiredAmount:
          totalRequired,
      });

    /*
     * ====================================================
     * ONE-TIME APPROVAL
     * ====================================================
     *
     * Only happens when the current allowance
     * is insufficient.
     */

    if (!allowanceSufficient) {
      await enableBCodeToken({
        tokenAddress:
          token.address,
      });
    }

    /*
     * ====================================================
     * GET CREATION NONCE
     * ====================================================
     */

    const nonce =
      await BCODE_PUBLIC_CLIENT.readContract(
        {
          address:
            BCODE_CONTRACT_ADDRESS,
          abi:
            BCODE_CONTRACT_ABI,
          functionName:
            "creationNonces",
          args: [
            wallet.address as `0x${string}`,
          ],
        }
      );

    /*
     * ====================================================
     * CREATE SIGNATURE DEADLINE
     * ====================================================
     *
     * IMPORTANT:
     *
     * This does NOT make the B-Code expire.
     *
     * It only limits how long the signed
     * creation authorization can be submitted.
     */

    const deadline =
      BigInt(
        Math.floor(
          Date.now() /
            1000
        ) + 10 * 60
      );

      /*
       * ====================================================
       * STAGE 2
       * ====================================================
       */

      setGenerateStage(2);

      /*
       * ====================================================
       * SIGN EIP-712 AUTHORIZATION
       * ====================================================
       */

      const signature =
        await signBCodeCreation({
          codeHash,
          tokenAddress:
            token.address,
          amount:
            amountUnits,
          nonce,
          deadline,
        });

      /*
       * ====================================================
       * STAGE 3
       * ====================================================
       */

      setGenerateStage(3);

      /*
       * ====================================================
       * SEND SIGNED AUTHORIZATION TO SERVER
       * ====================================================
       *
       * The server/relayer submits the actual
       * createBCodeWithSignature transaction.
       *
       * The user's wallet does NOT sign another
       * transaction here.
       */

      const response =
        await fetch(
          "/api/bcode/create",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                creator:
                  wallet.address,
                codeHash,
                code,
                token:
                  token.address,
                amount:
                  amountUnits.toString(),
                nonce:
                  nonce.toString(),
                deadline:
                  deadline.toString(),
                signature,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Unable to create B-Code."
        );
      }

      /*
       * ====================================================
       * SAVE RELAYER TRANSACTION HASH
       * ====================================================
       */

      const txHash =
        data?.txHash ||
        data?.hash ||
        "";

      if (!txHash) {
        throw new Error(
          "B-Code transaction was submitted without a transaction hash."
        );
      }

      setGenerateTxHash(
        txHash
      );

      /*
       * ====================================================
       * WAIT FOR RELAYER TRANSACTION
       * ====================================================
       */

      await BCODE_PUBLIC_CLIENT.waitForTransactionReceipt(
        {
          hash:
            txHash as `0x${string}`,
          confirmations: 1,
        }
      );

      /*
       * ====================================================
       * GENERATE DEEP LINK
       * ====================================================
       */

      const deepLink =
        `${window.location.origin}/?${BCODE_APP_PARAM}=${encodeURIComponent(
          code
        )}`;

      const qr =
        await QRCode.toDataURL(
          deepLink,
          {
            width: 480,
            margin: 2,
            errorCorrectionLevel:
              "H",
          }
        );

      setGeneratedQr(
        qr
      );

      /*
       * ====================================================
       * SUCCESS
       * ====================================================
       */

      setGenerateState(
        "success"
      );

      setGenerateStage(3);
    } catch (error) {
      console.error(
        "B-CODE CREATION ERROR:",
        error
      );

      setGenerateState(
        "error"
      );

      setGenerateError(
        error instanceof Error
          ? error.message
          : "Unable to create B-Code."
      );
    }
  };

  /*
   * ====================================================
   * DOWNLOAD QR
   * ====================================================
   */

  const downloadQr = () => {
    if (
      !generatedQr ||
      !generatedCode
    ) {
      return;
    }

    const link =
      document.createElement(
        "a"
      );

    link.href =
      generatedQr;

    link.download =
      `${generatedCode}.png`;

    link.click();
  };

  /*
   * ====================================================
   * DOWNLOAD SHARE IMAGE
   * ====================================================
   */

  const downloadShareImage =
    async () => {
      if (
        !generatedCode ||
        !generatedQr
      ) {
        return;
      }

      try {
        const qrImage =
          await loadImage(
            generatedQr
          );

        const logoImage =
          await loadImage(
            "/biyaport_logo.svg"
          );

        const canvas =
          document.createElement(
            "canvas"
          );

        /*
         * ====================================================
         * EXPORT SCALE
         * ====================================================
         *
         * Design size: 558 × 288
         * Export size: 1674 × 864
         */

        const exportScale = 3;

        const designWidth = 558;
        const designHeight = 288;

        canvas.width =
          designWidth *
          exportScale;

        canvas.height =
          designHeight *
          exportScale;

        canvas.style.width =
          `${designWidth}px`;

        canvas.style.height =
          `${designHeight}px`;

        const ctx =
          canvas.getContext(
            "2d"
          );

        if (!ctx) {
          throw new Error(
            "Unable to create share image."
          );
        }

        ctx.scale(
          exportScale,
          exportScale
        );

        /*
         * ====================================================
         * MAIN IMAGE
         * ====================================================
         */

        const padding = 30;
        const radius = 20;

        ctx.save();

        ctx.beginPath();

        ctx.roundRect(
          0,
          0,
          designWidth,
          designHeight,
          radius
        );

        ctx.clip();

        /*
         * ====================================================
         * BACKGROUND
         * ====================================================
         */

        ctx.fillStyle =
          "#050511";

        ctx.fillRect(
          0,
          0,
          designWidth,
          designHeight
        );

        /*
         * ====================================================
         * BLUE RADIAL GLOW
         * ====================================================
         */

        const glow =
          ctx.createRadialGradient(
            designWidth / 2,
            -20,
            0,
            designWidth / 2,
            -20,
            260
          );

        glow.addColorStop(
          0,
          "rgba(21, 87, 232, 0.16)"
        );

        glow.addColorStop(
          0.28,
          "rgba(21, 87, 232, 0.07)"
        );

        glow.addColorStop(
          0.68,
          "rgba(21, 87, 232, 0)"
        );

        ctx.fillStyle =
          glow;

        ctx.fillRect(
          0,
          0,
          designWidth,
          designHeight
        );

        /*
         * ====================================================
         * OUTER ELLIPSE RINGS
         * ====================================================
         */

        ctx.save();

        ctx.translate(
          designWidth / 2,
          -145
        );

        ctx.scale(
          1,
          0.45
        );

        ctx.beginPath();

        ctx.arc(
          0,
          0,
          185,
          0,
          Math.PI * 2
        );

        ctx.strokeStyle =
          "rgba(21, 87, 232, 0.16)";

        ctx.lineWidth = 2;

        ctx.stroke();

        ctx.restore();

        ctx.save();

        ctx.translate(
          designWidth / 2,
          -165
        );

        ctx.scale(
          1,
          0.45
        );

        ctx.beginPath();

        ctx.arc(
          0,
          0,
          250,
          0,
          Math.PI * 2
        );

        ctx.strokeStyle =
          "rgba(21, 87, 232, 0.14)";

        ctx.lineWidth = 1;

        ctx.stroke();

        ctx.restore();

        /*
         * ====================================================
         * LEFT SIDE
         * ====================================================
         */

        ctx.drawImage(
          logoImage,
          padding,
          padding,
          138,
          44
        );

        /*
         * ====================================================
         * B-CODE
         * ====================================================
         */

        ctx.fillStyle =
          "#FFFFFF";

        ctx.font =
          "700 32px DM Sans, Arial, sans-serif";

        ctx.textBaseline =
          "alphabetic";

        ctx.fillText(
          generatedCode,
          padding,
          228
        );

        /*
         * ====================================================
         * AMOUNT + NETWORK
         * ====================================================
         */

        const amountText =
          `${Number(
            generateAmount
          ).toLocaleString(
            undefined,
            {
              maximumFractionDigits: 6,
            }
          )} ${generateToken}`;

        const networkText =
          generateNetworkLabel;

        ctx.font =
          "700 16px DM Sans, Arial, sans-serif";

        const amountWidth =
          ctx.measureText(
            amountText
          ).width;

        ctx.fillStyle =
          "#FFFFFF";

        ctx.fillText(
          amountText,
          padding,
          254
        );

        ctx.fillStyle =
          "#9B9BAC";

        ctx.font =
          "400 16px DM Sans, Arial, sans-serif";

        ctx.fillText(
          networkText,
          padding +
            amountWidth +
            8,
          254
        );

        /*
         * ====================================================
         * RIGHT CONTAINER
         * ====================================================
         */

        const containerX = 346;
        const containerY = padding;

        const containerWidth = 182;
        const containerHeight = 228;

        ctx.fillStyle =
          "#0F0F1B";

        ctx.beginPath();

        roundRect(
          ctx,
          containerX,
          containerY,
          containerWidth,
          containerHeight,
          16
        );

        ctx.fill();

        /*
         * ====================================================
         * QR CODE
         * ====================================================
         */

        const qrSize = 150;

        const qrX =
          containerX +
          (containerWidth -
            qrSize) /
            2;

        const qrY =
          containerY + 12;

        ctx.drawImage(
          qrImage,
          qrX,
          qrY,
          qrSize,
          qrSize
        );

        /*
         * ====================================================
         * DASHED DIVIDER
         * ====================================================
         */

        const dividerY =
          qrY +
          qrSize +
          10;

        ctx.beginPath();

        ctx.setLineDash([
          4,
          4,
        ]);

        ctx.moveTo(
          containerX + 16,
          dividerY
        );

        ctx.lineTo(
          containerX +
            containerWidth -
            16,
          dividerY
        );

        ctx.strokeStyle =
          "#20202B";

        ctx.lineWidth = 1;

        ctx.stroke();

        ctx.setLineDash([]);

        /*
         * ====================================================
         * INSTRUCTIONS
         * ====================================================
         */

        const centerX =
          containerX +
          containerWidth / 2;

        ctx.textAlign =
          "center";

        ctx.fillStyle =
          "#FFFFFF";

        ctx.font =
          "500 12px DM Sans, Arial, sans-serif";

        ctx.fillText(
          "Scan to redeem",
          centerX,
          dividerY + 19
        );

        ctx.fillStyle =
          "#9B9BAC";

        ctx.font =
          "400 12px DM Sans, Arial, sans-serif";

        ctx.fillText(
          "Or visit biyaport.app",
          centerX,
          dividerY + 37
        );

        ctx.textAlign =
          "left";

        ctx.restore();

        /*
         * ====================================================
         * DOWNLOAD
         * ====================================================
         */

        const link =
          document.createElement(
            "a"
          );

        link.download =
          `${generatedCode}.png`;

        link.href =
          canvas.toDataURL(
            "image/png"
          );

        link.click();
      } catch (error) {
        console.error(
          "[B-CODE SHARE IMAGE ERROR]",
          error
        );
      }
    };

  /*
   * ====================================================
   * REDEEM B-CODE
   * ====================================================
   */

  const handleRedeem = async () => {
    const code =
      redeemCode.trim().toUpperCase();

    if (
      !isValidBCodeFormat(code)
    ) {
      setRedeemError(
        "Enter a valid B-Code in the format B-XXXX-XXXX."
      );

      setRedeemStep(1);

      return;
    }

    if (
      !/^0x[a-fA-F0-9]{40}$/.test(
        redeemRecipient.trim()
      )
    ) {
      setRedeemError(
        "Enter a valid wallet address."
      );

      return;
    }

    setRedeemState(
      "processing"
    );

    setRedeemStage(1);
    setRedeemError("");

    try {
      setRedeemStage(2);

      const response =
        await fetch(
          "/api/bcode/redeem",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                code,
                recipient:
                  redeemRecipient.trim(),
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Unable to redeem B-Code."
        );
      }

      setRedeemStage(3);

      setRedeemTxHash(
        data.txHash || ""
      );

      setRedeemState(
        "success"
      );
    } catch (error) {
      console.error(
        "B-CODE REDEMPTION ERROR:",
        error
      );

      setRedeemState(
        "error"
      );

      setRedeemError(
        error instanceof Error
          ? error.message
          : "Unable to redeem B-Code."
      );
    }
  };

  /*
   * ====================================================
   * MY B-CODES HELPERS
   * ====================================================
   */

  const getHistoryToken = (address: `0x${string}`) => {
    if (address.toLowerCase() === BCODE_BASE_SEPOLIA_USDT.toLowerCase()) {
      return getBCodeTokenConfig("USDT");
    }

    if (address.toLowerCase() === BCODE_BASE_SEPOLIA_USDC.toLowerCase()) {
      return getBCodeTokenConfig("USDC");
    }

    return null;
  };

  const fetchMyBCodes = async () => {
    if (!wallet?.address) {
      setMyBCodes([]);
      return;
    }

    setMyBCodesLoading(true);
    setMyBCodesError("");

    try {
      const hashes = await BCODE_PUBLIC_CLIENT.readContract({
        address: BCODE_CONTRACT_ADDRESS,
        abi: BCODE_CONTRACT_ABI,
        functionName: "getBCodeHashesByCreator",
        args: [wallet.address as `0x${string}`],
      });

      if (hashes.length === 0) {
        setMyBCodes([]);
        return;
      }

      const records = await Promise.all(
        hashes.map(async (hash) => {
          const result = await BCODE_PUBLIC_CLIENT.readContract({
            address: BCODE_CONTRACT_ADDRESS,
            abi: BCODE_CONTRACT_ABI,
            functionName: "getBCode",
            args: [hash],
          });

          const [creator, token, amount, redeemed, cancelled, code] = result;

          return {
            hash,
            creator,
            token,
            amount,
            redeemed,
            cancelled,
            code,
          } satisfies BCodeHistoryItem;
        })
      );

      setMyBCodes(records.reverse());
    } catch (error) {
      console.error("MY B-CODES ERROR:", error);
      setMyBCodes([]);
      setMyBCodesError(
        error instanceof Error
          ? error.message
          : "Unable to load your B-Codes."
      );
    } finally {
      setMyBCodesLoading(false);
    }
  };

  const openMyBCodes = () => {
    setMyBCodesOpen(true);
    setMyBCodesFilter("all");
    setExpandedBCodeHash(null);
    setCancelHash(null);
    setCancelError("");
    setMyBCodesError("");

    // Fetch immediately when the user clicks My B-Codes.
    // The effect below also retries automatically if the wallet address
    // becomes available after the view has opened.
    if (wallet?.address) {
      void fetchMyBCodes();
    } else {
      setMyBCodes([]);
      setMyBCodesError("Connect your wallet to view your B-Codes.");
    }
  };

  useEffect(() => {
    if (myBCodesOpen && wallet?.address) {
      void fetchMyBCodes();
    }
  }, [myBCodesOpen, wallet?.address]);

  const closeMyBCodes = () => {
    if (cancelLoading) return;
    setMyBCodesOpen(false);
    setExpandedBCodeHash(null);
    setCancelHash(null);
    setCancelError("");
  };

  const getHistoryStatus = (item: BCodeHistoryItem) =>
    item.cancelled ? "cancelled" : item.redeemed ? "redeemed" : "active";

  const filteredMyBCodes = myBCodes.filter((item) =>
    myBCodesFilter === "all"
      ? true
      : getHistoryStatus(item) === myBCodesFilter
  );

  const copyMyBCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedBCode(code);
      window.setTimeout(() => {
        setCopiedBCode((current) =>
          current === code ? null : current
        );
      }, 1500);
    } catch (error) {
      console.error("B-CODE COPY ERROR:", error);
    }
  };

  const handleCancelBCode = async () => {
    if (!cancelHash || !wallet?.address) {
      return;
    }

    setCancelLoading(true);
    setCancelError("");

    try {
      if (wallet.switchChain) {
        await wallet.switchChain(BCODE_CHAIN_ID);
      }

      const data = encodeFunctionData({
        abi: BCODE_CONTRACT_ABI,
        functionName: "cancelBCode",
        args: [cancelHash],
      });

      const result = await sendTransaction(
        {
          to: BCODE_CONTRACT_ADDRESS,
          data,
          value: 0n,
          chainId: BCODE_CHAIN_ID,
        },
        {
          address: wallet.address,
        }
      );

      if (!result?.hash) {
        throw new Error("Cancellation transaction was not submitted.");
      }

      await BCODE_PUBLIC_CLIENT.waitForTransactionReceipt({
        hash: result.hash as `0x${string}`,
        confirmations: 1,
      });

      setCancelHash(null);
      await fetchMyBCodes();
    } catch (error) {
      console.error("B-CODE CANCELLATION ERROR:", error);
      setCancelError(
        error instanceof Error
          ? error.message
          : "Unable to cancel this B-Code."
      );
    } finally {
      setCancelLoading(false);
    }
  };

  /*
   * ====================================================
   * RESET GENERATE
   * ====================================================
   */

  const resetGenerate = () => {
    setGenerateStep(1);
    setGenerateState("idle");
    setGenerateStage(1);
    setGenerateError("");
    setGenerateTxHash("");
    setGeneratedCode("");
    setGeneratedHash("");
    setGeneratedQr("");
    setGenerateCryptoSearch("");
    setGenerateCryptoDropdownOpen(false);
  };

  /*
   * ====================================================
   * RESET REDEEM
   * ====================================================
   */

  const resetRedeem = () => {
    setRedeemStep(1);
    setRedeemState("idle");
    setRedeemStage(1);
    setRedeemError("");
    setRedeemToken("");
    setRedeemAmount("");
    setRedeemRecipient("");
    setRedeemTxHash("");
  };

  /*
   * ====================================================
   * EXPLORER URL
   * ====================================================
   */

  const explorerBase =
    generateNetwork === "base"
      ? "https://basescan.org/tx/"
      : generateNetwork ===
        "bnb-smart-chain"
      ? "https://bscscan.com/tx/"
      : "https://sepolia.basescan.org/tx/";

  const explorerUrl =
    generateTxHash
      ? `${explorerBase}${generateTxHash}`
      : redeemTxHash
      ? `${explorerBase}${redeemTxHash}`
      : "";

  /*
   * ====================================================
   * RETURN
   * ====================================================
   */

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050511]">
      <Background />

      <div className="relative z-10 min-h-screen">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <SiteNav
          onQuickPort={onBackHome}
          onBCodes={() => {}}
        />

        {/* ====================================================
            MAIN
        ==================================================== */}

        <section className="min-h-screen overflow-y-auto px-4 pb-28 pt-[112px] sm:px-6 sm:pb-12 sm:pt-[128px]">
          <div className="mx-auto w-full max-w-[590px]">
  <div className="rounded-[16px] border border-border bg-card p-5 sm:p-6">
    {/* ====================================================
        TITLE
    ==================================================== */}

    {!(
      (mode === "generate" &&
        generateState === "success") ||
      (mode === "redeem" &&
        redeemState === "success")
    ) && (
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.03em]">
          B-Codes
        </h1>

        {myBCodesOpen ? (
          <button
            type="button"
            onClick={closeMyBCodes}
            disabled={cancelLoading}
            className="shrink-0 rounded-[9px] bg-secondary px-3 py-2 text-[13px] font-medium text-muted-foreground transition hover:bg-input hover:text-foreground disabled:opacity-50"
          >
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={openMyBCodes}
            className="shrink-0 rounded-[9px] bg-secondary px-3 py-2 text-[13px] font-medium text-muted-foreground transition hover:bg-input hover:text-foreground"
          >
            My B-Codes
          </button>
        )}
      </div>
    )}

    {!myBCodesOpen && (
      <>
        {/* ====================================================
            GENERATE / REDEEM SWITCH
        ==================================================== */}

        {(
          (mode === "generate" &&
            generateState === "idle" &&
            generateStep === 1) ||
          (mode === "redeem" &&
            redeemState === "idle" &&
            redeemStep === 1)
        ) && (
          <div className="mb-6 flex h-[52px] rounded-[12px] bg-input p-1">
            <button
              type="button"
              onClick={() => {
                switchMode("generate");
                setGenerateStep(1);
              }}
              className={`flex flex-1 items-center justify-center rounded-[9px] text-[14px] font-semibold transition ${
                mode === "generate"
                  ? "bg-[#050511] text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Generate
            </button>

            <button
              type="button"
              onClick={() => {
                switchMode("redeem");
                setRedeemStep(1);
              }}
              className={`flex flex-1 items-center justify-center rounded-[9px] text-[14px] font-semibold transition ${
                mode === "redeem"
                  ? "bg-[#050511] text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Redeem
            </button>
          </div>
        )}

        {/* ====================================================
            GENERATE
        ==================================================== */}

        {mode === "generate" && (
          <>
            {generateState === "processing" && (
              <BCodeProgress
                title="Generating B-Code"
                stage={generateStage}
                labels={[
                  "Preparing B-Code",
                  "Signing authorization",
                  "Submitting B-Code",
                ]}
              />
            )}

            {generateState === "success" && (
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                    <Check className="h-6 w-6 text-white" />
                  </div>
                </div>

                <h2 className="mt-6 text-[24px] font-semibold tracking-[-0.03em]">
                  B-Code Generated
                </h2>

                <p className="mt-2 text-[14px] text-muted-foreground">
                  Anyone with this B-Code can withdraw the funds to their wallet.
                </p>

                <div className="mx-auto mt-6 w-fit rounded-[12px] border border-dashed border-border bg-input px-5 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[27px] font-bold tracking-[0.08em]">
                      {generatedCode}
                    </span>

                    <CopyButton value={generatedCode} />
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={downloadShareImage}
                    className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary text-[14px] font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    Share B-Code
                  </button>

                  <button
                    type="button"
                    onClick={resetGenerate}
                    className="mx-auto mt-5 block text-[13px] font-medium text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
                  >
                    Generate new B-Code
                  </button>
                </div>
              </div>
            )}

            {generateState === "error" && (
              <div className="rounded-[12px] border border-destructive/30 bg-destructive/10 p-4 text-center">
                <p className="text-[14px] text-destructive">
                  {generateError || "B-Code creation failed."}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setGenerateState("idle");
                    setGenerateStage(1);
                  }}
                  className="mt-4 text-[14px] font-medium underline underline-offset-4"
                >
                  Try again
                </button>
              </div>
            )}

            {generateState === "idle" &&
              generateStep === 1 && (
                <>
                  <div
                    ref={generateCryptoDropdownRef}
                    className="relative"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setGenerateCryptoDropdownOpen(
                          (open) => !open
                        )
                      }
                      className="flex h-[56px] w-full items-center justify-between rounded-[10px] border border-border bg-input px-4"
                    >
                      <div className="flex items-center gap-3">
                        <Image
                          src={
                            getBCodeTokenConfig(
                              generateToken
                            ).logo
                          }
                          alt=""
                          width={38}
                          height={38}
                          className="h-9 w-9 object-contain"
                        />

                        <div className="text-left">
                          <p className="text-[15px] font-semibold">
                            {generateToken}
                          </p>

                          <p className="text-[12px] text-muted-foreground">
                            {generateNetworkLabel}
                          </p>
                        </div>
                      </div>

                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          generateCryptoDropdownOpen
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </button>

                    {generateCryptoDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-visible rounded-[12px] border border-border bg-[#070812] shadow-2xl">
                        <div className="border-b border-border p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-border bg-[#050511] px-3">
                              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />

                              <input
                                type="text"
                                value={generateCryptoSearch}
                                onChange={(event) =>
                                  setGenerateCryptoSearch(
                                    event.target.value
                                  )
                                }
                                placeholder="Search supported crypto"
                                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                                autoFocus
                              />
                            </div>

                            <NetworkSelector
                              value={generateNetwork}
                              onChange={(network) => {
                                setGenerateNetwork(network);
                              }}
                            />
                          </div>
                        </div>

                        <div className="max-h-[220px] overflow-y-auto p-1.5">
                          {filteredGenerateCryptoOptions.length >
                          0 ? (
                            filteredGenerateCryptoOptions.map(
                              (symbol) => {
                                const token =
                                  getBCodeTokenConfig(
                                    symbol
                                  );

                                return (
                                  <button
                                    key={`${generateNetwork}-${symbol}`}
                                    type="button"
                                    onClick={() => {
                                      setGenerateToken(symbol);
                                      setGenerateCryptoDropdownOpen(
                                        false
                                      );
                                      setGenerateCryptoSearch("");
                                    }}
                                    className="flex w-full items-center justify-between rounded-[8px] px-3 py-3 text-left transition hover:bg-secondary"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Image
                                        src={token.logo}
                                        alt=""
                                        width={32}
                                        height={32}
                                        className="h-8 w-8 object-contain"
                                      />

                                      <div>
                                        <div className="text-[14px] font-medium">
                                          {symbol}
                                        </div>

                                        <div className="text-[12px] text-muted-foreground">
                                          {symbol === "USDC"
                                            ? "USD Coin"
                                            : "Tether USD"}
                                        </div>
                                      </div>
                                    </div>

                                    {generateToken ===
                                      symbol && (
                                      <Check className="h-4 w-4 text-primary" />
                                    )}
                                  </button>
                                );
                              }
                            )
                          ) : (
                            <div className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                              No supported crypto found.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-[13px] text-muted-foreground">
                      Amount recipient receives
                    </label>

                    <div className="flex h-[56px] items-center rounded-[10px] border border-border bg-input px-4">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={generateAmount}
                        onChange={(event) => {
                          setGenerateAmount(
                            event.target.value.replace(
                              /[^0-9.]/g,
                              ""
                            )
                          );

                          setGenerateError("");
                        }}
                        placeholder="0.00"
                        className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
                      />

                      <span className="font-semibold">
                        {generateToken}
                      </span>
                    </div>
                  </div>

                  {generateError && (
                    <p className="mt-3 text-[13px] text-destructive">
                      {generateError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateContinue}
                    className="mt-5 flex h-[56px] w-full items-center justify-center rounded-[10px] bg-primary text-[15px] font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    Continue
                  </button>
                </>
              )}

            {generateState === "idle" &&
              generateStep === 2 && (
                <>
                  <div className="rounded-[12px] bg-input p-5">
                    <div className="space-y-3 text-[14px]">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Network
                        </span>

                        <span className="font-semibold">
                          {generateNetworkLabel}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Token
                        </span>

                        <span className="font-semibold">
                          {generateToken}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Recipient receives
                        </span>

                        <span className="font-semibold">
                          {Number(
                            generateAmount
                          ).toLocaleString(
                            undefined,
                            {
                              maximumFractionDigits: 6,
                            }
                          )}{" "}
                          {generateToken}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Creation fee
                        </span>

                        <span className="font-semibold">
                          {generateFee} {generateToken}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4 border-t border-border pt-3">
                        <span className="text-muted-foreground">
                          Total wallet spend
                        </span>

                        <span className="font-semibold">
                          {generateTotal} {generateToken}
                        </span>
                      </div>
                    </div>
                  </div>

                  {generateNetwork !== "base-sepolia" && (
                    <div className="mt-4 rounded-[10px] border border-primary/20 bg-primary/5 p-4 text-[13px] text-muted-foreground">
                      B-Codes on{" "}
                      <span className="font-medium text-foreground">
                        {generateNetworkLabel}
                      </span>{" "}
                      are not available yet. Base Sepolia is currently
                      being used for testing.
                    </div>
                  )}

                  {generateError && (
                    <p className="mt-3 text-[13px] text-destructive">
                      {generateError}
                    </p>
                  )}

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setGenerateStep(1)}
                      className="flex h-[56px] flex-1 items-center justify-center rounded-[10px] border border-border bg-input text-[15px] font-medium transition hover:bg-secondary"
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      onClick={handleCreateBCode}
                      className="flex h-[56px] flex-[1.7] items-center justify-center rounded-[10px] bg-primary text-[15px] font-medium text-primary-foreground transition hover:opacity-90"
                    >
                      Create B-Code
                    </button>
                  </div>
                </>
              )}
          </>
        )}

        {/* ====================================================
            REDEEM
        ==================================================== */}

        {mode === "redeem" && (
          <>
            {redeemState === "processing" && (
              <BCodeProgress
                title="Redeeming B-Code"
                stage={redeemStage}
                labels={[
                  "Validating redemption",
                  "Authorizing redemption",
                  "Confirming redemption",
                ]}
              />
            )}

            {redeemState === "success" && (
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                    <Check className="h-6 w-6 text-white" />
                  </div>
                </div>

                <h2 className="mt-6 text-[24px] font-semibold tracking-[-0.03em]">
                  Redemption Successful
                </h2>

                <p className="mt-2 text-[14px] text-muted-foreground">
                  {redeemAmount} {redeemToken} has been sent to your wallet.
                </p>

                <div className="mt-6 rounded-[12px] bg-input p-4 text-left text-[14px]">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      B-Code
                    </span>

                    <span className="font-semibold">
                      {redeemCode}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Recipient
                    </span>

                    <span className="max-w-[260px] truncate font-semibold">
                      {redeemRecipient}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={onBackHome}
                    className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary text-[14px] font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    Port to naira
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRedeemStep(1);
                      setRedeemState("idle");
                      setRedeemStage(1);
                      setRedeemError("");
                      setRedeemCode("");
                      setRedeemInput("");
                    }}
                    className="flex h-[52px] w-full items-center justify-center rounded-[10px] border border-border bg-input text-[14px] font-medium transition hover:bg-secondary"
                  >
                    New B-code
                  </button>
                </div>
              </div>
            )}

            {redeemState === "error" && (
              <div className="rounded-[12px] border border-destructive/30 bg-destructive/10 p-4 text-center">
                <p className="text-[14px] text-destructive">
                  {redeemError}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setRedeemState("idle");
                    setRedeemStage(1);
                  }}
                  className="mt-4 text-[14px] font-medium underline underline-offset-4"
                >
                  Try again
                </button>
              </div>
            )}

            {redeemState === "idle" &&
              redeemStep === 1 && (
                <>
                  <label className="mb-2 block text-[13px] text-muted-foreground">
                    Input B-Code
                  </label>

                  <div className="flex h-[56px] items-center rounded-[10px] border border-border bg-input px-4">
                    <span className="shrink-0 text-[17px] font-medium tracking-[0.06em]">
                      B-
                    </span>

                    <input
                      type="text"
                      value={redeemInput}
                      onChange={(e) =>
                        handleRedeemInput(e.target.value)
                      }
                      placeholder="XXXX-XXXX"
                      className="min-w-0 flex-1 bg-transparent text-[17px] tracking-[0.06em] outline-none placeholder:text-muted-foreground"
                    />
                  </div>

                  {redeemError && (
                    <p className="mt-3 text-[13px] text-destructive">
                      {redeemError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={validateBCode}
                    className="mt-5 flex h-[56px] w-full items-center justify-center rounded-[10px] bg-primary text-[15px] font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    Validate B-Code
                  </button>
                </>
              )}

            {redeemState === "idle" &&
              redeemStep === 2 && (
                <>
                  <div className="rounded-[12px] bg-input p-5">
                    <div className="space-y-3 text-[14px]">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          B-Code
                        </span>

                        <span className="font-semibold">
                          {redeemCode}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Token
                        </span>

                        <span className="font-semibold">
                          {redeemToken}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4 border-t border-border pt-3">
                        <span className="text-muted-foreground">
                          You receive
                        </span>

                        <span className="font-semibold">
                          {redeemAmount} {redeemToken}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-[14px] text-muted-foreground">
                      Wallet address to receive funds
                    </label>

                    <input
                      type="text"
                      value={redeemRecipient}
                      onChange={(event) => {
                        setRedeemRecipient(event.target.value);
                        setRedeemError("");
                      }}
                      placeholder="0x..."
                      className="h-[56px] w-full rounded-[10px] border border-border bg-input px-4 text-[14px] outline-none placeholder:text-muted-foreground"
                    />
                  </div>

                  {redeemError && (
                    <p className="mt-3 text-[13px] text-destructive">
                      {redeemError}
                    </p>
                  )}

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRedeemStep(1)}
                      className="flex h-[56px] flex-1 items-center justify-center rounded-[10px] border border-border bg-input text-[15px] font-medium transition hover:bg-secondary"
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      onClick={handleRedeem}
                      className="flex h-[56px] flex-[1.7] items-center justify-center gap-2 rounded-[10px] bg-primary text-[15px] font-medium text-primary-foreground transition hover:opacity-90"
                    >
                      Redeem B-Code
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
          </>
        )}
      </>
    )}

    {myBCodesOpen && (
      <div className="mt-1">

        <div className="mb-4 flex w-full gap-1 rounded-[10px] bg-input p-1">
  {([
    ["all", "All"],
    ["active", "Active"],
    ["cancelled", "Canceled"],
    ["redeemed", "Redeemed"],
  ] as const).map(([value, label]) => (
    <button
      key={value}
      type="button"
      onClick={() => setMyBCodesFilter(value)}
      className={`min-w-0 flex-1 rounded-[8px] px-2 py-2 text-center text-[12px] font-medium transition ${
        myBCodesFilter === value
          ? "bg-[#050511] text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  ))}
</div>

        {myBCodesLoading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />

            <p className="mt-4 text-[14px] text-muted-foreground">
              Loading your B-Codes...
            </p>
          </div>
        ) : myBCodesError ? (
          <div className="rounded-[12px] border border-destructive/30 bg-destructive/10 p-5 text-center">
            <p className="text-[14px] text-destructive">
              {myBCodesError}
            </p>

            <button
              type="button"
              onClick={fetchMyBCodes}
              className="mt-4 text-[13px] font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        ) : filteredMyBCodes.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-input">
              <Coins className="h-5 w-5 text-muted-foreground" />
            </div>

            <p className="mt-4 text-[15px] font-medium">
              {myBCodes.length === 0
                ? "No B-Codes yet"
                : "No matching B-Codes"}
            </p>

            <p className="mt-1 max-w-[280px] text-[13px] leading-5 text-muted-foreground">
              {myBCodes.length === 0
                ? "B-Codes you create will appear here."
                : "Try another filter to see your B-Codes."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMyBCodes.map((item) => {
              const token = getHistoryToken(item.token);
              const amount = formatUnits(
                item.amount,
                BCODE_TOKEN_DECIMALS
              );

              const displayAmount =
                Number(amount).toLocaleString(
                  undefined,
                  {
                    maximumFractionDigits: 6,
                  }
                );

              const status = item.cancelled
                ? "Canceled"
                : item.redeemed
                ? "Redeemed"
                : "Active";

              const isExpanded =
                expandedBCodeHash === item.hash;

              return (
                <div
                  key={item.hash}
                  className="overflow-hidden rounded-[12px] border border-border bg-input"
                >
                  <div
                    className={`group flex items-center gap-3 px-3 py-3 sm:px-4 ${
                      isExpanded
                        ? "-translate-x-[126px] sm:translate-x-0"
                        : "translate-x-0"
                    } transition-transform duration-200 sm:transform-none`}
                    onClick={() => {
                      if (
                        window.matchMedia(
                          "(max-width: 639px)"
                        ).matches
                      ) {
                        setExpandedBCodeHash(
                          isExpanded
                            ? null
                            : item.hash
                        );
                      }
                    }}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {token ? (
                        <Image
                          src={token.logo}
                          alt=""
                          width={34}
                          height={34}
                          className="h-[34px] w-[34px] shrink-0 object-contain"
                        />
                      ) : (
                        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                          ?
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-semibold">
                            {displayAmount}{" "}
                            {token?.symbol ?? "TOKEN"}
                          </span>

                          <span
                            className={`shrink-0 text-[11px] ${
                              item.cancelled ||
                              item.redeemed
                                ? "text-muted-foreground"
                                : "text-primary"
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-[12px] text-muted-foreground">
                          {item.code}
                        </p>

                        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                          Base Sepolia
                        </p>
                      </div>
                    </div>

                    <div
                      className={`absolute right-3 flex shrink-0 items-center gap-1 sm:static sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 ${
                        isExpanded
                          ? "opacity-100"
                          : "opacity-0 sm:opacity-0"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyMyBCode(item.code);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-secondary text-muted-foreground transition hover:text-foreground"
                        aria-label="Copy B-Code"
                      >
                        {copiedBCode === item.code ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>

                      {!item.redeemed &&
                        !item.cancelled && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCancelHash(item.hash);
                              setCancelError("");
                              setExpandedBCodeHash(null);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-secondary text-muted-foreground transition hover:text-foreground"
                            aria-label="Cancel B-Code"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}
  </div>
</div>
</section>

        {/* ====================================================
            CANCEL B-CODE CONFIRMATION
        ==================================================== */}

        {cancelHash && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-[400px] rounded-[16px] border border-border bg-[#0B0B16] p-5 shadow-2xl sm:p-6">
              <h2 className="text-[18px] font-semibold">
                Cancel B-Code?
              </h2>
              <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
                This will permanently mark the B-Code as cancelled and return the locked tokens to your wallet. You will need to approve a blockchain transaction.
              </p>

              {cancelError && (
                <div className="mt-4 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12px] leading-5 text-destructive">
                  {cancelError}
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!cancelLoading) {
                      setCancelHash(null);
                      setCancelError("");
                    }
                  }}
                  disabled={cancelLoading}
                  className="flex h-[48px] flex-1 items-center justify-center rounded-[10px] border border-border bg-input text-[14px] font-medium transition hover:bg-secondary disabled:opacity-50"
                >
                  Keep B-Code
                </button>

                <button
                  type="button"
                  onClick={handleCancelBCode}
                  disabled={cancelLoading}
                  className="flex h-[48px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary text-[14px] font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLoading && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {cancelLoading ? "Cancelling..." : "Cancel B-Code"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/*
 * ====================================================
 * B-CODE PROGRESS
 * ====================================================
 */

function BCodeProgress({
  title,
  stage,
  labels,
}: {
  title: string;
  stage: 1 | 2 | 3;
  labels: [string, string, string];
}) {
  const progress =
    stage === 1
      ? 0
      : stage === 2
      ? 50
      : 100;

  return (
    <div className="py-12 text-center">
      <div className="mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-full bg-primary">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      </div>

      <h2 className="mt-7 text-[24px] font-semibold tracking-[-0.03em]">
        {title}
      </h2>

      <p className="mt-3 text-[15px] text-muted-foreground">
        {labels[stage - 1]}
      </p>

      <div className="relative mx-auto mt-9 w-full max-w-[310px]">
        <div className="relative h-[3px] w-full rounded-full bg-[#090d24]">
          <div
            className="absolute left-0 top-0 h-[3px] rounded-full bg-primary transition-all duration-700 ease-in-out"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />

        <div
          className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${
            stage >= 2
              ? "bg-primary"
              : "bg-[#080b1c]"
          }`}
        />

        <div
          className={`absolute right-0 top-1/2 h-3 w-3 translate-x-1/2 -translate-y-1/2 rounded-full ${
            stage >= 3
              ? "bg-primary"
              : "bg-[#080b1c]"
          }`}
        />
      </div>
    </div>
  );
}

/*
 * ====================================================
 * COPY BUTTON
 * ====================================================
 */

function CopyButton({
  value,
}: {
  value: string;
}) {
  const [copied, setCopied] =
    useState(false);

  const handleCopy =
    async () => {
      if (!value) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          value
        );

        setCopied(true);

        setTimeout(
          () => setCopied(false),
          1500
        );
      } catch (error) {
        console.error(
          "COPY ERROR:",
          error
        );
      }
    };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? (
        <Check className="h-4 w-4 text-[#1557E8]" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

/*
 * ====================================================
 * SHORTEN ADDRESS
 * ====================================================
 */

function shortenAddress(
  address: string
) {
  if (
    !address ||
    address.length < 12
  ) {
    return address;
  }

  return `${address.slice(
    0,
    6
  )}...${address.slice(-4)}`;
}

/*
 * ====================================================
 * ONRAMP COUNTDOWN
 * ====================================================
 */

function formatCountdown(
  seconds: number
) {
  const safeSeconds =
    Math.max(
      0,
      seconds
    );

  const minutes =
    Math.floor(
      safeSeconds / 60
    );

  const remainingSeconds =
    safeSeconds % 60;

  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    remainingSeconds
  ).padStart(
    2,
    "0"
  )}`;
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
  network,
}: {
  amount: string;
  cryptoAmount: string;
  cryptoSymbol: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  dateTime: string;
  transactionHash: string;
  network: NetworkKey;
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
      document.createElement(
        "canvas"
      );

    canvas.width = width;
    canvas.height = height;

    const ctx =
      canvas.getContext(
        "2d"
      );

    if (!ctx) {
      throw new Error(
        "Unable to generate receipt."
      );
    }

    ctx.fillStyle =
      "#050511";

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

    ctx.fillStyle =
      "#0f0f1b";

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
        (width -
          logoWidth) /
          2,
        128,
        logoWidth,
        logoHeight
      );
    } catch {
      ctx.fillStyle =
        "#ffffff";

      ctx.font =
        `600 32px ${RECEIPT_FONT}`;

      ctx.textAlign =
        "center";

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

    ctx.textAlign =
      "center";

    ctx.font =
      `700 82px ${RECEIPT_FONT}`;

    ctx.fillStyle =
      "#ffffff";

    ctx.fillText(
      `₦${formattedNaira}`,
      width / 2,
      370
    );

    ctx.font =
      `600 34px ${RECEIPT_FONT}`;

    ctx.fillStyle =
      "#ffffff";

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

    ctx.fillStyle =
      "#050511";

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
          bottomContainerHeight /
            2,
        40,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.textAlign =
      "left";

    ctx.font =
      `500 23px ${RECEIPT_FONT}`;

    ctx.fillStyle =
      "#ffffff";

    ctx.fillText(
      "Scan code to verify this",
      280,
      bottomContainerY +
        67
    );

    ctx.fillText(
      "transaction on-chain",
      280,
      bottomContainerY +
        101
    );

    const explorerUrl =
      `${getNetworkConfig(network).explorerTx}${transactionHash}`;

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
        qrContainerSize) /
        2;

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

    ctx.textAlign =
      "center";

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

    URL.revokeObjectURL(
      url
    );
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
  ctx.textAlign =
    "left";

  ctx.font =
    `400 25px ${RECEIPT_FONT}`;

  ctx.fillStyle =
    "#aaaab5";

  ctx.fillText(
    label,
    labelX,
    y
  );

  ctx.textAlign =
    "right";

  ctx.font =
    `600 25px ${RECEIPT_FONT}`;

  ctx.fillStyle =
    "#ffffff";

  const maxWidth =
    valueX -
    labelX -
    300;

  let displayValue =
    value;

  while (
    ctx.measureText(
      displayValue
    ).width >
      maxWidth &&
    displayValue.length >
      5
  ) {
    displayValue =
      displayValue.slice(
        0,
        -1
      );
  }

  if (
    displayValue !==
    value
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

/************************************************************
 * SWAP VIEW
 ************************************************************/

type SwapNetwork = {
  chainId: number;
  slug: string;
  name: string;
  symbol: string;
  nativeToken: {
    symbol: string;
    name: string;
    decimals: number;
    address: string;
    logoURI: string;
    isNative: boolean;
  };
};

type SwapToken = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string | null;
  isNative: boolean;
};

type SwapPriceResponse = {
  success?: boolean;
  chainId?: number;
  sellToken?: string;
  buyToken?: string;
  quoteType?: "sell" | "buy";
  sellAmount?: string | null;
  buyAmount?: string | null;
  maxSellAmount?: string | null;
  liquidityAvailable?: boolean | null;
  allowanceTarget?: string | null;

  fees?: {
    integratorFee?: {
      amount?: string;
      token?: string;
      type?: string;
    } | null;
  } | null;

  issues?: {
    allowance?: {
      actual?: string;
      spender?: string;
    } | null;

    balance?: {
      token?: string;
      actual?: string;
      expected?: string;
    } | null;
  } | null;
};

type SwapQuoteResponse = SwapPriceResponse & {
  minBuyAmount?: string | null;

  transaction?: {
    to?: string;
    data?: string;
    value?: string;
    gas?: string;
    gasPrice?: string;
  } | null;
};

/************************************************************
 * SWAP TOKEN LOGO
 ************************************************************/

function SwapTokenLogo({
  token,
  size = 22,
}: {
  token: SwapToken | null;
  size?: number;
}) {
  if (!token?.logoURI) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold"
        style={{
          width: size,
          height: size,
        }}
      >
        {token?.symbol?.slice(0, 1) || "?"}
      </div>
    );
  }

  return (
    <img
      src={token.logoURI}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-contain"
    />
  );
}

/************************************************************
 * SWAP NETWORK BUTTON
 ************************************************************/

function SwapNetworkButton({
  network,
  networks,
  value,
  onChange,
  disabled = false,
}: {
  network?: SwapNetwork | null;
  networks: SwapNetwork[];
  value: number | null;
  onChange: (chainId: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const current =
    networks.find((item) => item.chainId === value) ?? network;

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (ref.current && !ref.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled || networks.length === 0}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={`flex h-10 items-center gap-2 rounded-[8px] border border-border bg-[#050511] px-2.5 text-[13px] font-medium transition ${
          disabled
            ? "cursor-default opacity-60"
            : "hover:bg-secondary"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current ? (
          <img
            src={
              current.slug === "base"
                ? "/base-logo.svg"
                : "/bsc-logo.svg"
            }
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
        ) : (
          <div className="h-5 w-5 rounded-full bg-secondary" />
        )}

        <span className="hidden sm:inline">
          {current?.name || "Network"}
        </span>

        {!disabled && (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && !disabled && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[220px] overflow-hidden rounded-[11px] border border-border bg-[#070812] p-1.5 shadow-2xl">
          {networks.map((item) => (
            <button
              key={item.chainId}
              type="button"
              onClick={() => {
                onChange(item.chainId);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-left transition hover:bg-secondary"
            >
              <span className="flex items-center gap-2.5">
                <img
                  src={
                    item.slug === "base"
                      ? "/base-logo.svg"
                      : "/bsc-logo.svg"
                  }
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                />

                <span className="text-[13px]">
                  {item.name}
                </span>
              </span>

              {value === item.chainId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/************************************************************
 * SWAP TOKEN SELECTOR
 *
 * Network selector lives INSIDE the dropdown.
 * SELL: network selector active.
 * BUY: network selector disabled and follows SELL network.
 ************************************************************/

function SwapTokenSelector({
  label,
  token,
  tokens,
  loading,
  search,
  onSearchChange,
  onSelect,
  networks,
  selectedNetwork,
  onNetworkChange,
  networkDisabled = false,
  disabled = false,
}: {
  label: string;
  token: SwapToken | null;
  tokens: SwapToken[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (token: SwapToken) => void;
  networks: SwapNetwork[];
  selectedNetwork: SwapNetwork | null;
  onNetworkChange?: (chainId: number) => void;
  networkDisabled?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (ref.current && !ref.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  return (
    <div ref={ref} className="relative min-w-0 shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={`flex h-[52px] items-center gap-2 rounded-[9px] bg-[#10101B] px-3 transition ${
          disabled
            ? "cursor-default opacity-60"
            : "hover:bg-[#151522]"
        }`}
        aria-expanded={open}
      >
        {token ? <SwapTokenLogo token={token} /> : null}

        <span
          className={
            token
              ? "text-[15px] font-semibold"
              : "text-[15px] text-muted-foreground"
          }
        >
          {token?.symbol || label}
        </span>

        {!disabled && (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[90] w-[min(390px,calc(100vw-40px))] overflow-hidden rounded-[12px] border border-border bg-[#070812] shadow-2xl">
          {/* SEARCH + NETWORK */}
          <div className="border-b border-border p-3">
            <div className="flex items-center gap-2">
              {/* SEARCH */}
              <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-border bg-[#050511] px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />

                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(event) =>
                    onSearchChange(event.target.value)
                  }
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                  placeholder="Search token"
                  className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* NETWORK */}
              <SwapNetworkButton
                networks={
                  networkDisabled && selectedNetwork
                    ? [selectedNetwork]
                    : networks
                }
                value={selectedNetwork?.chainId ?? null}
                network={selectedNetwork}
                onChange={(chainId) =>
                  onNetworkChange?.(chainId)
                }
                disabled={networkDisabled}
              />
            </div>
          </div>

          {/* TOKEN LIST */}
          <div className="max-h-[300px] overflow-y-auto p-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : tokens.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                No tokens found.
              </div>
            ) : (
              tokens.map((item) => (
                <button
                  key={`${item.chainId}-${item.address}`}
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition hover:bg-secondary"
                >
                  <SwapTokenLogo
                    token={item}
                    size={32}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[14px] font-semibold">
                        {item.symbol}
                      </span>

                      {token?.address?.toLowerCase() ===
                        item.address.toLowerCase() && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </div>

                    <span className="block truncate text-[12px] text-muted-foreground">
                      {item.name}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/********************************************************************************
 * SWAP VIEW
 ********************************************************************************/

function SwapView({
  onBackHome,
}: {
  onBackHome: () => void;
}) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const wallet = wallets[0];

  const [networks, setNetworks] = useState<SwapNetwork[]>([]);
  const [networksLoading, setNetworksLoading] = useState(true);
  const [networkError, setNetworkError] = useState("");

  const [sellNetwork, setSellNetwork] =
    useState<SwapNetwork | null>(null);

  const [sellToken, setSellToken] =
    useState<SwapToken | null>(null);

  const [buyToken, setBuyToken] =
    useState<SwapToken | null>(null);

  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");

  const [sellSearch, setSellSearch] = useState("");
  const [buySearch, setBuySearch] = useState("");

  const [sellTokens, setSellTokens] =
    useState<SwapToken[]>([]);

  const [buyTokens, setBuyTokens] =
    useState<SwapToken[]>([]);

  const [sellTokensLoading, setSellTokensLoading] =
    useState(false);

  const [buyTokensLoading, setBuyTokensLoading] =
    useState(false);

  const [price, setPrice] =
    useState<SwapPriceResponse | null>(null);

  const [priceLoading, setPriceLoading] =
    useState(false);

  const [priceError, setPriceError] = useState("");
  const [swapError, setSwapError] = useState("");
  const [swapLoading, setSwapLoading] = useState(false);

  // ============================================================
  // SWAP SUCCESS STATE
  // ============================================================

  const [swapSuccess, setSwapSuccess] =
    useState(false);

  const [successSellSymbol, setSuccessSellSymbol] =
    useState("");

  const [successBuySymbol, setSuccessBuySymbol] =
    useState("");

  const [successTxHash, setSuccessTxHash] =
    useState("");

  const [successChainId, setSuccessChainId] =
    useState<number | null>(null);

  // ============================================================
  // SWAP SETTINGS
  // ============================================================

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Stored as percentage.
  // 0.5 = 0.5% = 50 bps.
  const [slippageTolerance, setSlippageTolerance] =
    useState("0.5");

  const [slippageDraft, setSlippageDraft] =
    useState("0.5");

  const settingsRef =
    useRef<HTMLDivElement | null>(null);

  // ============================================================
  // SWAP ARROW
  // ============================================================

  const [isReversing, setIsReversing] =
    useState(false);

  const lastEditedRef =
    useRef<"sell" | "buy">("sell");

  const priceRequestRef = useRef(0);
  const lastPricedKeyRef = useRef("");

  const sellTokenRequestRef = useRef(0);
  const buyTokenRequestRef = useRef(0);

  /*
   * BUY network always follows SELL network.
   */
  const buyNetwork = sellNetwork;

  // ============================================================
  // HELPERS
  // ============================================================

  const getTokenAmountUnits = (
    value: string,
    decimals: number
  ) => {
    if (
      !value ||
      !/^\d*(\.\d*)?$/.test(value) ||
      value === "."
    ) {
      return null;
    }

    try {
      return parseUnits(
        value,
        decimals
      ).toString();
    } catch {
      return null;
    }
  };

  const formatTokenAmount = (
    units: string | null | undefined,
    decimals: number
  ) => {
    if (!units) return "";

    try {
      const formatted = formatUnits(
        BigInt(units),
        decimals
      );

      const [whole, fraction = ""] =
        formatted.split(".");

      const trimmedFraction =
        fraction.replace(/0+$/, "");

      return trimmedFraction
        ? `${whole}.${trimmedFraction.slice(0, 8)}`
        : whole;
    } catch {
      return "";
    }
  };

  /*
   * Convert percentage into basis points.
   *
   * 0.1% = 10 bps
   * 0.5% = 50 bps
   * 1%   = 100 bps
   */
  const getSlippageBps = () => {
    const value = Number(
      slippageTolerance
    );

    if (!Number.isFinite(value)) {
      return 50;
    }

    return Math.round(value * 100);
  };

  /*
   * Explorer URL for supported networks.
   */
  const getExplorerTxUrl = (
    chainId: number,
    hash: string
  ) => {
    if (chainId === 8453) {
      return `https://basescan.org/tx/${hash}`;
    }

    if (chainId === 56) {
      return `https://bscscan.com/tx/${hash}`;
    }

    return "";
  };

  // ============================================================
  // SETTINGS
  // ============================================================

  const openSwapSettings = () => {
    setSlippageDraft(
      slippageTolerance
    );

    setSettingsOpen(true);
  };

  const handleSlippageDraftChange = (
    value: string
  ) => {
    if (!/^\d*(\.\d{0,2})?$/.test(value)) {
      return;
    }

    setSlippageDraft(value);
    setSwapError("");
  };

  const applySwapSettings = () => {
    const value = Number(
      slippageDraft
    );

    if (
      !Number.isFinite(value) ||
      value < 0.01 ||
      value > 100
    ) {
      setSwapError(
        "Slippage tolerance must be between 0.01% and 100%."
      );

      return;
    }

    const normalizedValue =
      value.toString();

    const changed =
      normalizedValue !==
      slippageTolerance;

    setSlippageTolerance(
      normalizedValue
    );

    setSlippageDraft(
      normalizedValue
    );

    setSettingsOpen(false);

    /*
     * Only invalidate the quote if the
     * slippage setting actually changed.
     */
    if (changed) {
      clearPrice();
    }

    setSwapError("");
  };

  /*
   * Close settings when clicking outside
   * or pressing Escape.
   */
  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    const handleClickOutside = (
      event: MouseEvent
    ) => {
      const target =
        event.target as Node;

      if (
        settingsRef.current &&
        !settingsRef.current.contains(target)
      ) {
        setSettingsOpen(false);
      }
    };

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [settingsOpen]);

  // ============================================================
  // LOAD NETWORKS
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    const loadNetworks = async () => {
      setNetworksLoading(true);
      setNetworkError("");

      try {
        const response = await fetch(
          "/api/swap/networks",
          {
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to load swap networks."
          );
        }

        const loaded =
          Array.isArray(data?.networks)
            ? data.networks
            : [];

        if (!cancelled) {
          setNetworks(loaded);

          const defaultNetwork =
            loaded.find(
              (network: SwapNetwork) =>
                network.chainId === 8453
            ) ??
            loaded[0] ??
            null;

          setSellNetwork(
            defaultNetwork
          );
        }
      } catch (error) {
        if (!cancelled) {
          setNetworkError(
            error instanceof Error
              ? error.message
              : "Unable to load swap networks."
          );
        }
      } finally {
        if (!cancelled) {
          setNetworksLoading(false);
        }
      }
    };

    loadNetworks();

    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // LOAD TOKENS
  // ============================================================

  const loadTokens = async (
    chainId: number,
    search: string,
    side: "sell" | "buy"
  ) => {
    const requestRef =
      side === "sell"
        ? sellTokenRequestRef
        : buyTokenRequestRef;

    const requestId =
      ++requestRef.current;

    if (side === "sell") {
      setSellTokensLoading(true);
    } else {
      setBuyTokensLoading(true);
    }

    try {
      const response = await fetch(
        `/api/swap/tokens?chainId=${chainId}&search=${encodeURIComponent(
          search
        )}&limit=100`,
        {
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load tokens."
        );
      }

      if (
        requestId !==
        requestRef.current
      ) {
        return;
      }

      const loaded =
        Array.isArray(data?.tokens)
          ? data.tokens
          : [];

      if (side === "sell") {
        setSellTokens(loaded);
      } else {
        setBuyTokens(loaded);
      }
    } catch (error) {
      if (
        requestId !==
        requestRef.current
      ) {
        return;
      }

      if (side === "sell") {
        setSellTokens([]);
      } else {
        setBuyTokens([]);
      }

      console.error(
        "SWAP TOKEN LOAD ERROR:",
        error
      );
    } finally {
      if (
        requestId ===
        requestRef.current
      ) {
        if (side === "sell") {
          setSellTokensLoading(false);
        } else {
          setBuyTokensLoading(false);
        }
      }
    }
  };

  // ============================================================
  // SELL TOKENS
  // ============================================================

  useEffect(() => {
    if (!sellNetwork) {
      setSellTokens([]);
      return;
    }

    const timeout = setTimeout(() => {
      loadTokens(
        sellNetwork.chainId,
        sellSearch,
        "sell"
      );
    }, 250);

    return () =>
      clearTimeout(timeout);
  }, [
    sellNetwork?.chainId,
    sellSearch,
  ]);

  // ============================================================
  // BUY TOKENS
  // ============================================================

  useEffect(() => {
    if (!buyNetwork) {
      setBuyTokens([]);
      return;
    }

    const timeout = setTimeout(() => {
      loadTokens(
        buyNetwork.chainId,
        buySearch,
        "buy"
      );
    }, 250);

    return () =>
      clearTimeout(timeout);
  }, [
    buyNetwork?.chainId,
    buySearch,
  ]);

  // ============================================================
  // CLEAR PRICE
  // ============================================================

  const clearPrice = () => {
    setPrice(null);
    setPriceError("");
    lastPricedKeyRef.current = "";
  };

  // ============================================================
  // REQUEST PRICE
  // ============================================================

  const requestPrice = async () => {
    if (
      !sellNetwork ||
      !sellToken ||
      !buyToken
    ) {
      return;
    }

    const activeSide =
      lastEditedRef.current;

    const activeValue =
      activeSide === "sell"
        ? sellAmount
        : buyAmount;

    const activeToken =
      activeSide === "sell"
        ? sellToken
        : buyToken;

    const units =
      getTokenAmountUnits(
        activeValue,
        activeToken.decimals
      );

    if (!units || units === "0") {
      clearPrice();
      return;
    }

    const priceKey =
      `${activeSide}:${sellNetwork.chainId}:${sellToken.address.toLowerCase()}:${buyToken.address.toLowerCase()}:${activeValue}:${slippageTolerance}`;

    if (
      priceKey ===
      lastPricedKeyRef.current
    ) {
      return;
    }

    lastPricedKeyRef.current =
      priceKey;

    const requestId =
      ++priceRequestRef.current;

    setPriceLoading(true);
    setPriceError("");

    try {
      const response = await fetch(
        "/api/swap/price",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            chainId:
              sellNetwork.chainId,

            sellToken:
              sellToken.address,

            buyToken:
              buyToken.address,

            ...(activeSide === "sell"
              ? {
                  sellAmount: units,
                }
              : {
                  buyAmount: units,
                }),

            taker:
              wallet?.address,
          }),
        }
      );

      const data: SwapPriceResponse & {
        error?: string;
      } = await response.json();

      if (
        requestId !==
        priceRequestRef.current
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to get swap price."
        );
      }

      if (
        data.liquidityAvailable ===
        false
      ) {
        throw new Error(
          "No liquidity available for this token pair."
        );
      }

      setPrice(data);

      if (activeSide === "sell") {
        setBuyAmount(
          formatTokenAmount(
            data.buyAmount,
            buyToken.decimals
          )
        );
      } else {
        setSellAmount(
          formatTokenAmount(
            data.maxSellAmount ??
              data.sellAmount,
            sellToken.decimals
          )
        );
      }
    } catch (error) {
      if (
        requestId !==
        priceRequestRef.current
      ) {
        return;
      }

      setPrice(null);
      lastPricedKeyRef.current = "";

      setPriceError(
        error instanceof Error
          ? error.message
          : "Unable to get swap price."
      );
    } finally {
      if (
        requestId ===
        priceRequestRef.current
      ) {
        setPriceLoading(false);
      }
    }
  };

  // ============================================================
  // PRICE EFFECT
  // ============================================================

  useEffect(() => {
    if (
      !sellNetwork ||
      !sellToken ||
      !buyToken
    ) {
      return;
    }

    const activeValue =
      lastEditedRef.current === "sell"
        ? sellAmount
        : buyAmount;

    if (
      !activeValue ||
      Number(activeValue) <= 0
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      requestPrice();
    }, 450);

    return () =>
      clearTimeout(timeout);
  }, [
    sellAmount,
    buyAmount,
    sellToken?.address,
    buyToken?.address,
    sellNetwork?.chainId,
    slippageTolerance,
  ]);

  // ============================================================
  // SELL NETWORK CHANGE
  // ============================================================

  const handleSellNetworkChange = (
    chainId: number
  ) => {
    const next =
      networks.find(
        (item) =>
          item.chainId === chainId
      ) ?? null;

    setSellNetwork(next);

    setSellToken(null);
    setBuyToken(null);

    setSellAmount("");
    setBuyAmount("");

    setSellSearch("");
    setBuySearch("");

    clearPrice();
    setSwapError("");

    lastEditedRef.current =
      "sell";
  };

  // ============================================================
  // SELL TOKEN CHANGE
  // ============================================================

  const handleSellTokenSelect = (
    token: SwapToken
  ) => {
    setSellToken(token);

    setBuyToken(null);

    setSellAmount("");
    setBuyAmount("");

    setSellSearch("");
    setBuySearch("");

    clearPrice();
    setSwapError("");

    lastEditedRef.current =
      "sell";
  };

  // ============================================================
  // BUY TOKEN CHANGE
  // ============================================================

  const handleBuyTokenSelect = (
    token: SwapToken
  ) => {
    setBuyToken(token);

    setBuyAmount("");
    setBuySearch("");

    clearPrice();
    setSwapError("");

    if (sellAmount) {
      lastEditedRef.current =
        "sell";
    }
  };

  // ============================================================
  // SELL AMOUNT
  // ============================================================

  const handleSellAmountChange = (
    value: string
  ) => {
    if (
      !/^\d*(\.\d*)?$/.test(value)
    ) {
      return;
    }

    lastEditedRef.current =
      "sell";

    setSellAmount(value);
    setSwapError("");

    if (!value) {
      setBuyAmount("");
      clearPrice();
    }
  };

  // ============================================================
  // BUY AMOUNT
  // ============================================================

  const handleBuyAmountChange = (
    value: string
  ) => {
    if (
      !/^\d*(\.\d*)?$/.test(value)
    ) {
      return;
    }

    lastEditedRef.current =
      "buy";

    setBuyAmount(value);
    setSwapError("");

    if (!value) {
      setSellAmount("");
      clearPrice();
    }
  };

  // ============================================================
  // REVERSE SWAP
  // ============================================================

  const handleReverseSwap = () => {
    /*
     * Prevent multiple clicks while the reversal
     * is being processed.
     */
    if (isReversing) {
      return;
    }

    /*
     * There is nothing to reverse if neither token
     * has been selected.
     */
    if (!sellToken && !buyToken) {
      return;
    }

    setIsReversing(true);

    /*
     * Use the currently displayed amounts.
     */
    const currentSellToken =
      sellToken;

    const currentBuyToken =
      buyToken;

    const currentSellAmount =
      displayedSellAmount;

    const currentBuyAmount =
      displayedBuyAmount;

    /*
     * Swap the tokens.
     */
    setSellToken(
      currentBuyToken
    );

    setBuyToken(
      currentSellToken
    );

    /*
     * Swap the amounts.
     */
    setSellAmount(
      currentBuyAmount
    );

    setBuyAmount(
      currentSellAmount
    );

    /*
     * Searches are reset because the selected
     * tokens have changed sides.
     */
    setSellSearch("");
    setBuySearch("");

    /*
     * The newly reversed Sell amount is now
     * the source amount.
     */
    lastEditedRef.current =
      "sell";

    /*
     * The previous quote is no longer valid.
     */
    clearPrice();
    setPriceError("");
    setSwapError("");

    /*
     * Small visual feedback for the arrow.
     */
    setTimeout(() => {
      setIsReversing(false);
    }, 180);
  };

  // ============================================================
  // ACTIVE SELL UNITS
  // ============================================================

  const getActiveSellUnits = () => {
    if (!sellToken) {
      return null;
    }

    if (
      lastEditedRef.current === "buy"
    ) {
      return (
        price?.maxSellAmount ??
        null
      );
    }

    return getTokenAmountUnits(
      sellAmount,
      sellToken.decimals
    );
  };

  // ============================================================
  // EXECUTE SWAP
  // ============================================================

  const executeSwap = async () => {
    if (
      !sellNetwork ||
      !sellToken ||
      !buyToken ||
      !wallet?.address
    ) {
      setSwapError(
        "Connect your wallet and complete both token fields first."
      );

      return;
    }

    if (!price) {
      setSwapError(
        "Get a swap price before continuing."
      );

      return;
    }

    const activeSellUnits =
      getActiveSellUnits();

    if (
      !activeSellUnits ||
      activeSellUnits === "0"
    ) {
      setSwapError(
        "Enter a valid amount."
      );

      return;
    }

    setSwapLoading(true);
    setSwapError("");

    const slippageBps =
      getSlippageBps();

    try {
      /*
       * Switch wallet to SELL network.
       */
      if (wallet.switchChain) {
        await wallet.switchChain(
          sellNetwork.chainId
        );
      }

      /*
       * Get the public client for the
       * current network.
       *
       * This is also used later to wait for
       * the swap transaction to be mined.
       */
      const publicClient =
        getPublicClient(
          sellNetwork.chainId ===
            BSC_CHAIN_ID
            ? "bnb-smart-chain"
            : "base"
        );

      /*
       * Request quote.
       */
      const quoteResponse =
        await fetch(
          "/api/swap/quote",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              chainId:
                sellNetwork.chainId,

              sellToken:
                sellToken.address,

              buyToken:
                buyToken.address,

              taker:
                wallet.address,

              slippageBps,

              ...(lastEditedRef.current ===
              "buy"
                ? {
                    buyAmount:
                      getTokenAmountUnits(
                        buyAmount,
                        buyToken.decimals
                      ),
                  }
                : {
                    sellAmount:
                      activeSellUnits,
                  }),
            }),
          }
        );

      const quoteData: SwapQuoteResponse & {
        error?: string;
      } = await quoteResponse.json();

      if (!quoteResponse.ok) {
        throw new Error(
          quoteData?.error ||
            "Unable to prepare swap transaction."
        );
      }

      /*
       * Balance check.
       */
      const balanceIssue =
        quoteData.issues?.balance;

      if (balanceIssue) {
        const actual =
          formatTokenAmount(
            balanceIssue.actual,
            sellToken.decimals
          );

        const expected =
          formatTokenAmount(
            balanceIssue.expected,
            sellToken.decimals
          );

        throw new Error(
          `Insufficient ${sellToken.symbol} balance. Available: ${
            actual || "0"
          }. Required: ${
            expected || "more"
          }.`
        );
      }

      const transaction =
        quoteData.transaction;

      if (
        !transaction?.to ||
        !transaction.data
      ) {
        throw new Error(
          "0x did not return a valid swap transaction."
        );
      }

      const requiredSellUnits =
        lastEditedRef.current === "buy"
          ? quoteData.maxSellAmount ??
            activeSellUnits
          : quoteData.sellAmount ??
            activeSellUnits;

      /*
       * ERC-20 approval.
       */
      if (!sellToken.isNative) {
        const spender =
          quoteData.allowanceTarget ||
          quoteData.issues?.allowance
            ?.spender;

        if (!spender) {
          throw new Error(
            "0x did not return an allowance target."
          );
        }

        const allowance =
          await publicClient.readContract({
            address:
              sellToken.address as `0x${string}`,

            abi: erc20Abi,

            functionName:
              "allowance",

            args: [
              wallet.address as `0x${string}`,
              spender as `0x${string}`,
            ],
          });

        if (
          allowance <
          BigInt(requiredSellUnits)
        ) {
          const approvalData =
            encodeFunctionData({
              abi: erc20Abi,

              functionName:
                "approve",

              args: [
                spender as `0x${string}`,
                maxUint256,
              ],
            });

          const approvalResult =
            await sendTransaction(
              {
                to: sellToken.address as `0x${string}`,

                data: approvalData,

                value: BigInt(0),

                chainId:
                  sellNetwork.chainId,
              },
              {
                address:
                  wallet.address,
              }
            );

          if (
            !approvalResult?.hash
          ) {
            throw new Error(
              "Token approval was not submitted."
            );
          }

          /*
           * Wait for approval to be mined
           * before continuing.
           */
          const approvalReceipt =
            await publicClient.waitForTransactionReceipt(
              {
                hash:
                  approvalResult.hash,

                confirmations: 1,
              }
            );

          if (
            approvalReceipt.status !==
            "success"
          ) {
            throw new Error(
              "Token approval transaction failed."
            );
          }
        }
      }

      /*
       * Refresh quote after approval.
       */
      const finalQuoteResponse =
        await fetch(
          "/api/swap/quote",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              chainId:
                sellNetwork.chainId,

              sellToken:
                sellToken.address,

              buyToken:
                buyToken.address,

              taker:
                wallet.address,

              slippageBps,

              ...(lastEditedRef.current ===
              "buy"
                ? {
                    buyAmount:
                      getTokenAmountUnits(
                        buyAmount,
                        buyToken.decimals
                      ),
                  }
                : {
                    sellAmount:
                      getTokenAmountUnits(
                        sellAmount,
                        sellToken.decimals
                      ),
                  }),
            }),
          }
        );

      const finalQuote:
        SwapQuoteResponse & {
          error?: string;
        } =
        await finalQuoteResponse.json();

      if (
        !finalQuoteResponse.ok
      ) {
        throw new Error(
          finalQuote?.error ||
            "Unable to refresh swap transaction."
        );
      }

      if (
        finalQuote.issues?.balance
      ) {
        throw new Error(
          "Insufficient token balance for this swap."
        );
      }

      if (
        !finalQuote.transaction?.to ||
        !finalQuote.transaction.data
      ) {
        throw new Error(
          "0x did not return a valid swap transaction."
        );
      }

      /*
       * Capture the symbols before waiting for
       * the transaction.
       *
       * This ensures the success modal always
       * shows the tokens involved in this swap.
       */
      const completedSellSymbol =
        sellToken.symbol;

      const completedBuySymbol =
        buyToken.symbol;

      /*
       * Send swap transaction.
       */
      const swapResult =
        await sendTransaction(
          {
            to: finalQuote.transaction
              .to as `0x${string}`,

            data: finalQuote.transaction
              .data as `0x${string}`,

            value: BigInt(
              finalQuote.transaction.value ??
                "0"
            ),

            chainId:
              sellNetwork.chainId,
          },
          {
            address:
              wallet.address,
          }
        );

      const transactionHash =
        swapResult?.hash;

      if (!transactionHash) {
        throw new Error(
          "Swap transaction was not submitted."
        );
      }

      /*
       * IMPORTANT:
       *
       * Do NOT show the success modal yet.
       *
       * Wait until the transaction has actually
       * been mined and confirmed.
       */
      const swapReceipt =
        await publicClient.waitForTransactionReceipt(
          {
            hash: transactionHash,
            confirmations: 1,
          }
        );

      /*
       * If the transaction was reverted,
       * never show the success modal.
       */
      if (
        swapReceipt.status !==
        "success"
      ) {
        throw new Error(
          "Swap transaction failed."
        );
      }

      /*
       * Transaction is now successfully mined.
       *
       * Only now do we switch the existing swap card
       * into its success state.
       */
      setSuccessTxHash(
        transactionHash
      );

      setSuccessChainId(
        sellNetwork.chainId
      );

      setSuccessSellSymbol(
        completedSellSymbol
      );

      setSuccessBuySymbol(
        completedBuySymbol
      );

      setPrice(finalQuote);
      setSwapError("");
      setSwapSuccess(true);
    } catch (error) {
      console.error(
        "SWAP ERROR:",
        error
      );

      setSwapError(
        error instanceof Error
          ? error.message
          : "Swap failed. Please try again."
      );
    } finally {
      setSwapLoading(false);
    }
  };

  // ============================================================
  // DISPLAY VALUES
  // ============================================================

  const activeSellUnits =
    getActiveSellUnits();

  const hasAmount = Boolean(
    activeSellUnits &&
      activeSellUnits !== "0"
  );

  const readyForPrice = Boolean(
    sellNetwork &&
      sellToken &&
      buyToken &&
      hasAmount
  );

  const canSwap = Boolean(
    authenticated &&
      wallet?.address &&
      readyForPrice &&
      price &&
      !priceLoading
  );

  const displayedSellAmount =
    lastEditedRef.current === "buy"
      ? formatTokenAmount(
          price?.maxSellAmount ??
            price?.sellAmount,
          sellToken?.decimals ?? 18
        )
      : sellAmount;

  const displayedBuyAmount =
    lastEditedRef.current === "sell"
      ? formatTokenAmount(
          price?.buyAmount,
          buyToken?.decimals ?? 18
        ) || buyAmount
      : buyAmount;

  const rate = (() => {
    if (
      !price ||
      !sellToken ||
      !buyToken
    ) {
      return "";
    }

    try {
      const sellUnits =
        BigInt(
          price.sellAmount ??
            price.maxSellAmount ??
            "0"
        );

      const buyUnits =
        BigInt(
          price.buyAmount ??
            "0"
        );

      if (
        sellUnits === BigInt(0) ||
        buyUnits === BigInt(0)
      ) {
        return "";
      }

      const sellHuman =
        Number(
          formatUnits(
            sellUnits,
            sellToken.decimals
          )
        );

      const buyHuman =
        Number(
          formatUnits(
            buyUnits,
            buyToken.decimals
          )
        );

      if (
        !Number.isFinite(
          sellHuman
        ) ||
        sellHuman <= 0
      ) {
        return "";
      }

      return (
        buyHuman / sellHuman
      ).toLocaleString(
        undefined,
        {
          maximumFractionDigits: 8,
        }
      );
    } catch {
      return "";
    }
  })();

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050511]">
      <Background />

      <div className="relative z-10 min-h-screen">
        <SiteNav
          activeTab="swap"
          onQuickPort={onBackHome}
          onBCodes={onBackHome}
          onSwap={() => {}}
        />

        <section className="flex min-h-screen items-start justify-center px-4 pb-10 pt-[112px] sm:px-6 sm:pt-[128px]">
          <div className="w-full max-w-[590px]">
            <div className="rounded-[16px] border border-border bg-card p-5 sm:p-6">
              {swapSuccess ? (
                <div
                  className="flex flex-col items-center justify-center text-center"
                  role="status"
                  aria-live="polite"
                >
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                          <Check className="h-6 w-6 text-white" />
                        </div>
                      </div>

                  <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.03em]">
                    Swap success
                  </h2>

                  <p className="mt-2 max-w-[320px] text-[14px] leading-5 text-muted-foreground">
                    You have successfully swapped{" "}
                    <span className="font-medium text-foreground">
                      {successSellSymbol}
                    </span>{" "}
                    for{" "}
                    <span className="font-medium text-foreground">
                      {successBuySymbol}
                    </span>
                    .
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSwapSuccess(false);
                      setSuccessTxHash("");
                      setSuccessChainId(null);
                      setSuccessSellSymbol("");
                      setSuccessBuySymbol("");

                      setSellToken(null);
                      setBuyToken(null);
                      setSellAmount("");
                      setBuyAmount("");
                      setSellSearch("");
                      setBuySearch("");
                      setSellTokens([]);
                      setBuyTokens([]);
                      clearPrice();
                      setSwapError("");
                      setPriceError("");
                      setSettingsOpen(false);

                      lastEditedRef.current = "sell";
                    }}
                    className="mt-7 flex h-11 w-full items-center justify-center rounded-[9px] bg-primary text-[14px] font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Swap again
                  </button>

                  {successTxHash && successChainId ? (
                    <a
                      href={getExplorerTxUrl(
                        successChainId,
                        successTxHash
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 text-[14px] font-medium text-primary transition hover:opacity-80"
                    >
                      View on explorer
                    </a>
                  ) : null}
                </div>
              ) : (
                <>
              <div className="mb-6 flex items-center justify-between">
                <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
                  Swap
                </h1>

                <div
                  ref={settingsRef}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (settingsOpen) {
                        setSettingsOpen(false);
                      } else {
                        openSwapSettings();
                      }
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-[9px] transition ${
                      settingsOpen
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                    aria-label="Swap settings"
                    title="Swap settings"
                    aria-expanded={
                      settingsOpen
                    }
                    aria-haspopup="dialog"
                  >
                    <Settings className="h-[18px] w-[18px]" />
                  </button>

                  {settingsOpen ? (
                    <div
                      role="dialog"
                      aria-label="Swap settings"
                      className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[290px] rounded-[14px] border border-border bg-[#070812] p-4 shadow-2xl"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold">
                            Swap settings
                          </p>

                          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                            Set the maximum price movement you are willing to accept.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSettingsOpen(false)
                          }
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                          aria-label="Close settings"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[13px] font-medium">
                            Slippage tolerance
                          </span>

                          <span className="text-[12px] text-muted-foreground">
                            {slippageTolerance}%
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            "0.1",
                            "0.5",
                            "1",
                          ].map(
                            (value) => {
                              const active =
                                Number(
                                  slippageDraft
                                ) ===
                                Number(
                                  value
                                );

                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    setSlippageDraft(
                                      value
                                    );
                                    setSwapError("");
                                  }}
                                  className={`h-9 rounded-[8px] border text-[12px] font-medium transition ${
                                    active
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {value}%
                                </button>
                              );
                            }
                          )}
                        </div>

                        <div className="relative mt-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              slippageDraft
                            }
                            onChange={(
                              event
                            ) =>
                              handleSlippageDraftChange(
                                event.target
                                  .value
                              )
                            }
                            placeholder="Custom"
                            className="h-10 w-full rounded-[8px] border border-border bg-[#050511] px-3 pr-8 text-[13px] outline-none transition focus:border-primary"
                            aria-label="Custom slippage tolerance"
                          />

                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                            %
                          </span>
                        </div>

                        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                          Higher slippage can allow a swap to execute during larger price movements.
                        </p>

                        <button
                          type="button"
                          onClick={
                            applySwapSettings
                          }
                          className="mt-4 h-10 w-full rounded-[8px] bg-primary text-[13px] font-semibold text-primary-foreground transition hover:opacity-90"
                        >
                          Apply settings
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {networkError ? (
                <div className="mb-4 rounded-[9px] border border-destructive/30 bg-destructive/10 px-3 py-3 text-[13px] text-destructive">
                  {networkError}
                </div>
              ) : null}

              {/* ==================================================
                  SELL
              ================================================== */}

              <div className="rounded-[14px] bg-[#10101B] p-2">
                <div className="mb-1 flex items-center justify-between px-2 py-1.5">
                  <span className="text-[14px] font-medium">
                    Sell
                  </span>

                  <span className="text-[13px] text-muted-foreground">
                    {sellToken
                      ? `Balance: ${sellToken.symbol}`
                      : "Balance: --"}
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-[10px] bg-[#050511] p-2">
                  <SwapTokenSelector
                    label="Select token"
                    token={sellToken}
                    tokens={sellTokens}
                    loading={
                      sellTokensLoading ||
                      networksLoading
                    }
                    search={sellSearch}
                    onSearchChange={
                      setSellSearch
                    }
                    onSelect={
                      handleSellTokenSelect
                    }
                    networks={networks}
                    selectedNetwork={
                      sellNetwork
                    }
                    onNetworkChange={
                      handleSellNetworkChange
                    }
                    networkDisabled={
                      networksLoading
                    }
                    disabled={
                      networksLoading
                    }
                  />

                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      displayedSellAmount
                    }
                    onChange={(event) =>
                      handleSellAmountChange(
                        event.target.value
                      )
                    }
                    placeholder="0"
                    className="min-w-0 flex-1 bg-transparent px-2 text-right text-[24px] font-semibold outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* ==================================================
                  SWAP ARROW
              ================================================== */}

              <div className="relative z-10 -my-3 flex justify-center">
                <button
                  type="button"
                  onClick={
                    handleReverseSwap
                  }
                  disabled={
                    isReversing ||
                    (!sellToken &&
                      !buyToken)
                  }
                  aria-label="Reverse swap"
                  title="Reverse swap"
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-[#10101B] text-foreground transition hover:bg-[#181824] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeftRight
                    className={`h-4 w-4 transition-transform duration-180 ${
                      isReversing
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>
              </div>

              {/* ==================================================
                  BUY
              ================================================== */}

              <div className="rounded-[14px] bg-[#10101B] p-2">
                <div className="mb-1 flex items-center justify-between px-2 py-1.5">
                  <span className="text-[14px] font-medium">
                    Buy
                  </span>

                  <span className="text-[13px] text-muted-foreground">
                    {buyToken
                      ? `Balance: ${buyToken.symbol}`
                      : "Balance: --"}
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-[10px] bg-[#050511] p-2">
                  <SwapTokenSelector
                    label="Select token"
                    token={buyToken}
                    tokens={buyTokens}
                    loading={
                      buyTokensLoading
                    }
                    search={buySearch}
                    onSearchChange={
                      setBuySearch
                    }
                    onSelect={
                      handleBuyTokenSelect
                    }
                    networks={
                      buyNetwork
                        ? [buyNetwork]
                        : []
                    }
                    selectedNetwork={
                      buyNetwork
                    }
                    networkDisabled
                    disabled={
                      !sellNetwork ||
                      !sellToken
                    }
                  />

                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      displayedBuyAmount
                    }
                    onChange={(event) =>
                      handleBuyAmountChange(
                        event.target.value
                      )
                    }
                    placeholder="0"
                    className="min-w-0 flex-1 bg-transparent px-2 text-right text-[24px] font-semibold outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* ==================================================
                  PRICE LOADING
              ================================================== */}

              {priceLoading &&
              readyForPrice ? (
                <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Getting best rate...
                </div>
              ) : null}

              {/* ==================================================
                  PRICE ERROR
              ================================================== */}

              {priceError ? (
                <div className="mt-4 rounded-[9px] border border-destructive/30 bg-destructive/10 px-3 py-3 text-[13px] text-destructive">
                  {priceError}
                </div>
              ) : null}

              {/* ==================================================
                  RATE
              ================================================== */}

              {price &&
              !priceLoading &&
              !priceError ? (
                <div className="mt-4 rounded-[10px] border border-border bg-[#070812] p-3.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      Rate
                    </span>

                    <span className="font-medium">
                      1{" "}
                      {sellToken?.symbol}{" "}
                      ≈{" "}
                      {rate}{" "}
                      {buyToken?.symbol}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      Biyaport fee
                    </span>

                    <span className="font-medium">
                      0.25%
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      Slippage tolerance
                    </span>

                    <span className="font-medium">
                      {slippageTolerance}%
                    </span>
                  </div>

                  {price.issues?.balance ? (
                    <div className="mt-3 text-[12px] text-destructive">
                      Insufficient{" "}
                      {sellToken?.symbol}{" "}
                      balance for this amount.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* ==================================================
                  SWAP ERROR
              ================================================== */}

              {swapError ? (
                <div className="mt-4 rounded-[9px] border border-destructive/30 bg-destructive/10 px-3 py-3 text-[13px] text-destructive">
                  {swapError}
                </div>
              ) : null}

              {/* ==================================================
                  WALLET
              ================================================== */}

              {!authenticated ||
              !wallet?.address ? (
                <div className="mt-5 rounded-[10px] border border-border bg-[#070812] p-3 text-center text-[13px] text-muted-foreground">
                  Connect your wallet to swap.
                </div>
              ) : null}

              {/* ==================================================
                  SWAP BUTTON
              ================================================== */}

              <button
                type="button"
                disabled={
                  !canSwap ||
                  swapLoading
                }
                onClick={
                  executeSwap
                }
                className="mt-5 flex h-[54px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {swapLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />

                    {sellToken?.isNative
                      ? "Confirm swap"
                      : "Preparing swap"}
                  </>
                ) : !sellNetwork ||
                  !sellToken ||
                  !buyToken ? (
                  "Select tokens to swap"
                ) : !hasAmount ? (
                  "Enter an amount"
                ) : !price ? (
                  "Get swap rate"
                ) : !authenticated ||
                  !wallet?.address ? (
                  "Connect wallet"
                ) : (
                  "Swap"
                )}
              </button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/********************************************************************************
 * SHARED NETWORK SELECTOR
 *
 * IMPORTANT:
 * Used by Quick Port and B-Codes.
 ********************************************************************************/

function NetworkSelector({
  value,
  onChange,
}: {
  value: NetworkKey;
  onChange: (network: NetworkKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = getNetworkConfig(value);

  useEffect(() => {
    const handleClick = (
      event: MouseEvent
    ) => {
      const target =
        event.target as Node;

      if (
        ref.current &&
        !ref.current.contains(target)
      ) {
        setOpen(false);
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

  return (
    <div
      ref={ref}
      className="relative shrink-0"
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (currentOpen) =>
              !currentOpen
          )
        }
        className="flex h-11 items-center gap-2 rounded-[8px] border border-border bg-[#050511] px-3 text-[14px] font-medium"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Image
          src={current.logo}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 object-contain"
        />

        <span className="hidden sm:inline">
          {current.shortName}
        </span>

        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+8px)] z-[60] w-[220px] overflow-hidden rounded-[10px] border border-border bg-[#070812] p-1.5 shadow-2xl"
        >
          {NETWORKS.map(
            (
              network: NetworkConfig
            ) => (
              <button
                key={network.key}
                type="button"
                role="option"
                aria-selected={
                  value ===
                  network.key
                }
                onClick={() => {
                  onChange(
                    network.key
                  );
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-left transition hover:bg-secondary"
              >
                <span className="flex items-center gap-2.5">
                  <Image
                    src={network.logo}
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5 object-contain"
                  />

                  <span className="text-[13px]">
                    {network.name}
                  </span>
                </span>

                {value ===
                  network.key && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/*
 * ====================================================
 * SHARED NAVIGATION
 * ====================================================
 */

function SiteNav({
  activeTab = "quick-port",
  onQuickPort,
  onBCodes,
  onSwap,
}: {
  activeTab?: "quick-port" | "b-codes" | "swap" | "history";
  onQuickPort?: () => void;
  onBCodes?: () => void;
  onSwap?: () => void;
}) {
  const [activeMobileTab, setActiveMobileTab] = useState<
    "quick-port" | "b-codes" | "swap" | "history"
  >(activeTab);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-[100] px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between rounded-[16px] border border-[#0F0F1B] bg-[#050511]/95 p-3 shadow-2xl backdrop-blur-md">
          <div className="flex min-w-0 items-center">
            <Image
              src="/biyaport_logo.svg"
              alt="Biyaport"
              width={160}
              height={44}
              className="h-[36px] w-auto object-contain sm:h-[44px]"
              priority
            />
          </div>

          {/* Desktop navigation: centered as one grouped container */}
          <nav
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-[11px] md:flex"
            aria-label="Main navigation"
          >
            <button
              type="button"
              onClick={() => {
                setActiveMobileTab("quick-port");
                onQuickPort?.();
              }}
              className="rounded-[8px] px-3 py-2 text-[14px] font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              Quick Port
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMobileTab("b-codes");
                onBCodes?.();
              }}
              className="rounded-[8px] px-3 py-2 text-[14px] font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              B-Codes
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMobileTab("swap");
                onSwap?.();
              }}
              className="rounded-[8px] px-3 py-2 text-[14px] font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              Swap
            </button>

            <button
              type="button"
              disabled
              className="cursor-default rounded-[8px] px-3 py-2 text-[14px] font-semibold text-muted-foreground"
            >
              History
            </button>
          </nav>

          <ConnectWalletButton />
        </div>
      </header>

      <nav
        className="fixed bottom-0 left-0 right-0 z-[110] px-5 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-[420px] items-center justify-between gap-1 rounded-[15px] border border-[#0F0F1B] bg-[#050511] p-2">

          {/* Quick Port */}
          <button
            type="button"
            onClick={() => {
              setActiveMobileTab("quick-port");
              onQuickPort?.();
            }}
            className={`flex h-13 items-center justify-center rounded-[15px] transition-all duration-300 ease-out ${
              activeMobileTab === "quick-port"
                ? "bg-[#0B50EA] px-6 text-white"
                : "w-11 px-0 text-muted-foreground active:scale-95"
            }`}
          >
            <HomeIcon className="h-5 w-5 shrink-0" strokeWidth={2} />

            <span
              className={`overflow-hidden whitespace-nowrap text-[14px] font-medium transition-all duration-300 ${
                activeMobileTab === "quick-port"
                  ? "ml-2 max-w-[100px] opacity-100"
                  : "ml-0 max-w-0 opacity-0"
              }`}
            >
              Quick Port
            </span>
          </button>

          {/* B-Codes */}
<button
  type="button"
  onClick={() => {
    setActiveMobileTab("b-codes");
    onBCodes?.();
  }}
  className={`flex h-13 items-center justify-center rounded-[15px] transition-all duration-300 ease-out ${
    activeMobileTab === "b-codes"
      ? "bg-[#0B50EA] px-6 text-white"
      : "w-11 px-0 text-muted-foreground active:scale-95"
  }`}
>
  <Coins className="h-5 w-5 shrink-0" strokeWidth={2} />

  <span
    className={`overflow-hidden whitespace-nowrap text-[14px] font-medium transition-all duration-300 ${
      activeMobileTab === "b-codes"
        ? "ml-2 max-w-[100px] opacity-100"
        : "ml-0 max-w-0 opacity-0"
    }`}
  >
    B-Codes
  </span>
</button>

          {/* Swap */}
          <button
            type="button"
            onClick={() => {
              setActiveMobileTab("swap");
              onSwap?.();
            }}
            className={`flex h-13 items-center justify-center rounded-[15px] transition-all duration-300 ease-out ${
              activeMobileTab === "swap"
                ? "bg-[#0B50EA] px-6 text-white"
                : "w-11 px-0 text-muted-foreground active:scale-95"
            }`}
          >
            <ArrowLeftRight className="h-5 w-5 shrink-0" strokeWidth={2} />

            <span
              className={`overflow-hidden whitespace-nowrap text-[14px] font-medium transition-all duration-300 ${
                activeMobileTab === "swap"
                  ? "ml-2 max-w-[100px] opacity-100"
                  : "ml-0 max-w-0 opacity-0"
              }`}
            >
              Swap
            </span>
          </button>

          {/* History */}
          <button
            type="button"
            onClick={() => {
              setActiveMobileTab("history");
              // Empty modal for now.
            }}
            className={`flex h-13 items-center justify-center rounded-[15px] transition-all duration-300 ease-out ${
              activeMobileTab === "history"
                ? "bg-[#0B50EA] px-6 text-white"
                : "w-11 px-0 text-muted-foreground active:scale-95"
            }`}
          >
            <Menu className="h-5 w-5 shrink-0" strokeWidth={2} />

            <span
              className={`overflow-hidden whitespace-nowrap text-[14px] font-medium transition-all duration-300 ${
                activeMobileTab === "history"
                  ? "ml-2 max-w-[100px] opacity-100"
                  : "ml-0 max-w-0 opacity-0"
              }`}
            >
              History
            </span>
          </button>

        </div>
      </nav>
    </>
  );
}


/*
 * ====================================================
 * PAYMENT SHELL
 * ====================================================
 */

function PaymentShell({
  children,
  onQuickPort,
  onBCodes,
  onSwap,
}: {
  children: React.ReactNode;
  onQuickPort?: () => void;
  onBCodes?: () => void;
  onSwap?: () => void;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050511]">

      <Background />

      <div className="relative z-10 min-h-screen">

        <SiteNav
          onQuickPort={onQuickPort}
          onBCodes={onBCodes}
          onSwap={onSwap}
        />

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