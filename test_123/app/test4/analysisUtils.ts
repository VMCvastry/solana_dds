import * as anchor from "@coral-xyz/anchor";

export function analyzeOutput(txs: { transaction_id: anchor.BN }[]): void {
	let p_txs = txs.map((tx) => Number(tx.transaction_id));
	let disorderMeasure = 0;
	let subsequenceDisorderMeasure = 0;
	console.log("Transaction IDs:", JSON.stringify(p_txs));

	for (let i = 0; i < txs.length; i++) {
		disorderMeasure += Math.abs(p_txs[i] - i);
		if (i < txs.length - 1 && p_txs[i] > p_txs[i + 1]) {
			subsequenceDisorderMeasure++;
		}
	}

	console.log("Disorder Indicator (Module Distance):", disorderMeasure);
	console.log(
		"Disorder Indicator (Subsequence):",
		subsequenceDisorderMeasure
	);
}
//export SOLANA_BANKING_THREADS=3

// with old if 3 threads completely ordered except if transactions arrive between two steps
// increasing the num of threads do not seem to increase the disorder so much, problably there is some locking on the account

// export BLOCK_PRODUCTION_METHOD=thread-local-multi-iterator
// Disorder Indicator (Subsequence): max 1 with 3 threads (if transactions arrive between two steps)
// Disorder Indicator (Subsequence): ~ 4  with 4 threads
// Disorder Indicator (Subsequence): ~ 7  with 5 threads

// 3
// 41
// 65 6

// export BLOCK_PRODUCTION_METHOD=central-scheduler
// Requires higher difference in priority fee to be determenistic
// Disorder Indicator (Subsequence): ~ 2-3 with 3 threads (if transactions arrive between two steps SHOULD BE 1)
// Disorder Indicator (Subsequence): ~ 3  with 4 threads
// Disorder Indicator (Subsequence): ~ 3  with 5 threads
// Disorder Indicator (Subsequence): ~ 3  with 6 threads
// WIN!

// 4
// 11

// IDEAS
// Check fee/CU in old scheduler
// Why high CU limit slows down the transactions
// prioritization conflicting transactions
// conflicting transactions times
