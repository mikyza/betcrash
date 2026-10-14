/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import React, { useRef } from "react";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import {
  UserType,
  BettedUserType,
  GameHistory,
  ContextType,
  ContextDataType,
  MsgUserType,
  GameBetLimit,
  UserStatusType,
  GameStatusType,
  LoadingType,
  unityContext as sharedUnityContext,
  init_state as sharedInitState,
  init_userInfo,
} from "./utils/interfaces";

//  ----  Backend Event Payloads  ---- 
interface GameStatePayload {
  gameId: string;
  gameNumber: number;
  status: "betting" | "playing" | "crashed";
  currentMultiplier: number;
  timeElapsed: number;
  bettingEndsAt?: number;
  activeBets: BackendBet[];
  cashedOutBets: BackendCashedBet[];
}
interface BackendBet {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  betAmount: number;
  betType: "first" | "second";
  autoCashOut: number | null;
  currency: string;
  placedAt: number;
}
interface BackendCashedBet extends BackendBet {
  cashOutAt: number;
  payout: number;
}

export interface PlayerType {
  auto: boolean;
  betted: boolean;
  cashouted: boolean;
  betAmount: number;
  cashAmount: number;
  target: number;
}

//  ----  Constants  ---- 
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const toFrontendStatus = (status: string): string => {
  switch (status) {
    case "betting": return "BET";
    case "playing": return "PLAYING";
    case "crashed": return "GAMEEND";
    default: return "BET";
  }
};

const toBettedUsers = (active: BackendBet[], cashedOut: BackendCashedBet[]): BettedUserType[] => {
  const fromCashed: BettedUserType[] = cashedOut.map((b) => ({
    name: b.username, betAmount: b.betAmount, cashOut: b.cashOutAt,
    cashouted: true, target: b.cashOutAt, img: b.avatar || "", avatar: b.avatar || "",
  }));
  const fromActive: BettedUserType[] = active.map((b) => ({
    name: b.username, betAmount: b.betAmount, cashOut: 0,
    cashouted: false, target: b.autoCashOut || 0, img: b.avatar || "", avatar: b.avatar || "",
  }));
  return [...fromCashed, ...fromActive];
};

//  ----  Auth helpers  ---- 
export const getStoredToken = (): string => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("aviator_token") || "";
};
export const setStoredToken = (token: string) => {
  if (typeof window !== "undefined") localStorage.setItem("aviator_token", token);
};
export const clearStoredToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("aviator_token");
    localStorage.removeItem("aviator_user");
  }
};

