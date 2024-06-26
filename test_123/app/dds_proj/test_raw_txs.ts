import * as anchor from "@coral-xyz/anchor";
import {
	PublicKey,
	Connection,
	clusterApiUrl,
	ComputeBudgetProgram,
	LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import fs from "fs/promises";
import * as borsh from "borsh";
import { getWallet } from "../test4/connection";

const programId = "8BTxUsmr5vpof3bnJJHH9isvaQKrkds7qFNNQJutnBME";
const connection = new Connection("http://127.0.0.1:8899");

const UserDataSchema = {
	struct: {
		data: "u64",
	},
};

function deserializeTransactionData(raw: string) {
	const buffer = Buffer.from(raw, "base64");

	return borsh.deserialize(UserDataSchema, buffer);
}

async function waitForConfirmation(
	connection: Connection,
	txSign: string,
	commitment: "confirmed" | "finalized" = "confirmed"
) {
	let result: any = null;
	while (result === null) {
		result = await connection.getTransaction(txSign, {
			commitment: commitment,
			maxSupportedTransactionVersion: undefined,
		});
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
		for (const data of confirmedTransaction.meta.returnData.data) {
			try {
				const d = deserializeTransactionData(data) as any;
				const value = Number(d.data);
				console.log("Deserialized value:", value);
				return value;
			} catch (e) {
				console.error("Failed to deserialize data:", e);
			}
			break;
		}
	}
}
type Commitment =
	| "none" // custom level
	| "processed"
	| "confirmed"
	| "finalized"
	| "recent"
	| "single"
	| "singleGossip"
	| "root"
	| "max";

class NonConflicts {
	program: anchor.Program;
	wallet: anchor.Wallet;
	provider: anchor.AnchorProvider;

	constructor() {
		this.program = {} as anchor.Program;
		this.wallet = {} as anchor.Wallet;
		this.provider = {} as anchor.AnchorProvider;
	}

	async init() {
		this.wallet = await getWallet("../../.config/solana/id.json");
		this.provider = new anchor.AnchorProvider(connection, this.wallet, {
			commitment: "confirmed",
		});

		const idl = JSON.parse(
			await fs.readFile("../target/idl/non_conflicts.json", "utf8")
		);
		// console.log("IDL, ", idl);
		this.program = new anchor.Program(
			idl!,
			this.provider
		) as anchor.Program;
	}

	async callSend(
		senderWallet: anchor.web3.Keypair,
		recipientPublicKey: anchor.web3.PublicKey,
		commitment: Commitment,
		value?: number
	) {
		value = value || 0.01 + Math.random();

		// if (commitment === "none") {
		// 	return connection.sendTransaction(
		// 		await txPayload.transaction(),
		// 		[user, this.wallet.payer],
		// 		{ skipPreflight: true }
		// 	);
		// }

		const connection = this.provider.connection;
		const transaction = new anchor.web3.Transaction().add(
			anchor.web3.SystemProgram.transfer({
				fromPubkey: senderWallet.publicKey,
				toPubkey: recipientPublicKey,
				lamports: Math.floor(value * LAMPORTS_PER_SOL),
			})
		);

		return anchor.web3.sendAndConfirmTransaction(
			connection,
			transaction,
			[senderWallet],
			{
				commitment: commitment as any,
			}
		);
	}

	// async callRead(user: anchor.web3.Keypair, commitment: Commitment) {
	// 	if (commitment === "none") {
	// 		throw new Error("Not implemented");
	// 	}
	// 	return this.program.methods["getUserData"]()
	// 		.accounts({
	// 			user_data: anchor.web3.PublicKey.findProgramAddressSync(
	// 				[user.publicKey.toBuffer()],
	// 				this.program.programId
	// 			)[0],
	// 			user: user.publicKey,
	// 		})
	// 		.signers([user])
	// 		.rpc({
	// 			commitment: commitment,
	// 			skipPreflight: true,
	// 		});
	// }
	async benchRaw(users: anchor.web3.Keypair[], commitment: Commitment) {
		let s_time = Date.now();

		let fTxs: Promise<string>[] = [];
		for (let user of users) {
			fTxs.push(this.callSend(user, users[0].publicKey, "finalized", 1));
		}
		await Promise.all(fTxs);
		console.log("transactions sent in", Date.now() - s_time, "ms");
		await new Promise((resolve) => setTimeout(resolve, 25 * 1000));

		s_time = Date.now();

		fTxs = [];
		for (let user of users) {
			fTxs.push(this.callSend(user, users[0].publicKey, "confirmed", 1));
		}
		await Promise.all(fTxs);
		console.log("transactions sent in", Date.now() - s_time, "ms");
		await new Promise((resolve) => setTimeout(resolve, 25 * 1000));

		s_time = Date.now();
		fTxs = [];
		for (let user of users) {
			fTxs.push(this.callSend(user, users[0].publicKey, "processed", 1));
		}
		await Promise.all(fTxs);
		console.log("transactions sent in", Date.now() - s_time, "ms");
	}

	// async banchWrites(users: anchor.web3.Keypair[], commitment: Commitment) {
	// 	console.log("Writing data to users");
	// 	const s_time = Date.now();
	// 	let writes: Promise<string>[] = [];
	// 	for (const user of users) {
	// 		writes.push(this.callWrite(user, commitment, false));
	// 	}
	// 	console.log("All data written in ", Date.now() - s_time, "ms");
	// 	await Promise.all(writes);
	// 	console.log("waited in ", Date.now() - s_time, "ms");
	// }

	// async banchWriteWithAllConflicts(
	// 	users: anchor.web3.Keypair[],
	// 	commitment: Commitment
	// ) {
	// 	console.log("Writing data to users max conflicts");
	// 	// still not particularly worse performance
	// 	let benchUsers: anchor.web3.Keypair[] = [];
	// 	for (let i = 0; i < users.length; i++) {
	// 		benchUsers.push(users[0]);
	// 	}
	// 	const s_time = Date.now();
	// 	let txs: Promise<string>[] = [];
	// 	for (const user of benchUsers) {
	// 		txs.push(this.callWrite(user, commitment, false));
	// 	}
	// 	console.log("All data in ", Date.now() - s_time, "ms");
	// 	await Promise.all(txs);
	// 	console.log("waited in ", Date.now() - s_time, "ms");
	// }

	// async banchSelectiveWait2(
	// 	users: anchor.web3.Keypair[],
	// 	commitment: Commitment
	// ) {
	// 	console.log("Selective2");
	// 	// still not particularly worse performance
	// 	let benchUsers: anchor.web3.Keypair[] = [];
	// 	for (let i = 0; i < users.length; i++) {
	// 		if (i % 2 == 0) {
	// 			benchUsers.push(users[0]);
	// 		} else {
	// 			benchUsers.push(users[i]);
	// 		}
	// 	}
	// 	const s_time = Date.now();
	// 	let txs: Promise<string>[] = [];
	// 	for (const user of benchUsers) {
	// 		txs.push(this.callWrite(user, commitment, false));
	// 		// await new Promise((resolve) => setTimeout(resolve, 1)); // with this the free avg seems a bit lower
	// 		// txs.push(this.callRead(user, commitment));
	// 	}

	// 	const times: number[] = Array.from({ length: txs.length });
	// 	console.log("All data in ", Date.now() - s_time, "ms");
	// 	// freeTxt.then((res) => {
	// 	// 	console.log("Free tx finished in ", Date.now() - s_time, "ms");
	// 	// });
	// 	// queuedTxt.then((res) => {
	// 	// 	console.log("Queued tx finished in ", Date.now() - s_time, "ms");
	// 	// });

	// 	for (let i = 0; i < txs.length; i++) {
	// 		const tx = txs[i];
	// 		tx.then((res) => {
	// 			times[i] = Date.now() - s_time;
	// 		});
	// 	}

	// 	await Promise.all(txs);
	// 	console.log("waited in ", Date.now() - s_time, "ms");

	// 	console.log(times);
	// 	const avg = times.reduce((a, b) => a + b, 0) / times.length;
	// 	console.log("Average time: ", avg);

	// 	const conflict_avg =
	// 		times.filter((_, i) => i % 2 == 0).reduce((a, b) => a + b, 0) /
	// 		(times.length / 2);
	// 	console.log("conflict Average time: ", conflict_avg);
	// 	const free_avg =
	// 		times.filter((_, i) => i % 2 != 0).reduce((a, b) => a + b, 0) /
	// 		(times.length / 2);
	// 	console.log("free Average time: ", free_avg);
	// }

	async runBenchmarks(commitment: Commitment) {
		await this.init();
		let s_time = Date.now();
		let users: anchor.web3.Keypair[] = [];
		let fTxs: Promise<string>[] = [];
		for (let i = 0; i < 1000; i++) {
			const user = anchor.web3.Keypair.generate();
			users.push(user);
		}
		// await new Promise((resolve) => setTimeout(resolve, 10 * 1000));

		console.log("Users generated in ", Date.now() - s_time, "ms");

		for (const user of users) {
			fTxs.push(
				this.callSend(
					this.wallet.payer,
					user.publicKey,
					"finalized",
					10
				)
			);
		}
		await Promise.all(fTxs);
		console.log("user funded in", Date.now() - s_time, "ms");

		await this.benchRaw(users, commitment);

		// fTxs = [];
		// for (let i = 0; i < 998; i = i + 2) {
		// 	fTxs.push(
		// 		this.callSend(users[i], users[i + 1].publicKey, "processed", 1)
		// 	);
		// }
		// await Promise.all(fTxs);
		// console.log(
		// 	"transactions sent in",
		// 	Date.now() - s_time,
		// 	"ms",
		// 	(Date.now() - s_time) * 2
		// );

		// s_time = Date.now();

		// fTxs = [];
		// for (let i = 0; i < 998; i = i + 2) {
		// 	fTxs.push(
		// 		this.callSend(
		// 			this.wallet.payer,
		// 			users[0].publicKey,
		// 			"processed"
		// 		)
		// 	);
		// }
		// await Promise.all(fTxs);
		// console.log("transactions sent in", Date.now() - s_time, "ms");

		// await this.banchWrites(users, commitment);
		// await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
		// await this.banchReads(users, commitment);
		// await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
		// await this.banchMixed(users, commitment);
		// await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
		// await this.banchMixedWithRandomConflicts(users, commitment);
		// await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
		// await this.banchMixedWithSeqConflicts(users, commitment);

		// await this.banchSelectiveWait2(users, commitment);
		// await this.banchWriteWithAllConflicts(users, commitment);
		// await this.banchWrites(users, commitment);
	}
}
new NonConflicts().runBenchmarks("processed").catch((err) => {
	console.error(err);
});
