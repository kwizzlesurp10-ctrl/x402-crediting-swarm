import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { createWalletClient, custom, type Address, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";

type EIP1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EIP1193 {
  const eth = (globalThis as { ethereum?: EIP1193 }).ethereum;
  if (!eth) {
    throw new Error(
      "No injected wallet found. Install MetaMask (or another EIP-1193 wallet) or pay from an agent with @x402/fetch.",
    );
  }
  return eth;
}

function chainForNetwork(network: string) {
  if (network === "eip155:8453") return base;
  return baseSepolia;
}

async function ensureChain(eth: EIP1193, chainId: number) {
  const hexId = `0x${chainId.toString(16)}`;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code !== 4902) throw err;
    const chain = chainId === 8453 ? base : baseSepolia;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [...chain.rpcUrls.default.http],
          blockExplorerUrls: chain.blockExplorers
            ? [chain.blockExplorers.default.url]
            : [],
        },
      ],
    });
  }
}

export async function connectWallet(network: string): Promise<Address> {
  const eth = getEthereum();
  const chain = chainForNetwork(network);
  await ensureChain(eth, chain.id);
  const accounts = (await eth.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.[0]) throw new Error("Wallet did not return an account.");
  return accounts[0] as Address;
}

export async function paidFetch(
  network: string,
  address: Address,
): Promise<typeof fetch> {
  const eth = getEthereum();
  const chain = chainForNetwork(network);
  await ensureChain(eth, chain.id);

  const walletClient = createWalletClient({
    account: address,
    chain,
    transport: custom(eth),
  });

  const signer = {
    address,
    signTypedData: async (message: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<Hex> =>
      walletClient.signTypedData({
        account: address,
        domain: message.domain,
        types: message.types,
        primaryType: message.primaryType,
        message: message.message,
      } as Parameters<typeof walletClient.signTypedData>[0]),
  };

  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: "eip155:*",
        client: new ExactEvmScheme(signer),
      },
    ],
  });
}
