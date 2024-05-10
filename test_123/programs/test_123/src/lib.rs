use anchor_lang::prelude::*;

declare_id!("8zYFDuDS35MPcHsuQwzb6ed7cVdfzuVhES2DQPv1tjxJ");

#[program]
pub mod test_123 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        //log
        msg!("Hello, adsaggfasfdsaWorld!");
        Ok(())
    }

    pub fn return_hello(ctx: Context<Initialize>) -> Result<String> {
        msg!("Hello, World!");
        Ok("Hello, World!".to_string())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
