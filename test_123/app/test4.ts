import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import fs from "fs/promises";
import * as borsh from "borsh";

const programId = "9DCP3wdVuR2vSzsJC15zdMNsDPfd5eEs5kTnTv8GqNJT";
const connection = new Connection("http://127.0.0.1:8899");

const TransactionRecordSchema = {
	struct: {
		account_owner: { array: { type: "u8", len: 32 } },
		transaction_id: "u64",
	},
};

const VecTransactionRecordSchema = {
	array: {
		type: TransactionRecordSchema,
	},
};

function deserializeTransactionsData(raw: string) {
	const buffer = Buffer.from(raw, "base64");

	return borsh.deserialize(VecTransactionRecordSchema, buffer);
}

function deserializeTransactionData(raw: string) {
	const buffer = Buffer.from(raw, "base64");
	return borsh.deserialize(TransactionRecordSchema, buffer);
}

export const getWallet = async (keyPairFile: string) => {
	const payer = anchor.web3.Keypair.fromSecretKey(
		Buffer.from(
			JSON.parse(
				await fs.readFile(keyPairFile, {
					encoding: "utf-8",
				})
			)
		)
	);
	return new anchor.Wallet(payer);
};

async function waitForConfirmation(connection: Connection, txSign: string) {
	let result: any = null;
	while (result === null) {
		result = await connection.getConfirmedTransaction(txSign);
		if (result === null) {
			console.log("Waiting for confirmation...");
			await new Promise((resolve) => setTimeout(resolve, 3000));
		}
	}
	return result;
}

async function waitCall(res: string) {
	console.log("Smart contract has been called!");
	console.log(res);

	const confirmedTransaction = await waitForConfirmation(connection, res);

	console.log(confirmedTransaction.meta.logMessages);
	if (confirmedTransaction.meta.returnData) {
		console.log(
			"result: ",
			JSON.stringify(confirmedTransaction.meta.returnData)
		);
		for (const data of confirmedTransaction.meta.returnData.data) {
			console.log(Buffer.from(data, "base64").toString());
			try {
				const transactions = deserializeTransactionsData(data);
				console.log("Deserialized transactions:", transactions);
				analyzeOutput(transactions as any);
			} catch (e) {
				console.error("Failed to deserialize data:", e);
			}
			break;
		}
	}
}

function analyzeOutput(txs: { transaction_id: anchor.BN }[]): void {
	let disorderMeasure = 0;

	for (let i = 0; i < txs.length; i++) {
		disorderMeasure += Math.abs(Number(txs[i].transaction_id) - i);
	}

	console.log("Disorder Indicator (Module Distance):", disorderMeasure);
}

async function main() {
	const wallet = await getWallet("../../.config/solana/id.json");
	// Configure the client to use the local cluster.
	const provider = new anchor.AnchorProvider(connection, wallet, {
		commitment: "confirmed",
	});

	// const idl = await anchor.Program.fetchIdl(programId, provider);
	const idl = JSON.parse(
		await fs.readFile("../target/idl/tx_order.json", "utf8")
	);
	console.log("IDL, ", idl);
	const program = new anchor.Program(idl!, provider) as anchor.Program;
	// console.log("Program, ", program);

	const transactionLogKeypair = anchor.web3.Keypair.generate();
	console.log(
		"Transaction log public key: ",
		transactionLogKeypair.publicKey.toBase58()
	);
	const confirmOptions = {
		skipPreflight: true,
		commitment: "processed" as any,
		preflightCommitment: "processed" as any,
	};

	const transactions: any[] = [];
	for (let i = 0; i < 10; i++) {
		const transactionId = new anchor.BN(i);

		const latestBlockhash = await provider.connection.getLatestBlockhash();
		const tx = await program.methods
			.recordTransaction(transactionId)
			.accounts({
				transactionLog: transactionLogKeypair.publicKey,
				user: wallet.publicKey,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.signers([wallet.payer, transactionLogKeypair])
			.transaction();

		tx.feePayer = wallet.publicKey;
		// tx.recentBlockhash = latestBlockhash.blockhash;
		transactions.push(tx);
	}

	const sentTx = transactions.map((tx) =>
		provider.sendAndConfirm(
			tx,
			[wallet.payer, transactionLogKeypair],
			confirmOptions
		)
	);
	const results = await Promise.all(sentTx);
	console.log("All transactions have been processed:", results);

	console.log("Waiting for 1 seconds...");
	await new Promise((resolve) => setTimeout(resolve, 1000));
	const res2 = await program.methods["getTransactions"]()
		.accounts({
			transactionLog: transactionLogKeypair.publicKey,
		})
		.signers([wallet.payer])
		.rpc();

	await waitCall(res2);
}

main().catch((err) => {
	console.error(err);
});
