use anchor_lang::prelude::*;

declare_id!("9DCP3wdVuR2vSzsJC15zdMNsDPfd5eEs5kTnTv8GqNJT");


#[program]
pub mod tx_order {
    use super::*;
    pub fn record_transaction(ctx: Context<RecordTransaction>, transaction_id: u64) -> Result<()> {
        let transaction_log = &mut ctx.accounts.transaction_log;
        let entry = TransactionRecord {
            account_owner: *ctx.accounts.user.key,
            transaction_id,
        };
        transaction_log.records.push(entry);
        Ok(())
    }

    pub fn get_transactions(ctx: Context<GetTransactions>) -> Result<Vec<TransactionRecord>> {
        Ok(ctx.accounts.transaction_log.records.clone())
    }
    pub fn get_transaction(ctx: Context<GetTransactions>, index: u64) -> Result<TransactionRecord> {
        Ok(ctx.accounts.transaction_log.records[index as usize].clone())
    }  
}

#[account]
pub struct TransactionLog {
    pub records: Vec<TransactionRecord>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct TransactionRecord {
    pub account_owner: Pubkey, // 32 bytes
    pub transaction_id: u64, // 8 bytes
}
 
#[derive(Accounts)]
pub struct RecordTransaction<'info> {
    #[account(init_if_needed, payer = user, space = 10_000)]//mut // ~ 200 transactions
    pub transaction_log: Account<'info, TransactionLog>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetTransactions<'info> {
    pub transaction_log: Account<'info, TransactionLog>,
}