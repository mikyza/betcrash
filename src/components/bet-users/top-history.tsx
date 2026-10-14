import React, { useEffect } from "react";
import MoonLoader from "react-spinners/MoonLoader";
import "./bets.scss";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface TopWin {
  username: string;
  avatar?: string;
  betAmount: number;
  cashOutAt: number;
  payout: number;
  placedAt: string;
}

interface TopMultiplier {
  gameNumber: number;
  crashPoint: number;
  totalBets: number;
  date?: string;
}

const statTypes = [
  { key: "top_wins", label: "Top Wins" },
  { key: "top_multipliers", label: "Lucky Rounds" },
];

const TopHistory = () => {
  const [subType, setSubType] = React.useState("top_wins");
  const [topWins, setTopWins] = React.useState<TopWin[]>([]);
  const [topMultipliers, setTopMultipliers] = React.useState<TopMultiplier[]>([]);
  const [loadingEffect, setLoadingEffect] = React.useState(false);

  const fetchTopWins = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/bets/top/wins?limit=20`);
      if (!res.ok) return;
      const body = await res.json();
      setTopWins(body?.data || []);
    } catch (err) {
      console.error("fetchTopWins error:", err);
    }
  };

  const fetchTopMultipliers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/bets/top/multipliers?limit=20`);
      if (!res.ok) return;
      const body = await res.json();
      setTopMultipliers(body?.data || []);
    } catch (err) {
      console.error("fetchTopMultipliers error:", err);
    }
  };

  const loadData = async (type: string) => {
    setLoadingEffect(true);
    if (type === "top_wins") {
      await fetchTopWins();
    } else {
      await fetchTopMultipliers();
    }
    setTimeout(() => setLoadingEffect(false), 400);
  };

  useEffect(() => {
    loadData(subType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subType]);

  const wins = topWins;
  const multipliers = topMultipliers;

  return (
    <>
      <div className="navigation-switcher-wrapper">
        <div className="navigation-switcher">
          <div
            className="slider"
            style={{ transform: `translate(${100 * statTypes.findIndex((s) => s.key === subType)}px)` }}
          ></div>
          {statTypes.map((stat) => (
            <button
              key={stat.key}
              onClick={() => setSubType(stat.key)}
              className={`tab ${subType === stat.key ? "click" : ""}`}
            >
              {stat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cdk-virtual-scroll-viewport">
        <div className="cdk-virtual-scroll-content-wrapper">
          {loadingEffect ? (
            <div
              style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px" }}
            >
              <MoonLoader color="#f39c12" />
            </div>
          ) : (
            <>
              {subType === "top_wins" && (
                <>
                  {wins.length === 0 ? (
                    <div className="bet-item pr-2">
                      <div className="user">No data yet</div>
                    </div>
                  ) : (
                    wins.map((item, key) => (
                      <div className="bet-item pr-2" key={key}>
                        <div className="user">
                          <div className="user-avatar">
                            <img
                              src={item.avatar || "./avatars/av-5.png"}
                              alt="avatar"
                              className="avatar"
                            />
                          </div>
                          <div className="username">{item.username}</div>
                        </div>
                        <div className="bet">&#8377;{Number(item.betAmount).toFixed(2)}</div>
                        <div className="multiplier-block">
                          <div className="bubble">{Number(item.cashOutAt).toFixed(2)}x</div>
                        </div>
                        <div className="cash-out">&#8377;{Number(item.payout).toFixed(2)}</div>
                        <div className="tools">
                          <div className="fairness-i"></div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {subType === "top_multipliers" && (
                <>
                  {multipliers.length === 0 ? (
                    <div className="bet-item pr-2">
                      <div className="user">No data yet</div>
                    </div>
                  ) : (
                    multipliers.map((item, key) => (
                      <div className="bet-item pr-2" key={key}>
                        <div className="user">
                          <div className="username">Game #{item.gameNumber}</div>
                        </div>
                        <div className="bet">{item.totalBets} bets</div>
                        <div className="multiplier-block">
                          <div className="bubble">{Number(item.crashPoint).toFixed(2)}x</div>
                        </div>
                        <div className="cash-out">
                          {item.date ? new Date(item.date).toLocaleDateString() : ""}
                        </div>
                        <div className="tools">
                          <div className="fairness-i"></div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default TopHistory;
