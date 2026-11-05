"use client";
import React from "react";
import Image from "next/image";
import Header from "../components/Header";
import BetsUsers from "../components/bet-users";
import Main from "../components/Main";
import AuthModal from "../components/AuthModal";
import { Context } from "@/context";
// Image moved to public/images/propeller.png

export default function Home() {
  const { unityLoading, currentProgress, isAuthenticated } =
    React.useContext(Context);

  return (
    <div className="main-container">
      {!unityLoading && (
        <div className="myloading">
          <div className="loading-container">
            <div className="rotation">
              <Image alt="propeller" src="/images/propeller.png" width={100} height={100} priority />
            </div>
            <div className="waiting">
              <div
                style={{ width: `${currentProgress * 1.111 + 0.01}%` }}
              ></div>
            </div>
            <p>{Number(currentProgress * 1.111 + 0.01).toFixed(2)}%</p>
          </div>
        </div>
      )}
      {!isAuthenticated && <AuthModal />}
      <Header />
      <div className="game-container">
        <BetsUsers />
        <Main />
      </div>
    </div>
  );
}
