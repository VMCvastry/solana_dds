test_123/app/dds_proj folder
They can be run via `npm start dds_proj/file_name.ts` from inside the app folder.
To be run the necessary dependencies must be installed via `npm install` from inside the app folder.
A solana local validator must be running in the background.
`solana-test-validator` can be used to start the validator. Solana CLI must be installed and configured to use the local validator.

The program source code is in the folder programs/no_conflicts.
`npm run bd --project no_conflicts` from the main folder can be used to build and deploy the program to the local validator.
