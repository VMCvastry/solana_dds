import * as anchor from "@coral-xyz/anchor";
import {
	PublicKey,
	Connection,
	clusterApiUrl,
	ComputeBudgetProgram,
	TransactionInstruction,
} from "@solana/web3.js";

import fs from "fs/promises";
import { connection, getWallet } from "./test4/connection";
import { deserializeTransactionsData } from "./test4/logUtils";
import { analyzeOutput } from "./test4/analysisUtils";

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
			// console.log(Buffer.from(data, "base64").toString());
			try {
				const transactions = deserializeTransactionsData(data);
				// console.log("Deserialized transactions:", transactions);
				return transactions;
			} catch (e) {
				console.error("Failed to deserialize data:", e);
			}
			break;
		}
	}
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
	const tot_txs = 200;
	for (let i = 0; i < tot_txs; i++) {
		const transactionId = new anchor.BN(i);

		// const { blockhash } = await provider.connection.getLatestBlockhash(
		// 	"finalized"
		// );
		const tx = new anchor.web3.Transaction();

		// const computeLimit = ComputeBudgetProgram.setComputeUnitLimit({
		// 	units: 1000000,
		// });

		const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
			microLamports: 100 * (tot_txs - i),
		});
		// tx.add(computeLimit);
		tx.add(priorityFee);

		const userTransaction = await program.methods
			.recordTransaction(transactionId)
			.accounts({
				transactionLog: transactionLogKeypair.publicKey,
				user: wallet.publicKey,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.signers([wallet.payer, transactionLogKeypair])
			.transaction();

		// userTransaction.recentBlockhash = blockhash;
		userTransaction.feePayer = wallet.publicKey;
		tx.add(userTransaction);
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
	// const res2 = await program.methods["getTransactions"]()
	// 	.accounts({
	// 		transactionLog: transactionLogKeypair.publicKey,
	// 	})
	// 	.signers([wallet.payer])
	// 	.rpc();

	// analyzeOutput((await waitCall(res2)) as any[]);

	let txs: any[] = []; // Initialize txs as an empty array with type 'any[]'
	let promises: any[] = [];
	const rounds = Math.floor(tot_txs / 25);
	for (let i = 0; i < rounds; i++) {
		const res2 = await program.methods["getPagedTransactions"](
			new anchor.BN(i)
		)
			.accounts({
				transactionLog: transactionLogKeypair.publicKey,
			})
			.signers([wallet.payer])
			.rpc();
		promises.push(res2);
	}

	for (const promise of promises) {
		analyzeOutput((await waitCall(promise)) as any[]);
		txs.push(...((await waitCall(promise)) as any[]));
	}

	analyzeOutput(txs);
}

main().catch((err) => {
	console.error(err);
});
