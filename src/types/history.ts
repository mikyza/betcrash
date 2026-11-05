export interface BetHistory {
    _id: string;
    gameNumber: number;
    betAmount: number;
    cashOutAt?: number;
    payout: number;
    status: 'active' | 'cashed_out' | 'lost';
    placedAt: string;
    cashedAt?: string;
}

export interface GameHistory {
    _id: string;
    gameNumber: number;
    crashPoint: number;
    date: string;
}
