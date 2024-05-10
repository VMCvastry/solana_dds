use anchor_lang::prelude::*;

declare_id!("6mbUT8mwWxEsTHx1kThGjvnrF5kDEwEMhDJb8LSPnjuG");

#[program]
pub mod test_fees {
    use super::*;

    pub fn process_transaction(ctx: Context<ProcessTransaction>, minimum_priority_fee: u64) -> Result<()> {
        let payer = &ctx.accounts.payer;
        
        // Check if the provided fee meets the minimum priority fee
        if payer.lamports() >= minimum_priority_fee {
            // Logic for priority processing
            msg!("Transaction is being processed with priority.");
        } else {
            msg!("Transaction does not meet the priority fee requirement.");
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ProcessTransaction<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}
