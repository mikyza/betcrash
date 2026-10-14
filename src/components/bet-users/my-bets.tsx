import React from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface MyBet {
  id: string;
  betAmount: number;
  betType: "first" | "second";
  autoCashOut?: number | null;
  status: "active" | "cashed_out" | "lost";
  cashOutAt?: number | null;
  payout?: number | null;
  placedAt: string;
  gameId?: string;
}

const MyBets = () => {
  const [myBets, setMyBets] = React.useState<MyBet[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchMyBets = async () => {
    const token = localStorage.getItem("aviator_token");
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/bets/my?limit=50&offset=0`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const body = await response.json();
      setMyBets(body?.data?.bets || body?.data || []);
    } catch (error) {
      console.error("Error fetching my bets:", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMyBets();
  }, []);

  return (
    <>
      <div className="legend">
        <div className="date">Date</div>
        <div className="bet-100">
          <span className="bet">Bet, INR</span>
          <span>X</span>
          <span className="cash-out"> Cash out, INR </span>
        </div>
        <div className="tools"></div>
      </div>
      <div className="cdk-virtual-scroll-viewport">
        <div className="cdk-virtual-scroll-content-wrapper">
          {loading && (
            <div className="bet-item pr-2">
              <div className="user">Loading bets...</div>
            </div>
          )}
          {!loading && myBets.length === 0 && (
            <div className="bet-item pr-2">
              <div className="user">No bets found</div>
            </div>
          )}
          {myBets.map((bet, key) => {
            const placedDate = new Date(bet.placedAt);
            const timeStr =
              placedDate.getHours() +
              ":" +
              placedDate.getMinutes().toString().padStart(2, "0");
            const wonAmount =
              bet.status === "cashed_out" && bet.payout
                ? Number(bet.payout).toFixed(2)
                : "";
            return (
              <div
                className={`bet-item pr-2 ${bet.status === "cashed_out" ? "celebrated" : ""}`}
                key={key}
              >
                <div className="user">
                  <div className="username">{timeStr}</div>
                </div>
                <div className="bet">{Number(bet.betAmount).toFixed(2)}</div>
                {bet.status === "cashed_out" && bet.cashOutAt && (
                  <div className="multiplier-block">
                    <div className="bubble">{Number(bet.cashOutAt).toFixed(2)}</div>
                  </div>
                )}
                <div className="cash-out">{wonAmount}</div>
                <div className="tools">
                  <div className="fairness-i"></div>
                  <div className="share-i"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default MyBets;
