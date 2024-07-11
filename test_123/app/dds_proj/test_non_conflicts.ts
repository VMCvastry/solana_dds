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
async function transferSol(
	provider: anchor.AnchorProvider,
	senderWallet: anchor.Wallet,
	recipientPublicKey: anchor.web3.PublicKey,
	amount: number
) {
	const connection = provider.connection;
	const transaction = new anchor.web3.Transaction().add(
		anchor.web3.SystemProgram.transfer({
			fromPubkey: senderWallet.publicKey,
			toPubkey: recipientPublicKey,
			lamports: amount * LAMPORTS_PER_SOL,
		})
	);

	const signature = anchor.web3.sendAndConfirmTransaction(
		connection,
		transaction,
		[senderWallet.payer],
		{
			commitment: "finalized",
		}
	);
	return signature;
}
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

	async callWrite(
		user: anchor.web3.Keypair,
		commitment: Commitment,
		slow = false,
		value?: number
	) {
		value = value || Math.floor(Math.random() * 1000000);
		const program = slow ? "upsertUserDataSlow" : "upsertUserData";
		const txPayload = this.program.methods[program](new anchor.BN(value))
			.accounts({
				user_data: anchor.web3.PublicKey.findProgramAddressSync(
					[user.publicKey.toBuffer()],
					this.program.programId
				)[0],
				user: user.publicKey,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.signers([user]);
		if (slow) {
			txPayload.preInstructions([
				ComputeBudgetProgram.setComputeUnitLimit({
					units: 1400000,
				}),
			]);
		}

		if (commitment === "none") {
			return connection.sendTransaction(
				await txPayload.transaction(),
				[user, this.wallet.payer],
				{ skipPreflight: true }
			);
		}
		return txPayload.rpc({
			skipPreflight: true,
			/** desired commitment level */
			commitment: commitment,
			/** preflight commitment level */
			// preflightCommitment: "recent",
		});
	}

	async callRead(user: anchor.web3.Keypair, commitment: Commitment) {
		if (commitment === "none") {
			throw new Error("Not implemented");
		}
		return this.program.methods["getUserData"]()
			.accounts({
				user_data: anchor.web3.PublicKey.findProgramAddressSync(
					[user.publicKey.toBuffer()],
					this.program.programId
				)[0],
				user: user.publicKey,
			})
			.signers([user])
			.rpc({
				commitment: commitment,
				skipPreflight: true,
			});
	}

	async banchWrites(users: anchor.web3.Keypair[], commitment: Commitment) {
		console.log("Writing data to users");
		const s_time = Date.now();
		let writes: Promise<string>[] = [];
		for (const user of users) {
			writes.push(this.callWrite(user, commitment, false));
		}
		console.log("All transactions sent in ", Date.now() - s_time, "ms");
		await Promise.all(writes);
		console.log("Committed in ", Date.now() - s_time, "ms");
	}

	async banchReads(users: anchor.web3.Keypair[], commitment: Commitment) {
		console.log("Reading data from users");
		const s_time = Date.now();
		let reads: Promise<string>[] = [];
		for (const user of users) {
			reads.push(this.callRead(user, commitment));
		}
		console.log("All transactions sent in ", Date.now() - s_time, "ms");
		await Promise.all(reads);
		console.log("Committed in ", Date.now() - s_time, "ms");
	}

	async benchMixed(users: anchor.web3.Keypair[], commitment: Commitment) {
		console.log("Writing or reading data from users");
		const s_time = Date.now();
		let txs: Promise<string>[] = [];
		for (const user of users) {
			if (Math.random() > 0.5) {
				txs.push(this.callWrite(user, commitment));
			} else {
				txs.push(this.callRead(user, commitment));
			}
		}
		console.log("All transactions sent in ", Date.now() - s_time, "ms");
		await Promise.all(txs);
		console.log("Committed in ", Date.now() - s_time, "ms");
	}

	async banchMixedWithRandomConflicts(
		users: anchor.web3.Keypair[],
		commitment: Commitment
	) {
		console.log("Writing and reading data from users random");
		// not very useful, low conflicts
		let benchUsers: anchor.web3.Keypair[] = [];
		for (let i = 0; i < users.length; i++) {
			benchUsers.push(users[Math.floor(Math.random() * users.length)]);
		}
		const s_time = Date.now();
		let txs: Promise<string>[] = [];
		for (const user of benchUsers) {
			if (Math.random() > 0.5 || 1) {
				txs.push(this.callWrite(user, commitment));
			} else {
				txs.push(this.callRead(user, commitment));
			}
		}
		console.log("All data in ", Date.now() - s_time, "ms");
		await Promise.all(txs);
		console.log("waited in ", Date.now() - s_time, "ms");
	}

	async banchMixedWithSeqConflicts(
		users: anchor.web3.Keypair[],
		commitment: Commitment
	) {
		const benchUsers = users.slice(0, Math.floor(users.length / 2)); // same number of transactions
		console.log("Writing and reading data from users sequential");
		const s_time = Date.now();
		let txs: Promise<string>[] = [];
		for (const user of benchUsers) {
			txs.push(this.callWrite(user, commitment));
		}
		console.log("All data written in ", Date.now() - s_time, "ms");
		console.log("Reading data from users");
		for (const user of benchUsers) {
			txs.push(this.callRead(user, commitment));
		}
		console.log("All data read in ", Date.now() - s_time, "ms");
		await Promise.all(txs);
		console.log("waited in ", Date.now() - s_time, "ms");
	}

	async banchWriteWithAllConflicts(
		users: anchor.web3.Keypair[],
		commitment: Commitment
	) {
		console.log("Writing data to users max conflicts");
		// still not particularly worse performance
		let benchUsers: anchor.web3.Keypair[] = [];
		for (let i = 0; i < users.length; i++) {
			benchUsers.push(users[0]);
		}
		const s_time = Date.now();
		let txs: Promise<string>[] = [];
		for (const user of benchUsers) {
			txs.push(this.callWrite(user, commitment, false));
		}
		console.log("All transactions sent in ", Date.now() - s_time, "ms");
		await Promise.all(txs);
		console.log("Committed in ", Date.now() - s_time, "ms");
	}

	async banchSelectiveWait(
		users: anchor.web3.Keypair[],
		commitment: Commitment
	) {
		console.log("Selective");
		// still not particularly worse performance
		let benchUsers: anchor.web3.Keypair[] = [];
		for (let i = 0; i < users.length - 1; i++) {
			benchUsers.push(users[0]);
		}
		benchUsers.push(users[1]);
		const s_time = Date.now();
		let txs: Promise<string>[] = [];
		for (const user of benchUsers) {
			txs.push(this.callWrite(user, commitment, true));
			// await new Promise((resolve) => setTimeout(resolve, 1));
			// txs.push(this.callRead(user, commitment));
		}
		const freeTxt = txs[txs.length - 1];
		const queuedTxt = txs[txs.length - 2];

		const times: number[] = Array.from({ length: txs.length });
		console.log("All data in ", Date.now() - s_time, "ms");
		// freeTxt.then((res) => {
		// 	console.log("Free tx finished in ", Date.now() - s_time, "ms");
		// });
		// queuedTxt.then((res) => {
		// 	console.log("Queued tx finished in ", Date.now() - s_time, "ms");
		// });

		for (let i = 0; i < txs.length; i++) {
			const tx = txs[i];
			tx.then((res) => {
				times[i] = Date.now() - s_time;
			});
		}

		await Promise.all(txs);
		console.log("waited in ", Date.now() - s_time, "ms");

		console.log(times);
		const avg = times.reduce((a, b) => a + b, 0) / times.length;
		console.log("Average time: ", avg);
	}

	async banchSelectiveWait2(
		users: anchor.web3.Keypair[],
		commitment: Commitment
	) {
		console.log("Selective2");
		// still not particularly worse performance
		let benchUsers: anchor.web3.Keypair[] = [];
		for (let i = 0; i < users.length; i++) {
			if (i % 2 == 0) {
				benchUsers.push(users[0]);
			} else {
				benchUsers.push(users[i]);
			}
		}
		const s_time = Date.now();
		let txs: Promise<string>[] = [];
		for (const user of benchUsers) {
			txs.push(this.callWrite(user, commitment, false));
			// await new Promise((resolve) => setTimeout(resolve, 1)); // with this the free avg seems a bit lower
			// txs.push(this.callRead(user, commitment));
		}

		const times: number[] = Array.from({ length: txs.length });
		console.log("All transactions sent in ", Date.now() - s_time, "ms");
		// freeTxt.then((res) => {
		// 	console.log("Free tx finished in ", Date.now() - s_time, "ms");
		// });
		// queuedTxt.then((res) => {
		// 	console.log("Queued tx finished in ", Date.now() - s_time, "ms");
		// });

		for (let i = 0; i < txs.length; i++) {
			const tx = txs[i];
			tx.then((res) => {
				times[i] = Date.now() - s_time;
			});
		}

		await Promise.all(txs);
		console.log("Committed in ", Date.now() - s_time, "ms");

		// console.log(times);
		const avg = times.reduce((a, b) => a + b, 0) / times.length;
		console.log("Average time: ", avg);

		const conflict_avg =
			times.filter((_, i) => i % 2 == 0).reduce((a, b) => a + b, 0) /
			(times.length / 2);
		console.log("conflict Average time: ", conflict_avg);
		const free_avg =
			times.filter((_, i) => i % 2 != 0).reduce((a, b) => a + b, 0) /
			(times.length / 2);
		console.log("free Average time: ", free_avg);
	}

	async mainOld() {
		await this.init();
		let s_time = Date.now();
		let users: anchor.web3.Keypair[] = [];
		for (let i = 0; i < 100; i++) {
			const user = anchor.web3.Keypair.generate();
			users.push(user);
		}
		console.log("Users generated in ", Date.now() - s_time, "ms");
		console.log("Writing data to users");
		s_time = Date.now();
		let writes: Promise<string>[] = [];
		for (const user of users) {
			writes.push(this.callWrite(user, "singleGossip"));
			// console.log("User data written");
		}
		console.log("All data written in ", Date.now() - s_time, "ms");
		await Promise.all(writes);
		console.log("waited in ", Date.now() - s_time, "ms");
		await waitCall(await writes[86]);

		// await waitCall(await this.callRead(users[86]));
	}

	async benchLevels(users: anchor.web3.Keypair[]) {
		await this.banchWrites(users, "finalized");
		await new Promise((resolve) => setTimeout(resolve, 3 * 1000));

		await this.banchWrites(users, "confirmed");
		await new Promise((resolve) => setTimeout(resolve, 25 * 1000));

		await this.banchWrites(users, "processed");
	}

	async runBenchmarks(commitment: Commitment) {
		await this.init();
		let s_time = Date.now();
		let users: anchor.web3.Keypair[] = [];
		let fTxs: Promise<string>[] = [];
		for (let i = 0; i < 100; i++) {
			const user = anchor.web3.Keypair.generate();
			users.push(user);
			fTxs.push(
				transferSol(this.provider, this.wallet, user.publicKey, 0.1)
			);
		}
		// await new Promise((resolve) => setTimeout(resolve, 10 * 1000));

		console.log("Users generated in ", Date.now() - s_time, "ms");
		await Promise.all(fTxs);
		console.log("user funded in", Date.now() - s_time, "ms");

		await this.benchLevels(users);

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

// Users generated in  400 ms
// Writing data to users
// All data written in  469 ms
// waited in  20723 ms
// Reading data from users
// All data read in  460 ms
// waited in  18345 ms
// Writing or reading data from users
// All data in  493 ms
// ^[OSwaited in  19148 ms
// Writing and reading data from users random
// All data in  488 ms
// waited in  17904 ms
// Writing and reading data from users sequential
// All data written in  239 ms
// Reading data from users
// All data read in  461 ms
// waited in  18806 ms
