import * as borsh from "borsh";

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

export function deserializeTransactionsData(raw: string) {
	const buffer = Buffer.from(raw, "base64");

	return borsh.deserialize(VecTransactionRecordSchema, buffer);
}

function deserializeTransactionData(raw: string) {
	const buffer = Buffer.from(raw, "base64");
	return borsh.deserialize(TransactionRecordSchema, buffer);
}
