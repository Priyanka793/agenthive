   const { Keypair } = require("@solana/web3.js");
   const fs = require("fs");

   const kp = Keypair.generate();
   fs.writeFileSync("wallet.json", JSON.stringify(Array.from(kp.secretKey)));
   console.log("Your wallet address (public, safe to share):");
   console.log(kp.publicKey.toBase58());
