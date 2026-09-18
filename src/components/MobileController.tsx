import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameSocketClient } from '../utils/socket';
import { ControllerInput, SocketMessage } from '../types';
import { Zap, Volume2, Lightbulb, Maximize, RotateCcw, Wifi, WifiOff } from 'lucide-react';

interface MobileControllerProps {
  roomId: string;
}

export const MobileController: React.FC<MobileControllerProps> = ({ roomId }) => {
  const [connected, setConnected] = useState<boolean>(false);
  const [latency, setLatency] = useState<number>(0);
  const [fullscreen, setFullscreen] = useState<boolean>(false);

  // Controller states
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isGasPressed, setIsGasPressed] = useState<boolean>(false);
  const [isBrakePressed, setIsBrakePressed] = useState<boolean>(false);
  const [isTurboPressed, setIsTurboPressed] = useState<boolean>(false);
  const [isHornPressed, setIsHornPressed] = useState<boolean>(false);
  const [headlights, setHeadlights] = useState<boolean>(true);
  const [lastFeedback, setLastFeedback] = useState<string>('');

  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const socketRef = useRef<GameSocketClient | null>(null);

  // Latest input values ref for loop transmission
  const inputRef = useRef<ControllerInput>({
    x: 0,
    y: 0,
    gas: false,
    brake: false,
    turbo: false,
    horn: false,
    headlights: true,
    timestamp: Date.now(),
  });

  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }, []);

  // Update input ref
  useEffect(() => {
    // If gas is pressed and joystick y is 0, let gas drive forward (y = 1)
    let effY = joystickPos.y;
    if (isGasPressed) effY = 1;
    else if (isBrakePressed) effY = -1;

    inputRef.current = {
      x: joystickPos.x,
      y: effY,
      gas: isGasPressed,
      brake: isBrakePressed,
      turbo: isTurboPressed,
      horn: isHornPressed,
      headlights,
      timestamp: Date.now(),
    };
  }, [joystickPos, isGasPressed, isBrakePressed, isTurboPressed, isHornPressed, headlights]);

  // Handle server incoming messages (e.g. haptic feedback on crash or coin)
  const handleMessage = useCallback((msg: SocketMessage) => {
    if (msg.type === 'haptic' || msg.type === 'game_event') {
      const eventType = msg.payload?.event;
      if (eventType === 'crash') {
        triggerHaptic([60, 40, 80]);
        setLastFeedback('💥 충돌!');
      } else if (eventType === 'coin') {
        triggerHaptic(25);
        setLastFeedback('⭐ 코인 획득!');
      } else if (eventType === 'boost') {
        triggerHaptic([30, 20, 40]);
        setLastFeedback('🚀 부스터 발동!');
      }
      setTimeout(() => setLastFeedback(''), 1000);
    }
  }, [triggerHaptic]);

  // Setup WebSocket connection
  useEffect(() => {
    const client = new GameSocketClient(
      roomId,
      'controller',
      handleMessage,
      (isConnected) => {
        setConnected(isConnected);
      }
    );
    socketRef.current = client;

    // Send input loop ~40-60 times per second
    const interval = setInterval(() => {
      if (socketRef.current) {
        socketRef.current.sendInput(inputRef.current);
        setLatency(socketRef.current.latency);
      }
    }, 25);

    return () => {
      clearInterval(interval);
      client.destroy();
    };
  }, [roomId, handleMessage]);

  // Touch handlers for joystick
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    updateJoystick(touch.clientX, touch.clientY);
    triggerHaptic(15);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setJoystickPos({ x: 0, y: 0 });
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxRadius = rect.width / 2 - 10;

    const distance = Math.hypot(dx, dy);
    const clampedDistance = Math.min(distance, maxRadius);
    const angle = Math.atan2(dy, dx);

    const normX = clampedDistance > 0 ? (clampedDistance / maxRadius) * Math.cos(angle) : 0;
    // Invert Y so up is positive (throttle) and down is negative (reverse)
    const normY = clampedDistance > 0 ? -(clampedDistance / maxRadius) * Math.sin(angle) : 0;

    // Apply slight deadzone (0.05)
    const deadzone = 0.05;
    const finalX = Math.abs(normX) < deadzone ? 0 : normX;
    const finalY = Math.abs(normY) < deadzone ? 0 : normY;

    setJoystickPos({
      x: Math.max(-1, Math.min(1, finalX)),
      y: Math.max(-1, Math.min(1, finalY)),
    });
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  return (
    <div
      id="mobile-controller-root"
      className="fixed inset-0 w-screen h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 text-white flex flex-col justify-between select-none overflow-hidden touch-none p-3 sm:p-5"
    >
      {/* Top Status Bar */}
      <header id="controller-header" className="flex items-center justify-between z-20 pb-2 border-b border-neutral-800/80">
        <div className="flex items-center gap-2.5">
          <div
            id="controller-status-indicator"
            className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 animate-pulse'}`}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wider font-semibold text-neutral-300">
                {connected ? '연결됨 (ACTIVE)' : '호스트 연결 대기'}
              </span>
              {connected ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">
              ROOM: <strong className="text-amber-400 tracking-widest">{roomId}</strong>
              {latency > 0 && ` • ${latency}ms`}
            </span>
          </div>
        </div>

        {/* Dynamic event pill */}
        {lastFeedback && (
          <div
            id="feedback-toast"
            className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-bounce"
          >
            {lastFeedback}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Headlights toggle */}
          <button
            id="btn-headlights"
            onClick={() => {
              setHeadlights(!headlights);
              triggerHaptic(15);
            }}
            className={`p-2 rounded-xl border transition-all ${
              headlights
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                : 'bg-neutral-800/70 border-neutral-700 text-neutral-400'
            }`}
            title="전조등"
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            id="btn-fullscreen"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-neutral-800/70 border border-neutral-700 text-neutral-300 active:scale-95"
            title="전체화면"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Touch Area (Landscape/Portrait Dual Cluster) */}
      <main id="controller-controls-zone" className="flex-1 flex flex-row items-center justify-between gap-4 py-3 relative">
        {/* Left Side: Virtual Analog Joystick */}
        <div id="joystick-container" className="flex-1 flex flex-col items-center justify-center">
          <div className="text-xs text-neutral-400 mb-2 font-medium tracking-wider flex items-center gap-1">
            <span>스티어링 / 방향 조이스틱</span>
          </div>

          <div
            id="joystick-base"
            ref={joystickBaseRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className="w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-b from-neutral-800/90 to-neutral-900/90 border-2 border-neutral-700/80 shadow-[inset_0_4px_12px_rgba(0,0,0,0.6),0_8px_20px_rgba(0,0,0,0.4)] relative flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
          >
            {/* Guide Grid Crosshairs */}
            <div className="absolute inset-x-4 top-1/2 h-[1px] bg-neutral-700/50 pointer-events-none" />
            <div className="absolute inset-y-4 left-1/2 w-[1px] bg-neutral-700/50 pointer-events-none" />
            
            {/* Compass labels */}
            <span className="absolute top-2 text-[10px] font-bold text-neutral-500">전진</span>
            <span className="absolute bottom-2 text-[10px] font-bold text-neutral-500">후진</span>
            <span className="absolute left-2 text-[10px] font-bold text-neutral-500">좌</span>
            <span className="absolute right-2 text-[10px] font-bold text-neutral-500">우</span>

            {/* Inner Ring */}
            <div className="w-24 h-24 rounded-full border border-dashed border-neutral-600/40 pointer-events-none" />

            {/* Dynamic Joystick Thumb Stick */}
            <div
              id="joystick-knob"
              className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-b from-neutral-700 to-neutral-900 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] flex items-center justify-center transition-transform duration-75 pointer-events-none"
              style={{
                transform: `translate(${joystickPos.x * 65}px, ${-joystickPos.y * 65}px)`,
              }}
            >
              <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/60 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-red-500" />
              </div>
            </div>
          </div>

          <div className="mt-2 text-[11px] font-mono text-neutral-400">
            X: {joystickPos.x.toFixed(2)} | Y: {joystickPos.y.toFixed(2)}
          </div>
        </div>

        {/* Center Utility Buttons (Horn & Reset) */}
        <div id="center-actions" className="flex flex-col items-center justify-center gap-3">
          {/* Turbo / Boost Button */}
          <button
            id="btn-turbo"
            onTouchStart={(e) => {
              e.preventDefault();
              setIsTurboPressed(true);
              triggerHaptic([30, 20]);
            }}
            onTouchEnd={() => setIsTurboPressed(false)}
            onMouseDown={() => setIsTurboPressed(true)}
            onMouseUp={() => setIsTurboPressed(false)}
            className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-all active:scale-90 ${
              isTurboPressed
                ? 'bg-cyan-500 border-white text-black shadow-[0_0_25px_#06b6d4]'
                : 'bg-neutral-800/90 border-cyan-500/60 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
            }`}
          >
            <Zap className={`w-6 h-6 ${isTurboPressed ? 'fill-black' : 'fill-cyan-400'}`} />
            <span className="text-[10px] font-black uppercase tracking-wider">터보</span>
          </button>

          {/* Car Horn Button */}
          <button
            id="btn-horn"
            onTouchStart={(e) => {
              e.preventDefault();
              setIsHornPressed(true);
              triggerHaptic(20);
            }}
            onTouchEnd={() => setIsHornPressed(false)}
            onMouseDown={() => setIsHornPressed(true)}
            onMouseUp={() => setIsHornPressed(false)}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all active:scale-90 ${
              isHornPressed
                ? 'bg-amber-500 border-white text-black shadow-[0_0_15px_#f59e0b]'
                : 'bg-neutral-800/70 border-amber-500/40 text-amber-400'
            }`}
          >
            <Volume2 className="w-5 h-5" />
            <span className="text-[9px] font-bold">경적</span>
          </button>
        </div>

        {/* Right Side: Driving Pedals (Gas & Brake) */}
        <div id="pedals-container" className="flex-1 flex flex-row items-end justify-center gap-3 sm:gap-4 h-full pb-2">
          {/* Brake / Reverse Pedal */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              id="pedal-brake"
              onTouchStart={(e) => {
                e.preventDefault();
                setIsBrakePressed(true);
                triggerHaptic(15);
              }}
              onTouchEnd={() => setIsBrakePressed(false)}
              onMouseDown={() => setIsBrakePressed(true)}
              onMouseUp={() => setIsBrakePressed(false)}
              className={`w-20 sm:w-24 h-36 sm:h-40 rounded-2xl border-2 flex flex-col items-center justify-between p-3 transition-transform active:scale-95 ${
                isBrakePressed
                  ? 'bg-red-600 border-white text-white shadow-[0_0_25px_rgba(239,68,68,0.7)] translate-y-1'
                  : 'bg-gradient-to-b from-neutral-800 to-neutral-900 border-red-500/60 text-red-400'
              }`}
            >
              {/* Textured pedal ribs */}
              <div className="w-full flex flex-col gap-2 opacity-60">
                <div className="h-1 bg-current rounded-full" />
                <div className="h-1 bg-current rounded-full" />
                <div className="h-1 bg-current rounded-full" />
              </div>
              <div className="text-center font-black tracking-wider text-xs">
                BRAKE
                <div className="text-[10px] font-normal opacity-80">브레이크 / 후진</div>
              </div>
            </button>
          </div>

          {/* Gas / Accelerate Pedal */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              id="pedal-gas"
              onTouchStart={(e) => {
                e.preventDefault();
                setIsGasPressed(true);
                triggerHaptic(20);
              }}
              onTouchEnd={() => setIsGasPressed(false)}
              onMouseDown={() => setIsGasPressed(true)}
              onMouseUp={() => setIsGasPressed(false)}
              className={`w-24 sm:w-28 h-44 sm:h-48 rounded-2xl border-2 flex flex-col items-center justify-between p-3 transition-transform active:scale-95 ${
                isGasPressed
                  ? 'bg-emerald-500 border-white text-black shadow-[0_0_30px_rgba(16,185,129,0.8)] translate-y-1'
                  : 'bg-gradient-to-b from-neutral-800 to-neutral-900 border-emerald-500/70 text-emerald-400'
              }`}
            >
              {/* Textured pedal ribs */}
              <div className="w-full flex flex-col gap-2.5 opacity-60">
                <div className="h-1 bg-current rounded-full" />
                <div className="h-1 bg-current rounded-full" />
                <div className="h-1 bg-current rounded-full" />
                <div className="h-1 bg-current rounded-full" />
              </div>
              <div className="text-center font-black tracking-wider text-sm">
                GAS
                <div className="text-[10px] font-normal opacity-80">액셀러레이터</div>
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer id="controller-footer" className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-neutral-800/80">
        <span>스마트폰 가상 게임패드 컨트롤러</span>
        <span>화면을 가로(Landscape)로 돌리시면 더욱 편리합니다</span>
      </footer>
    </div>
  );
};
