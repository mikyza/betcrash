import React, { useEffect, useState } from 'react';

interface GameHistory {
  gameNumber: number;
  crashPoint: number;
  startedAt: string;
  crashedAt?: string;
  totalBets: number;
  totalPayout: number;
}

const RoundHistory: React.FC = () => {
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/games/history?limit=100`);
      const data = await response.json();
      
      if (data.success) {
        setHistory(data.data);
      }
    } catch (error) {
      console.error('Error fetching game history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    
    // Refresh history every 30 seconds
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const getMultiplierColor = (crashPoint: number) => {
    if (crashPoint >= 10) return '#00ff00'; // Green for high multipliers
    if (crashPoint >= 5) return '#ffff00';  // Yellow for medium
    if (crashPoint >= 2) return '#ff8800';  // Orange for low-medium
    return '#ff0000'; // Red for very low
  };

  if (loading) {
    return (
      <div className="round-history-container">
        <div className="round-history-header">
          <h3>Round History</h3>
        </div>
        <div className="loading">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="round-history-container">
      <div className="round-history-header">
        <h3>Round History</h3>
        <span className="history-count">{history.length} rounds</span>
      </div>
      
      <div className="history-grid">
        {history.map((game) => (
          <div 
            key={game.gameNumber} 
            className="history-item"
            style={{ 
              backgroundColor: getMultiplierColor(game.crashPoint),
              opacity: 0.8 
            }}
          >
            <div className="multiplier">
              {typeof game.crashPoint === 'number' 
                ? `${game.crashPoint.toFixed(2)}x` 
                : `${parseFloat(game.crashPoint).toFixed(2)}x`
              }
            </div>
            <div className="game-info">
              <div className="game-number">#{game.gameNumber}</div>
              <div className="bet-count">{game.totalBets} bets</div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .round-history-container {
          background: rgba(0, 0, 0, 0.8);
          border-radius: 8px;
          padding: 16px;
          margin: 16px;
          max-height: 300px;
          overflow-y: auto;
        }

        .round-history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          color: white;
        }

        .round-history-header h3 {
          margin: 0;
          font-size: 18px;
        }

        .history-count {
          font-size: 12px;
          opacity: 0.7;
        }

        .loading {
          text-align: center;
          color: white;
          padding: 20px;
        }

        .history-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
        }

        .history-item {
          padding: 8px;
          border-radius: 4px;
          text-align: center;
          cursor: pointer;
          transition: transform 0.2s;
          color: black;
          font-weight: bold;
        }

        .history-item:hover {
          transform: scale(1.05);
        }

        .multiplier {
          font-size: 14px;
          font-weight: bold;
        }

        .game-info {
          font-size: 10px;
          margin-top: 4px;
        }

        .game-number {
          opacity: 0.8;
        }

        .bet-count {
          opacity: 0.6;
        }

        @media (max-width: 768px) {
          .history-grid {
            grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
          }
          
          .history-item {
            padding: 6px;
          }
          
          .multiplier {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default RoundHistory;
