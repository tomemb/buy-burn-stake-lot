import { createContext, useState, useEffect, useContext, useMemo } from "react";
import { BN } from "@project-serum/anchor";
import { SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { sendAndConfirmTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction } from "@solana/spl-token"; // Import if not already
import { PROGRAM_ID } from "../utils/constants.js";
import { Transaction } from "@solana/web3.js";

import {
  getLotteryAddress,
  getMasterAddress,
  getProgram,
  getTicketAddress,
  getTotalPrize,
} from "../utils/program";
import { confirmTx, mockWallet } from "../utils/helper";
import toast from 'react-hot-toast';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [masterAddress, setMasterAddress] = useState();
  const [lotteryAddress, setLotteryAddress] = useState();
  const [lottery, setLottery] = useState();
  const [lotteryPot, setLotteryPot] = useState();
  const [lotteryPlayers, setPlayers] = useState([]);
  const [lotteryId, setLotteryId] = useState();
  const [lotteryHistory, setLotteryHistory] = useState([]);
  const [userWinningId, setUserWinningId] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [intialized, setIntialized] = useState(false);
  const [country, setCountry] = useState("");
  const [continent, setContinent] = useState("");
  const [tokenAttributed, setTokenAttributed] = useState("");
  const [entryMethod, setEntryMethod] = useState("");
  const [entryPrice, setEntryPrice] = useState(); // Default entry price is 5 SOL
  const [burnAmount, setBurnAmount] = useState(); // State for burn amount
  const [burnAmountInBaseUnits] = useState();
 
  const getStakingAccountAddress = async (stakerPubKey, tokenMintAddress) => {
    const [stakingAccountPDA] = await PublicKey.findProgramAddress(
      [
          Buffer.from("user_stake"),
          stakerPubKey.toBuffer(),
          tokenMintAddress.toBuffer()
      ],
      PROGRAM_ID
  );
    return stakingAccountPDA;
};


// Inside PotCard component, add state for stakeAmount
const [stakeAmount, setStakeAmount] = useState("");
  // Get provider
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const program = useMemo(() => {
    if (connection) {
      return getProgram(connection, wallet ?? mockWallet());
    }
  }, [connection, wallet]);

  // Update state whenever the program changes
  useEffect(() => {
    updateState();
  }, [program]);

  // Update pot, players, and history whenever the lottery state changes
  useEffect(() => {
    if (lottery) {
      getPot();
      getPlayers();
      getHistory();
      console.log("Updated lottery state in frontend:", lottery);
      console.log("Lottery winner ID in frontend:", lottery?.winnerId);
      console.log("User Winning ID:", userWinningId);

    }
  }, [lottery]);

  const updateState = async () => {
    if (!program) return;

    try {
      if (!masterAddress) {
        const masterAddress = await getMasterAddress();
        setMasterAddress(masterAddress);
      }
      const master = await program.account.master.fetch(
        masterAddress ?? (await getMasterAddress())
      );
      setIntialized(true)
      setLotteryId(master.lastId);
      const lotteryAddress = await getLotteryAddress(master.lastId);
      setLotteryAddress(lotteryAddress);
      const lottery = await program.account.lottery.fetch(lotteryAddress);
      setLottery(lottery);

      // Get user's tickets for the current lottery
      if (!wallet?.publicKey) return;
      const userTickets = await program.account.ticket.all([
        {
          memcmp: {
            bytes: bs58.encode(new BN(lotteryId).toArrayLike(Buffer, "le", 4)),
            offset: 12,
          },
        },
        { memcmp: { bytes: wallet.publicKey.toBase58(), offset: 16 } },
      ]);

      // Check whether any of the user tickets win
      const userWin = userTickets.some(
        (t) => t.account.id === lottery.winnerId
      );
      if (userWin) {
        setUserWinningId(lottery.winnerId);
      } else {
        setUserWinningId(null);
      }
    } catch (err) {
      console.log(err.message);
    }
  };


  const getPot = async () => {
    try {
      if (!lottery) return;
  
      // Correctly fetch the lottery account
      const lotteryAccount = await program.account.lottery.fetch(lotteryAddress);
  
      // Log the prize pot in lamports
      console.log("Prize Pot in lamports:", lotteryAccount.prizePot.toString());
  
      // Convert to SOL and log
      const prizePotInSOL = new BN(lotteryAccount.prizePot)
        .div(new BN(LAMPORTS_PER_SOL))
        .toString();
      console.log("Prize Pot in SOL:", prizePotInSOL);
  
      // Update the state
      setLotteryPot(prizePotInSOL);
    } catch (err) {
      console.error("Error fetching prize pot:", err);
    }
  };
  

 
  
  
  

  const getPlayers = async () => {
    if (!lottery) return;
    const players = [lottery.lastTicketId];
    setPlayers(players);
  };

  const getHistory = async () => {
    if (!lotteryId) return;

    const history = [];

    for (let i = 0; i < lotteryId; i++) {
      const id = lotteryId - i;
      if (!id) break;

      const lotteryAddress = await getLotteryAddress(id);
      const lottery = await program.account.lottery.fetch(lotteryAddress);
      const winnerId = lottery.winnerId;
      if (!winnerId) continue;

      const ticketAddress = await getTicketAddress(lotteryAddress, winnerId);
      const ticket = await program.account.ticket.fetch(ticketAddress);

      history.push({
        lotteryId: id,
        winnerId,
        winnerAddress: ticket.authority,
        prize: getTotalPrize(lottery),
      });
    }

    setLotteryHistory(history);
  };

  const initMaster = async () => {
    setError("");
    setSuccess("");
    try {
      const txHash = await program.methods
        .initMaster()
        .accounts({
          master: masterAddress,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      await confirmTx(txHash, connection);

      updateState();
      toast.success("Initialized Master");
    } catch (err) {
      setError(err.message);
      toast.error("Initializing FAILED!");
    }
  };

  const createLottery = async () => {
    setError("");
    setSuccess("");
  
    try {
      const lotteryAddress = await getLotteryAddress(lotteryId + 1);
      const txHash = await program.methods
        .createLottery() // No ticket price is needed here anymore
        .accounts({
          lottery: lotteryAddress,
          master: masterAddress,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      await confirmTx(txHash, connection);
  
      updateState();
      getPot(); // Refresh the pot after creating a new lottery
      toast.success("Lottery Created!");
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  const refreshStateAndPot = async () => {
    await updateState();
    await getPot();
    toast.success("All done lad");
  };
  
 


  const buyTicket = async () => {
    setError("");
    setSuccess("");
  
    if (!country || !continent || !tokenAttributed || !entryMethod || !entryPrice) {
      setError("All fields are required to buy a ticket.");
      toast.error("All fields are required to buy a ticket.");
      return;
    }
  
    try {
      const ticketAddress = await getTicketAddress(
        lotteryAddress,
        (lottery.lastTicketId ?? 0) + 1
      );
  
      const txHash = await program.methods
        .buyTicket(
          new BN(lotteryId),
          country,
          continent,
          new BN(tokenAttributed),
          entryMethod,
          new BN(entryPrice).mul(new BN(LAMPORTS_PER_SOL))
        )
        .accounts({
          lottery: lotteryAddress,
          ticket: ticketAddress,
          buyer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
  
      await confirmTx(txHash, connection);
      toast.success("Bought a Ticket!");
      refreshStateAndPot();

    } catch (err) {
      console.error("Error during buyTicket transaction:", err);
      setError(err.message);
      toast.error(err.message);
    }
  };
  
  const pickWinner = async () => {
    setError("");
    setSuccess("");

    try {
      const txHash = await program.methods
        .pickWinner(lotteryId)
        .accounts({
          lottery: lotteryAddress,
          authority: wallet.publicKey,
        })
        .rpc();
      await confirmTx(txHash, connection);

      updateState();
      toast.success("Picked winner!")
    } catch (err) {
      setError(err.message);
      toast.error(err.message)
    }
  };

  const claimPrize = async () => {
    setError("");
    setSuccess("");

    try {
      const txHash = await program.methods
        .claimPrize(lotteryId, userWinningId)
        .accounts({
          lottery: lotteryAddress,
          ticket: await getTicketAddress(lotteryAddress, userWinningId),
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      await confirmTx(txHash, connection);

      updateState();
      toast.success("The Winner has claimed the prize!!")
    } catch (err) {
      setError(err.message);
      toast.error(err.message)
    }
  };

 

const burnAndBuyTicket = async (country, continent, tokenMint, burnAmount) => {
    setError("");
    setSuccess("");

    if (!country || !continent || !tokenMint || !burnAmount) {
        setError("All fields are required, including Burn Amount.");
        toast.error("Please fill all required fields.");
        return;
    }

    try {
        // Ensure tokenMint is a valid PublicKey
        const tokenMintAddress = new PublicKey(tokenMint);
        const mintInfo = await getMint(connection, tokenMintAddress); // Fetch mint info

     // Convert burnAmount to the correct units based on token decimals
     const burnAmountInBaseUnits = new BN(burnAmount).mul(new BN(10).pow(new BN(mintInfo.decimals)));

     console.log("Converted burnAmount in base units:", burnAmountInBaseUnits.toString());

        const txHash = await program.methods
        .enterWithBurn(
            new BN(burnAmountInBaseUnits), // Ensure this is based on the inputted burn amount
            new BN(lotteryId),
            country,
            continent,
            tokenMintAddress.toString()
        )
        .accounts({
            lottery: lotteryAddress, // This should be the current lottery's address
            ticket: await getTicketAddress(lotteryAddress, lottery.lastTicketId + 1),
            buyer: wallet.publicKey,
            userTokenAccount: await getAssociatedTokenAddress(tokenMintAddress, wallet.publicKey),
            tokenMint: tokenMintAddress,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    

        await confirmTx(txHash, connection);
        toast.success("Burned tokens and bought a Ticket!");
        refreshStateAndPot();
    } catch (err) {
        console.error("Error during burnAndBuyTicket transaction:", err);
        setError(err.message);
        toast.error(err.message);
    }

    console.log("Lottery ID:", lotteryId);
    console.log("Burn Amount (BN, in Base Units):", burnAmountInBaseUnits);
    console.log("Country:", country);
    console.log("Continent:", continent);
};


const stakeTokens = async (country, continent, tokenMint, stakeAmount) => {
    setError("");
    setSuccess("");

    // Validate required inputs
    if (!country || !continent || !tokenMint || !stakeAmount) {
        setError("All fields are required, including Stake Amount.");
        toast.error("Please fill all required fields.");
        return;
    }

    try {
        const tokenMintAddress = new PublicKey(tokenMint);

        // Derive the associated token account for the staker
        const stakerTokenAccount = await getAssociatedTokenAddress(
            tokenMintAddress,  // Mint address
            wallet.publicKey    // Owner (staker) public key
        );

        // Derive the program-derived address (PDA) for userStakeAccount
        const userStakeAccount = await getStakingAccountAddress(wallet.publicKey, tokenMintAddress);
        const ticketAddress = await getTicketAddress(lotteryAddress, lottery.lastTicketId);

        // Log the accounts for debugging purposes
        console.log("User Stake Account (PDA):", userStakeAccount.toBase58());
        console.log("Staker Token Account (ATA):", stakerTokenAccount.toBase58());
        console.log("Ticket Address:", ticketAddress.toBase58());
        console.log("Token Mint Address:", tokenMintAddress.toBase58());

        // Initialize a new transaction
        let transaction = new Transaction();

        // Create the staking instruction from the program
        const stakeInstruction = await program.methods
            .stake(new BN(stakeAmount), country, continent, tokenMintAddress.toBase58())
            .accounts({
                lottery: new PublicKey(lotteryAddress),
                userStakeAccount,  // This should be created by the program if it doesn’t exist
                stakerTokenAccount,
                ticket: ticketAddress,
                staker: wallet.publicKey,
                mint: tokenMintAddress,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .instruction();

        // Add the staking instruction to the transaction
        transaction.add(stakeInstruction);

        // Fetch a fresh blockhash and set it in the transaction
        const { blockhash } = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;

        // Sign and send the transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        const txHash = await connection.sendRawTransaction(signedTransaction.serialize());
        await confirmTx(txHash, connection);

        toast.success("Tokens Staked!");
        refreshStateAndPot();
    } catch (err) {
        console.error("Error during stakeTokens transaction:", err);
        setError(err.message);
        toast.error(err.message);
    }
};




const unstakeTokens = async (country, continent, tokenMint) => {
  setError("");
  setSuccess("");

  if (!country || !continent || !tokenMint) {
      setError("All fields are required for unstaking.");
      toast.error("Please fill all required fields.");
      return;
  }

  try {
      const tokenMintAddress = new PublicKey(tokenMint);

      const txHash = await program.methods
          .unstake(
              new BN(1), // Assuming unstake requires the max amount
              country,
              continent,
              tokenMintAddress.toString()
          )
          .accounts({
              lottery: lotteryAddress,
              ticket: await getTicketAddress(lotteryAddress, lottery.lastTicketId),
              staker: wallet.publicKey,
              stakerTokenAccount: await getAssociatedTokenAddress(tokenMintAddress, wallet.publicKey),
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

      await confirmTx(txHash, connection);
      toast.success("Tokens unstaked successfully!");
      refreshStateAndPot();
  } catch (err) {
      console.error("Error during unstakeTokens transaction:", err);
      setError(err.message);
      toast.error(err.message);
  }

  console.log("Country:", country);
  console.log("Continent:", continent);
};



  return (
    <AppContext.Provider
      value={{
        isMasterInitialized: intialized,
        connected: wallet?.publicKey ? true : false,
        isLotteryAuthority: wallet && lottery && wallet.publicKey.equals(lottery.authority),
        lotteryId,
        lotteryPot,
        lotteryPlayers,
        lotteryHistory,
        isFinished: lottery && lottery.winnerId,
        canClaim: lottery && !lottery.claimed && userWinningId,
        initMaster,
        createLottery,
        buyTicket,
        pickWinner,
        claimPrize,
        entryPrice,
        error,
        success,
        intialized,
        country,
        continent,
        tokenAttributed,
        entryMethod,
        setCountry,
        setContinent,
        setTokenAttributed,
        setEntryMethod,
        setEntryPrice,
        setLotteryPot,
         burnAndBuyTicket,
        burnAmount,
        setBurnAmount,
        stakeTokens,
        unstakeTokens,
        stakeAmount,
        setStakeAmount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  return useContext(AppContext);
};
