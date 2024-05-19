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
			} catch (e) {
				console.error("Failed to deserialize data:", e);
			}
			break;
		}
	}
}

async function main() {
	// const transaction = deserializeTransactionData(
	// 	"mnCc6ZcibCLQKszQPN+mQwuAYhGennpHPJDHLjC1t2EBAAAAAAAAAA=="
	// );
	// console.log("Deserialized transactions:", transaction);
	// const transactions = deserializeTransactionsData(
	// 	"AQAAAJpwnOmXImwi0CrM0DzfpkMLgGIRnp56RzyQxy4wtbdhAQAAAAAAAAA="
	// );
	// console.log("Deserialized transactions:", transactions);

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
	for (let i = 0; i < 10; i++) {
		const transactionId = new anchor.BN(i);

		const res = program.methods["recordTransaction"](transactionId)
			.accounts({
				transactionLog: transactionLogKeypair.publicKey,
				user: wallet.publicKey,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.signers([wallet.payer, transactionLogKeypair])
			.rpc();
	}

	console.log("Waiting for 10 seconds...");
	await new Promise((resolve) => setTimeout(resolve, 10000));
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
