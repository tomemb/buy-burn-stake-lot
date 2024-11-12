import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import style from "../styles/PotCard.module.css";
import { useAppContext } from "../context/context";
import { shortenPk } from "../utils/helper";
import { Toaster } from 'react-hot-toast';

const PotCard = () => {
  const {
    lotteryId,
    lotteryPot,
    connected,
    isLotteryAuthority,
    isMasterInitialized,
    initMaster,
    createLottery,
    buyTicket,
    pickWinner,
    claimPrize,
    lotteryHistory,
    isFinished,
    canClaim,
    entryPrice,
    country,
    continent,
    tokenAttributed,
    entryMethod,
    setContinent,
    setCountry,
    setTokenAttributed,
    setEntryMethod,
    setEntryPrice,
    prizePotInSOL, 
    burnAndBuyTicket,
    burnAmount,
    setBurnAmount,
    stakeTokens,
    unstakeTokens,
    stakeAmount,
    setStakeAmount,
  } = useAppContext();

  // console.log(isMasterInitialized)
  if (!isMasterInitialized)
    return (
      <div className={style.wrapper}>
        <div className={style.title}>
          Lottery <span className={style.textAccent}>#{lotteryId}</span>
        </div>
        {connected ? (
          <>
            <div className={style.btn} onClick={initMaster}>
              Initialize master
            </div>
          </>
        ) : (
          <WalletMultiButton />
        )}
      </div>
    );

    
  return (
    <div className={style.wrapper}>
      <Toaster />
      <div className={style.title}>
        Lottery <span className={style.textAccent}>#{lotteryId}</span>
      </div>
      
      <div className={style.pot}>Pot 🍯: {lotteryPot !== null ? `${lotteryPot} SOL` : 'Loading...'}</div>

      <div className={style.recentWinnerTitle}>🏆Recent Winner🏆</div>
      <div className={style.winner}>
        {lotteryHistory?.length &&
          shortenPk(
            lotteryHistory[lotteryHistory.length - 1].winnerAddress.toBase58()
          )}
      </div>







      {connected ? (
        <>
        <div className={style.inputs}>
    {/* Existing inputs */}
    <input
  type="number"
  placeholder="Stake Amount"
  value={stakeAmount}
  onChange={(e) => setStakeAmount(Number(e.target.value))}
/>
</div>
          <div className={style.inputs}>
            <input
              type="text"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
            <input
              type="text"
              placeholder="Continent"
              value={continent}
              onChange={(e) => setContinent(e.target.value)}
            />
            <input
              type="text"
              placeholder="Token Attributed"
              value={tokenAttributed}
              onChange={(e) => setTokenAttributed(e.target.value)}
            />
            <input
              type="text"
              placeholder="Entry Method"
              value={entryMethod}
              onChange={(e) => setEntryMethod(e.target.value)}
            />
          <input
    type="number"
    placeholder="Entry Price (SOL)"
    value={entryPrice}
    onChange={(e) => setEntryPrice(Number(e.target.value))}
/>

<input
              type="number"
              placeholder="Burn Amount"
              value={burnAmount}
              onChange={(e) => setBurnAmount(Number(e.target.value))}
            />

          </div>

          

          {!isFinished && (
     <button
     className={style.btn}
     onClick={() =>
         buyTicket(country, continent, tokenAttributed, entryMethod, entryPrice)
     }
 >
     Buy Ticket
 </button>
 
 
     
      
          )}

<button
  className={style.btn}
  onClick={() =>
    burnAndBuyTicket(country, continent, tokenAttributed, burnAmount)

  }
>
  Burn Tokens & Buy Ticket (0.01 SOL Fee)
</button>


<button
    className={style.btn}
    onClick={() =>
        stakeTokens(country, continent, tokenAttributed, stakeAmount)
    }
>
    Stake Tokens
</button>

<button
    className={style.btn}
    onClick={() =>
        unstakeTokens(country, continent, tokenAttributed)
    }
>
    Unstake Tokens
</button>

          {isLotteryAuthority && !isFinished && (
            <div className={style.btn} onClick={pickWinner}>
              Pick Winner
            </div>
          )}

          {canClaim && (
            <div className={style.btn} onClick={claimPrize}>
              Claim prize
            </div>
          )}

          <div className={style.btn} onClick={createLottery}>
            Create lottery
          </div>
        </>

        
      ) : (
        <WalletMultiButton />
      )}
    </div>
  );
};

export default PotCard;
