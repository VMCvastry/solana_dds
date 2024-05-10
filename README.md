https://solana.com/developers/guides/getstarted/setup-local-development#dependencies-for-linux

install exptensions
1YiB.rust-bundle
Ayushh.vscode-anchor

run:

-   background: $ solana-test-validator
-   setCLI: $ solana config set --url localhost
-   use proj wallet:$ solana config set -k <project_pwd>/.config/solana/id.json

create contract:
cargo init hello_world --lib //NO use anchor init hello_world
cd hello_world
cargo add solana-program@"1.17.24"

echo "[lib]
name = "hello_world"
crate-type = ["cdylib", "lib"]">>Cargo.toml

cargo build-bpf
solana program deploy ./target/deploy/hello_world.so

solana program extend 8zYFDuDS35MPcHsuQwzb6ed7cVdfzuVhES2DQPv1tjxJ 20000 -u l -k ../.config/solana/id.json

anchro new tx_order
anchor build
anchor deploy
npx ts-node index.ts