//  ----  Socket instance  ---- 
let socket: Socket;
const createSocket = (token?: string): Socket =>
  io(BACKEND_URL, {
    transports: ["websocket", "polling"],
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

if (typeof window !== "undefined") {
  socket = createSocket(getStoredToken());
} else {
  socket = {} as Socket;
}

export const callCashOut = (at: number, index: "f" | "s") => {
  if (typeof window !== "undefined" && socket?.emit) {
    socket.emit("cashOut", { betType: index === "f" ? "first" : "second" });
  }
};

//  ----  Context  ---- 
const Context = React.createContext<ContextType>(null!);

export const Provider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = React.useState<ContextDataType>(sharedInitState);
  const [userInfo, setUserInfo] = React.useState<UserType>(init_userInfo);
  const [msgData, setMsgData] = React.useState<MsgUserType[]>([]);
  const [msgTab, setMsgTab] = React.useState(false);
  const [msgReceived, setMsgReceived] = React.useState(false);
  const [platformLoading, setPlatformLoading] = React.useState(false);
  const [errorBackend, setErrorBackend] = React.useState(false);
  const [secure, setSecure] = React.useState(false);
  const [userSeedText, setUserSeedText] = React.useState("");
  const [globalUserInfo, setGlobalUserInfo] = React.useState<UserType>(init_userInfo);
  const [fLoading, setFLoading] = React.useState(false);
  const [sLoading, setSLoading] = React.useState(false);
  const [currentTarget, setCurrentTarget] = React.useState(0);
  const [bettedUsers, setBettedUsers] = React.useState<BettedUserType[]>([]);
  const [history, setHistory] = React.useState<number[]>([]);
  const [rechargeState, setRechargeState] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  const [unity, setUnity] = React.useState({
    unityState: false, unityLoading: false, currentProgress: 0,
  });

  const [gameState, setGameState] = React.useState({
    currentNum: 1.0, currentSecondNum: 1.0,
    GameState: "BET", time: Date.now(),
    bettingEndsAt: 0, currentGameId: "",
  });

  const [userBetState, setUserBetState] = React.useState<UserStatusType>({
    fbetState: false, fbetted: false, sbetState: false, sbetted: false,
  });

  const [betLimit, setBetLimit] = React.useState<GameBetLimit>({ maxBet: 100000, minBet: 10 });

  // Stable refs to avoid stale closures in socket callbacks
  const gameStateRef = useRef(gameState);
  const userBetStateRef = useRef(userBetState);
  const stateRef = useRef(state);
  const userInfoRef = useRef(userInfo);

  React.useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  React.useEffect(() => { userBetStateRef.current = userBetState; }, [userBetState]);
  React.useEffect(() => { stateRef.current = state; }, [state]);
  React.useEffect(() => { userInfoRef.current = userInfo; }, [userInfo]);

  //  ----  Helpers  ---- 
  const update = (attrs: Partial<ContextDataType>) => {
    setState((prev) => ({ ...prev, ...attrs }));
  };

  const emitPlaceBet = (betType: "first" | "second") => {
    if (!socket?.emit) return;
    const st = stateRef.current;
    const ui = userInfoRef.current;
    const idx = betType === "first" ? "f" : "s";
    const betAmount = ui[idx]?.betAmount || 10;
    const autoCashoutState = st[`${idx}autoCashoutState`];
    const autoCashOut = autoCashoutState ? (ui[idx]?.target || null) : null;
    socket.emit("placeBet", {
      betAmount, betType, autoCashOut: autoCashOut || null, currency: ui.currency || "INR",
    });
  };

  const updateUserBetState = (attrs: Partial<UserStatusType>) => {
    // Side effects (socket emits) must NOT live inside a setState updater: React may run updaters twice (StrictMode)
    const gs = gameStateRef.current;
    const prev = userBetStateRef.current;
    if (gs.GameState === "BET" && gs.currentGameId) {
      if (attrs.fbetState === true && !prev.fbetted) emitPlaceBet("first");
      if (attrs.sbetState === true && !prev.sbetted) emitPlaceBet("second");
    }
    setUserBetState((p) => ({ ...p, ...attrs }));
  };

  //  ----  Unity  ---- 
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    sharedUnityContext.on("GameController", (message: string) => {
      if (message === "Ready") setUnity({ currentProgress: 100, unityLoading: true, unityState: true });
    });
    sharedUnityContext.on("progress", (progression: number) => {
      const p = progression * 100;
      setUnity(progression === 1
        ? { currentProgress: p, unityLoading: true, unityState: true }
        : { currentProgress: p, unityLoading: false, unityState: false });
    });
    return () => sharedUnityContext.removeAllEventListeners();
  }, []);

  //  ----  Socket listeners  ---- 
  const attachListeners = () => {
    socket.on("connect", () => { setErrorBackend(false); });
    socket.on("disconnect", () => {});
    socket.on("connect_error", (err: Error) => {
      setErrorBackend(true);
      // Expired / revoked token: drop the session and reconnect as a guest instead of retrying forever
      if (err?.message === "unauthorized") {
        clearStoredToken();
        setIsAuthenticated(false);
        setUserInfo(init_userInfo);
        reconnectWithToken("");
      }
    });

    socket.on("gameState", (payload: GameStatePayload) => {
      setGameState((prev) => ({
        ...prev,
        GameState: toFrontendStatus(payload.status),
        currentNum: payload.currentMultiplier || 1.0,
        currentSecondNum: payload.currentMultiplier || 1.0,
        time: Date.now(),
        currentGameId: payload.gameId,
        bettingEndsAt: payload.bettingEndsAt || 0,
      }));
      setBettedUsers(toBettedUsers(payload.activeBets || [], payload.cashedOutBets || []));
    });

    socket.on("gameStart", (data: { gameId: string; gameNumber: number; bettingEndsAt: number }) => {
      setGameState((prev) => ({
        ...prev, GameState: "BET", currentNum: 1.0, currentSecondNum: 1.0,
        time: Date.now(), currentGameId: data.gameId, bettingEndsAt: data.bettingEndsAt,
      }));
      setBettedUsers([]);
      // Place queued bets
      const bs = userBetStateRef.current;
      if (bs.fbetState && !bs.fbetted) setTimeout(() => emitPlaceBet("first"), 150);
      if (bs.sbetState && !bs.sbetted) setTimeout(() => emitPlaceBet("second"), 150);
    });

    socket.on("gamePhase", (data: { status: string }) => {
      setGameState((prev) => ({ ...prev, GameState: toFrontendStatus(data.status), time: Date.now() }));
    });

    socket.on("gameTick", (data: { currentMultiplier: number; timeElapsed: number }) => {
      setGameState((prev) => ({
        ...prev,
        currentNum: data.currentMultiplier,
        currentSecondNum: data.currentMultiplier,
        time: data.timeElapsed,
      }));
    });

    socket.on("gameCrash", (data: { crashPoint: number }) => {
      setGameState((prev) => ({
        ...prev, GameState: "GAMEEND",
        currentNum: data.crashPoint, currentSecondNum: data.crashPoint, time: Date.now(),
      }));
      setHistory((prev) => [data.crashPoint, ...prev].slice(0, 100));
      setUserBetState({ fbetState: false, fbetted: false, sbetState: false, sbetted: false });
    });

    socket.on("betPlaced", (data: { gameId: string; bet: BackendBet }) => {
      const b = data.bet;
      setBettedUsers((prev) => {
        if (prev.some((u) => u.name === b.username && !u.cashouted)) return prev;
        return [{ name: b.username, betAmount: b.betAmount, cashOut: 0, cashouted: false, target: b.autoCashOut || 0, img: b.avatar || "", avatar: b.avatar || "" }, ...prev];
      });
      // Own bet confirmed
      const me = userInfoRef.current;
      if (b.userId === me.userId) {
        setUserBetState((prev) => ({
          ...prev,
          ...(b.betType === "first" ? { fbetState: false, fbetted: true } : { sbetState: false, sbetted: true }),
        }));
      }
    });

    socket.on("playerCashOut", (data: { userId: string; username: string; cashOutAt: number; betType?: "first" | "second" }) => {
      setBettedUsers((prev) =>
        prev.map((u) => u.name === data.username ? { ...u, cashouted: true, cashOut: data.cashOutAt, target: data.cashOutAt } : u)
      );
      const me = userInfoRef.current;
      if (data.userId === me.userId) {
        // only release the slot that was cashed out (previously both slots were cleared)
        setUserBetState((prev) => ({ ...prev, ...(data.betType === "second" ? { sbetted: false } : { fbetted: false }) }));
      }
    });

    socket.on("balanceUpdate", (data: { balance: number }) => {
      setUserInfo((prev) => ({ ...prev, balance: data.balance }));
    });

    socket.on("chatHistory", (messages: any[]) => {
      setMsgData(messages.map((m) => ({
        _id: m.id, userId: m.userId, userName: m.username, avatar: m.avatar,
        message: m.message, img: m.type === "gif" ? m.message : "",
        likes: m.likes || 0, likesIDs: [], disLikes: 0, disLikesIDs: [],
      })));
    });

    socket.on("chatMessage", (m: any) => {
      setMsgData((prev) => [...prev, {
        _id: m.id, userId: m.userId, userName: m.username, avatar: m.avatar,
        message: m.message, img: m.type === "gif" ? m.message : "",
        likes: m.likes || 0, likesIDs: [], disLikes: 0, disLikesIDs: [],
      }]);
      setMsgReceived(true);
    });

    socket.on("betError", (data: { message: string }) => { toast.error(data.message); });
    socket.on("cashOutError", (data: { message: string }) => { toast.error(data.message); });
  };

  const detachListeners = () => {
    ["connect", "disconnect", "connect_error", "gameState", "gameStart", "gamePhase",
      "gameTick", "gameCrash", "betPlaced", "playerCashOut", "balanceUpdate",
      "chatHistory", "chatMessage", "betError", "cashOutError"].forEach((e) => socket.off(e));
  };

  const reconnectWithToken = (token: string) => {
    detachListeners();
    if (socket?.disconnect) socket.disconnect();
    socket = createSocket(token || undefined);
    attachListeners();
  };

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    attachListeners();
    // Restore auth from localStorage
    try {
      const raw = localStorage.getItem("aviator_user");
      if (raw) {
        const u = JSON.parse(raw);
        setUserInfo((prev) => ({ ...prev, userId: u.id || u.userId || "", userName: u.username || u.userName || "", balance: u.balance || 0, avatar: u.avatar || "", currency: u.currency || "INR" }));
        setIsAuthenticated(true);
      }
    } catch {}
    return detachListeners;
  }, []);

  //  ----  Auth API  ---- 
  const login = async (identifier: string, password: string) => {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.data?.message || body?.message || "Login failed");
    const { accessToken, user } = body.data;
    setStoredToken(accessToken);
    localStorage.setItem("aviator_user", JSON.stringify(user));
    setUserInfo((prev) => ({ ...prev, userId: user.id, userName: user.username, balance: user.balance, avatar: user.avatar || "", currency: user.currency || "INR" }));
    setIsAuthenticated(true);
    reconnectWithToken(accessToken);
    return user;
  };

  const logout = async () => {
    try {
      const token = getStoredToken();
      if (token) await fetch(`${BACKEND_URL}/api/v1/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch {}
    clearStoredToken();
    setIsAuthenticated(false);
    setUserInfo(init_userInfo);
    reconnectWithToken("");
  };

  //  ----  Context value  ---- 
  const contextValue: ContextType = {
    state, userInfo, socket, msgData, platformLoading, msgTab, errorBackend,
    unityState: unity.unityState, unityLoading: unity.unityLoading, currentProgress: unity.currentProgress,
    globalUserInfo, bettedUsers, previousHand: [], history, rechargeState, secure, msgReceived,
    myUnityContext: sharedUnityContext, userSeedText, currentTarget, fLoading, sLoading,

    currentNum: typeof gameState.currentNum === "number" ? gameState.currentNum.toFixed(2) : "1.00",
    currentSecondNum: gameState.currentSecondNum || 1.0,
    GameState: gameState.GameState || "BET",
    time: gameState.time || Date.now(),

    fbetState: userBetState.fbetState, fbetted: userBetState.fbetted,
    sbetState: userBetState.sbetState, sbetted: userBetState.sbetted,

    maxBet: betLimit.maxBet, minBet: betLimit.minBet,

    setFLoading: (v) => setFLoading(Boolean(v)),
    setSLoading: (v) => setSLoading(Boolean(v)),
    setCurrentTarget, setMsgReceived,
    update,
    updateUserInfo: (attrs) => setUserInfo((prev) => ({ ...prev, ...attrs })),
    getMyBets: () => {},
    updateUserBetState,
    setMsgData,
    handleGetSeed: () => {},
    handleGetSeedOfRound: async (gameNumber: Number) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/games/verify/${gameNumber}`);
        const body = await res.json();
        const d = body?.data;
        return { createdAt: new Date().toISOString(), serverSeed: d?.serverSeed || "", seedOfUsers: [{ seed: d?.clientSeed || "" }] };
      } catch {
        return { createdAt: "", serverSeed: "", seedOfUsers: [] };
      }
    },
    handlePlaceBet: () => {},
    toggleMsgTab: () => setMsgTab((prev) => !prev),
    handleChangeUserSeed: (s) => setUserSeedText(s),
    isAuthenticated,
    login,
    logout,
  };

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export { Context };
export type { BettedUserType, UserType, GameHistory, ContextType, ContextDataType, MsgUserType, GameBetLimit, GameStatusType, LoadingType };
