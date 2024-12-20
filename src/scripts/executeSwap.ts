import { http, type Address, createWalletClient, maxUint256, parseEther, publicActions, zeroAddress } from "viem"; // Main library used to interface with the blockchain
import { berachainTestnetbArtio } from "viem/chains";
import appConfig from "../config/config";
import { PROTOCOL_SIGNER } from "../provider/client";

// Ensure no sensitive information is hardcoded
const PRIVATE_KEY = appConfig.protocolSigner as Address;
const PUBLIC_API_URL = "https://bartio.api.oogabooga.io";
const API_KEY = appConfig.apiKey;

const account = PROTOCOL_SIGNER;
console.log("Caller:", account.address);

const client = createWalletClient({
	chain: berachainTestnetbArtio,
	transport: http(),
	account,
}).extend(publicActions);

// Bartio token addresses
const NATIVE_TOKEN: Address = zeroAddress; // Default address for Bera native token
const HONEY: Address = "0x2577d24a26f8fa19c1058a8b0106e2c7303454a4"; //
// const HONEY: Address = "0x7507c1dc16935B82698e4C63f2746A2fCf994dF8"; //

const swapParams = {
	tokenIn: NATIVE_TOKEN, // Address of the token swapping from (BERA)
	tokenOut: HONEY, // Address of the token swapping to (HONEY)
	amount: parseEther("0.05"), // Amount of tokenIn to swap
	to: "0x95f4c475857C9ca1e87755f0ebC135Baca86EBF3", // Address to send tokenOut to (optional and defaults to `from`)
	slippage: 0.01, // Range from 0 to 1 to allow for price slippage
};
type SwapParams = typeof swapParams;

const headers = {
	Authorization: `Bearer ${API_KEY}`,
};

const getAllowance = async (token: Address, from: Address) => {
	// Native token does not require approvals for allowance
	if (token === NATIVE_TOKEN) return maxUint256;

	const publicApiUrl = new URL(`${PUBLIC_API_URL}/v1/approve/allowance`);
	publicApiUrl.searchParams.set("token", token);
	publicApiUrl.searchParams.set("from", from);

	const res = await fetch(publicApiUrl, {
		headers,
	});
	const json = await res.json();
	return json.allowance;
};

const approveAllowance = async (token: Address, amount: bigint) => {
	const publicApiUrl = new URL(`${PUBLIC_API_URL}/v1/approve`);
	publicApiUrl.searchParams.set("token", token);
	publicApiUrl.searchParams.set("amount", amount.toString());

	const res = await fetch(publicApiUrl, { headers });
	const { tx } = await res.json();

	console.log("Submitting approve...");
	// @ts-ignore
	const hash = await client.sendTransaction({
		account: tx.from as Address,
		to: tx.to as Address,
		data: tx.data as `0x${string}`,
		chain: berachainTestnetbArtio,
	});

	const rcpt = await client.waitForTransactionReceipt({
		hash,
	});
	console.log("Approval complete", rcpt.transactionHash, rcpt.status);
};

const swap = async (swapParams: SwapParams) => {
	const publicApiUrl = new URL(`${PUBLIC_API_URL}/v1/swap`);
	publicApiUrl.searchParams.set("tokenIn", swapParams.tokenIn);
	publicApiUrl.searchParams.set("amount", swapParams.amount.toString());
	publicApiUrl.searchParams.set("tokenOut", swapParams.tokenOut);
	publicApiUrl.searchParams.set("to", swapParams.to);
	publicApiUrl.searchParams.set("slippage", swapParams.slippage.toString());

	const res = await fetch(publicApiUrl, { headers });
	const { tx } = await res.json();

	console.log("Submitting swap...");
	// @ts-ignore
	const hash = await client.sendTransaction({
		account: tx.from as Address,
		to: tx.to as Address,
		data: tx.data as `0x${string}`,
		value: tx.value ? BigInt(tx.value) : 0n,
	});
	console.log("hash", hash);

	const rcpt = await client.waitForTransactionReceipt({
		hash,
	});
	console.log("Swap complete", rcpt);
};

async function main() {
	// Check allowance
	const allowance = await getAllowance(swapParams.tokenIn, account.address);
	console.log("Allowance", allowance);

	// Approve if necessary
	if (allowance < swapParams.amount) {
		await approveAllowance(
			swapParams.tokenIn,
			swapParams.amount - allowance, // Only approve amount remaining
		);
	}
	// Swap
	await swap(swapParams);
}

main();
