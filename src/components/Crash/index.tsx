/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
// import { useCrashContext } from "../Main/context";
import "./crash.scss";
import Unity from "react-unity-webgl";
// Image moved to public/images/propeller.png
import { Context } from "@/context";

let currentFlag = 0;

export default function WebGLStarter() {
	const { GameState, currentNum, time, unityState, myUnityContext, setCurrentTarget } = React.useContext(Context)
	const [target, setTarget] = React.useState(1);
	const [waiting, setWaiting] = React.useState(0);
	const [flag, setFlag] = React.useState(1);

	// Debug logs
	React.useEffect(() => {
		console.log("🎮 Game State Changed:", { GameState, currentNum, time, unityState });
	}, [GameState, currentNum, time, unityState]);

	React.useEffect(() => {
		console.log("🎯 Unity Context:", myUnityContext);
		console.log("🔗 Unity State:", unityState);
	}, [myUnityContext, unityState]);

	React.useEffect(() => {
		let myInterval: NodeJS.Timeout;
		if (GameState === "PLAYING") {
			setFlag(2);
			// Use the multiplier from backend for smooth, accurate display
			const backendMultiplier = typeof currentNum === 'string' ? parseFloat(currentNum) : currentNum;
			
			// Ensure finite number with reasonable bounds
			let displayMultiplier = backendMultiplier;
			if (!isFinite(displayMultiplier) || displayMultiplier < 1) {
				displayMultiplier = 1.00;
			} else if (displayMultiplier > 999.99) {
				displayMultiplier = 999.99;
			}
			
			// Set flags based on backend multiplier for smooth animations
			if (displayMultiplier > 2 && currentFlag === 2) {
				setFlag(3);
			} else if (displayMultiplier > 10 && currentFlag === 3) {
				setFlag(4);
			}
			
			setTarget(displayMultiplier);
			setCurrentTarget(displayMultiplier);
			
			// Smooth display updates every 50ms for professional feel
			myInterval = setInterval(() => {
				const currentMultiplier = typeof currentNum === 'string' ? parseFloat(currentNum) : currentNum;
				if (isFinite(currentMultiplier) && currentMultiplier >= 1) {
					const clampedMultiplier = Math.min(currentMultiplier, 999.99);
					setTarget(clampedMultiplier);
					setCurrentTarget(clampedMultiplier);
					
					// Update flags based on current multiplier for Unity animation phases
					if (clampedMultiplier > 10 && currentFlag < 4) {
						setFlag(4);
					} else if (clampedMultiplier > 2 && currentFlag < 3) {
						setFlag(3);
					}
				}
			}, 50);
		} else if (GameState === "GAMEEND") {
			setFlag(5);
			let finalMultiplier = typeof currentNum === 'string' ? parseFloat(currentNum) : currentNum;
			
			// Ensure finite number with reasonable bounds
			if (!isFinite(finalMultiplier) || finalMultiplier < 1) {
				finalMultiplier = 1.00;
			} else if (finalMultiplier > 999.99) {
				finalMultiplier = 999.99;
			}
			
			setCurrentTarget(finalMultiplier);
			setTarget(finalMultiplier);
		} else if (GameState === "BET") {
			setFlag(1);
			let startWaiting = Date.now() - time;
			setTarget(1);
			setCurrentTarget(1);

			// Smooth waiting animation
			myInterval = setInterval(() => {
				const elapsed = Date.now() - startWaiting;
				setWaiting(Math.min(elapsed, 5000));
			}, 20);
		}
		return () => clearInterval(myInterval);
	}, [GameState, time, currentNum])

	React.useEffect(() => {
		console.log('🎮 Sending Unity game state update:', { 
			flag, 
			GameState, 
			currentNum: typeof currentNum === 'string' ? parseFloat(currentNum) : currentNum,
			target: target
		});
		
		// Send data to Unity - simplified approach like aviator
		if (myUnityContext) {
			const currentMultiplier = typeof currentNum === 'string' ? parseFloat(currentNum) : currentNum;
			const gameData = {
				gameState: flag,
				currentMultiplier: isFinite(currentMultiplier) ? currentMultiplier : target,
				target: target
			};
			
			console.log('📤 Sending to Unity GameManager:', gameData);
			try {
				myUnityContext.send("GameManager", "RequestToken", JSON.stringify(gameData));
			} catch (error) {
				console.error('❌ Failed to send to Unity:', error);
			}
		} else {
			console.warn('⚠️ Unity context not available yet');
		}
		currentFlag = flag;
	}, [flag, myUnityContext, currentNum, target, GameState]);

	// Continuous Unity updates during playing phase for smooth animation
	React.useEffect(() => {
		let unityUpdateInterval: NodeJS.Timeout;
		
		if (GameState === "PLAYING" && myUnityContext) {
			unityUpdateInterval = setInterval(() => {
				const currentMultiplier = typeof currentNum === 'string' ? parseFloat(currentNum) : currentNum;
				if (isFinite(currentMultiplier) && currentMultiplier >= 1) {
					const gameData = {
						gameState: flag,
						currentMultiplier: Math.min(currentMultiplier, 999.99),
						target: Math.min(currentMultiplier, 999.99)
					};
					
					try {
						myUnityContext.send("GameManager", "RequestToken", JSON.stringify(gameData));
					} catch (error) {
						console.error('❌ Failed to send continuous update to Unity:', error);
					}
				}
			}, 100); // Update Unity every 100ms during playing phase
		}
		
		return () => {
			if (unityUpdateInterval) {
				clearInterval(unityUpdateInterval);
			}
		};
	}, [GameState, myUnityContext, currentNum, flag]);

	return (
		<div className="crash-container">
			<div className="canvas">
				<Unity unityContext={myUnityContext} matchWebGLToCanvasSize={true} />
			</div>
			<div className="crash-text-container">
				{GameState === "BET" ? (
					<div className={`crashtext wait font-9`} >
						<div className="rotate">
							<img width={120} height={120} src="/images/propeller.png" alt="propeller"></img>
						</div>
						<div className="waiting-font">WAITING FOR NEXT ROUND</div>
						<div className="waiting">
							<div style={{ width: `${Math.min((5000 - waiting) * 100 / 5000, 100)}%` }}></div>
						</div>
					</div>
				) : (
					<div className={`crashtext ${GameState === "GAMEEND" && "red"}`}>
						{GameState === "GAMEEND" && <div className="flew-away">FLEW AWAY!</div>}
						<div className="multiplier-display">
							{(() => {
								const displayNum = target;
								const safeNum = isFinite(displayNum) && displayNum >= 1 ? displayNum : 1.00;
								const finalNum = Math.min(safeNum, 999.99);
								return finalNum.toFixed(2);
							})()} 
							<span className="multiplier-x">x</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

