import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import fs from "fs/promises";

const programId = "6mbUT8mwWxEsTHx1kThGjvnrF5kDEwEMhDJb8LSPnjuG";
const connection = new Connection("http://127.0.0.1:8899");

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
const minimumPriorityFee = 1_000_000; // 1 SOL as minimum priority fee

async function call(
	program: anchor.Program,
	instruction: string,
	args: any,
	wallet: anchor.Wallet
) {
	const res = await program.methods[instruction](
		new anchor.BN(minimumPriorityFee)
	)
		.accounts({
			payer: wallet.publicKey,
		})
		.signers([wallet.payer])
		.rpc();

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
		await fs.readFile("../target/idl/test_fees.json", "utf8")
	);
	console.log("IDL, ", idl);
	const program = new anchor.Program(idl!, provider);
	console.log("Program, ", program);

	await call(
		program,
		"processTransaction",
		{
			minimumPriorityFee,
		},
		wallet
	);
}

main().catch((err) => {
	console.error(err);
});
