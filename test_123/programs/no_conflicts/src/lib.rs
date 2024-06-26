use anchor_lang::prelude::*;

declare_id!("8BTxUsmr5vpof3bnJJHH9isvaQKrkds7qFNNQJutnBME");

#[program]
pub mod non_conflicts {
    use super::*;
    pub fn upsert_user_data(ctx: Context<UpsertUserData>, data: u64) -> Result<()> {
        let user_data = &mut ctx.accounts.user_data;
        user_data.data = data;
        msg!("Added data");
        Ok(())
    }

    pub fn upsert_user_data_slow(ctx: Context<UpsertUserData>, data: u64) -> Result<()> {
        let user_data = &mut ctx.accounts.user_data;
        user_data.data = data;
        // Loop to simulate longer processing time
        let mut temp = data;
        for _ in 0..100000 {
            temp = temp.wrapping_mul(2); 
        }
        
        msg!("Added data with final temp value: {}", temp);
        Ok(())
    }

    pub fn get_user_data(ctx: Context<GetUserData>) -> Result<u64> {
        let user_data = &ctx.accounts.user_data;
        Ok(user_data.data)
    }
}

#[derive(Accounts)]
pub struct UpsertUserData<'info> {
    #[account(init_if_needed, payer = user, space = 8 + 8 + 8, seeds = [user.key().as_ref()], bump)]
    pub user_data: Account<'info, UserData>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetUserData<'info> {
    #[account(seeds = [user.key().as_ref()], bump)]
    pub user_data: Account<'info, UserData>,
    pub user: Signer<'info>,
}

#[account]
pub struct UserData {
    pub data: u64,
}