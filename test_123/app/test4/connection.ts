import * as anchor from "@coral-xyz/anchor";
import {
	PublicKey,
	Connection,
	clusterApiUrl,
	ComputeBudgetProgram,
	TransactionInstruction,
} from "@solana/web3.js";

import fs from "fs/promises";
const programId = "9DCP3wdVuR2vSzsJC15zdMNsDPfd5eEs5kTnTv8GqNJT";
export const connection = new Connection("http://127.0.0.1:8899");

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
