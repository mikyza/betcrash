import { UnityContext } from "react-unity-webgl";
import { Socket } from "socket.io-client";


export interface BettedUserType {
    name: string;
    betAmount: number;
    cashOut: number;
    cashouted: boolean;
    target: number;
    img: string;
    avatar?: string;
}

export interface BetResults {
    members: number;
    betAmount: number;
    cashouted: number;
}

export interface UserType {
    balance: number;
    userType: boolean;
    avatar: string;
    userId: string;
    currency: string;
    userName: string;
    ipAddress: string;
    platform: string;
    token: string;
    Session_Token: string;
    isSoundEnable: boolean;
    isMusicEnable: boolean;
    msgVisible: boolean;
    f: {
        auto: boolean;
        autocashout: boolean;
        betid: string;
        betted: boolean;
        cashouted: boolean;
        betAmount: number;
        cashAmount: number;
        target: number;
    };
    s: {
        auto: boolean;
        autocashout: boolean;
        betid: string;
        betted: boolean;
        cashouted: boolean;
        betAmount: number;
        cashAmount: number;
        target: number;
    };
}

export interface PlayerType {
    auto: boolean;
    betted: boolean;
    cashouted: boolean;
    betAmount: number;
    cashAmount: number;
    target: number;
}

export interface GameStatusType {
    currentNum: string;
    currentSecondNum: number;
    GameState: string;
    time: number;
}

export interface GameBetLimit {
    maxBet: number;
    minBet: number;
}

export declare interface GameHistory {
    _id: number;
    name: string;
    betAmount: number;
    cashoutAt: number;
    cashouted: boolean;
    createdAt: string;
    flyAway: number;
    flyDetailID: number;
    date: number;
}

export interface UserStatusType {
    fbetState: boolean;
    fbetted: boolean;
    sbetState: boolean;
    sbetted: boolean;
}

export interface ContextDataType {
    [key: string]: any; // Allow dynamic property access
    myBets: GameHistory[];
    width: number;
    seed: string;
    fautoCashoutState: boolean;
    fautoCound: number;
    finState: boolean;
    fdeState: boolean;
    fsingle: boolean;
    fincrease: number;
    fdecrease: number;
    fsingleAmount: number;
    fdefaultBetAmount: number;
    sautoCashoutState: boolean;
    sautoCound: number;
    sincrease: number;
    sdecrease: number;
    ssingleAmount: number;
    sinState: boolean;
    sdeState: boolean;
    ssingle: boolean;
    sdefaultBetAmount: number;
    userInfo: UserType;
    myUnityContext: UnityContext;
}

export interface LoadingType {
    fLoading: boolean;
    sLoading: boolean;
}

export interface ContextType extends GameBetLimit, UserStatusType, GameStatusType {
    state: ContextDataType;
    userInfo: UserType;
    socket: Socket;
    msgData: MsgUserType[];
    platformLoading: boolean;
    msgTab: boolean;
    errorBackend: boolean;
    unityState: boolean;
    unityLoading: boolean;
    currentProgress: number;
    globalUserInfo: UserType;
    bettedUsers: BettedUserType[];
    previousHand: UserType[];
    history: number[];
    rechargeState: boolean;
    secure: boolean;
    msgReceived: boolean;
    myUnityContext: UnityContext;
    userSeedText: string;
    currentTarget: number;
    fLoading: Boolean;
    setFLoading(attrs: Boolean): void;
    sLoading: Boolean;
    setSLoading(attrs: Boolean): void;
    setCurrentTarget(attrs: Partial<number>): void;
    setMsgReceived(attrs: Partial<boolean>): void;
    update(attrs: Partial<ContextDataType>): void;
    updateUserInfo(attrs: Partial<UserType>): void;
    getMyBets(): void;
    updateUserBetState(attrs: Partial<UserStatusType>): void;
    setMsgData(attrs: MsgUserType[]): void;
    handleGetSeed(): void;
    handleGetSeedOfRound(attrs: Number): Promise<{ createdAt: string; serverSeed: string; seedOfUsers: { seed: string }[] }> | { createdAt: string; serverSeed: string; seedOfUsers: { seed: string }[] };
    handlePlaceBet(): void;
    toggleMsgTab(): void;
    handleChangeUserSeed(attrs: Partial<string>): void;
    isAuthenticated: boolean;
    login(identifier: string, password: string): Promise<any>;
    logout(): Promise<void>;
}

export interface MsgUserType {
    _id?: string;
    userId: string;
    userName: string;
    avatar: string;
    message: string;
    img: string;
    likes: number;
    likesIDs: string[];
    disLikes: number;
    disLikesIDs: string[];
}

export const unityContext = new UnityContext({
    loaderUrl: "unity/AirCrash.loader.js",
    dataUrl: "unity/AirCrash.data.unityweb",
    frameworkUrl: "unity/AirCrash.framework.js.unityweb",
    codeUrl: "unity/AirCrash.wasm.unityweb",
});

export const init_userInfo = {
    balance: 0,
    userType: false,
    userId: "",
    avatar: "",
    userName: "",
    ipAddress: "",
    platform: "desktop",
    token: '',
    Session_Token: '',
    currency: "KES",
    isSoundEnable: false,
    isMusicEnable: false,
    msgVisible: false,
    f: {
        auto: false,
        autocashout: false,
        betid: '0',
        betted: false,
        cashouted: false,
        cashAmount: 0,
        betAmount: 10,
        target: 2,
    },
    s: {
        auto: false,
        autocashout: false,
        betid: '0',
        betted: false,
        cashouted: false,
        cashAmount: 0,
        betAmount: 10,
        target: 2,
    },
} as UserType;

export const init_state = {
    myBets: [],
    width: 1500,
    seed: "",
    fautoCashoutState: false,
    fautoCound: 0,
    finState: false,
    fdeState: false,
    fsingle: false,
    fincrease: 0,
    fdecrease: 0,
    fsingleAmount: 0,
    fdefaultBetAmount: 20,
    sautoCashoutState: false,
    sautoCound: 0,
    sincrease: 0,
    sdecrease: 0,
    ssingleAmount: 0,
    sinState: false,
    sdeState: false,
    ssingle: false,
    sdefaultBetAmount: 20,
    myUnityContext: unityContext,
    userInfo: init_userInfo,
} as ContextDataType;