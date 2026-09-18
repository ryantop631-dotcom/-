import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { MobileController } from './components/MobileController';
import { QRCodeModal } from './components/QRCodeModal';
import { GameSocketClient } from './utils/socket';
import { ControllerInput, SocketMessage } from './types';

function generateRandomRoomId(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let result = '';
  for (let i = 0; i < 3; i++) result += letters.charAt(Math.floor(Math.random() * letters.length));
  result += '-';
  for (let i = 0; i < 3; i++) result += digits.charAt(Math.floor(Math.random() * digits.length));
  return result;
}

export default function App() {
  const [mode, setMode] = useState<'game' | 'controller'>('game');
  const [roomId, setRoomId] = useState<string>('');
  const [controllerInput, setControllerInput] = useState<ControllerInput | null>(null);
  const [isControllerConnected, setIsControllerConnected] = useState<boolean>(false);
  const [isQRMinimized, setIsQRMinimized] = useState<boolean>(false);

  const socketClientRef = useRef<GameSocketClient | null>(null);

  // Initialize Mode and Room ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const roomParam = params.get('room');

    if (modeParam === 'controller' && roomParam) {
      setMode('controller');
      setRoomId(roomParam);
    } else {
      setMode('game');
      const targetRoom = roomParam || generateRandomRoomId();
      setRoomId(targetRoom);

      // Update URL search params gracefully without reloading
      if (!roomParam) {
        const newUrl = `${window.location.pathname}?room=${targetRoom}`;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  // Handle messages received by Game Host
  const handleHostMessage = useCallback((msg: SocketMessage) => {
    if (msg.type === 'controller_connected') {
      setIsControllerConnected(true);
    } else if (msg.type === 'controller_disconnected') {
      setIsControllerConnected(false);
    } else if (msg.type === 'input') {
      setIsControllerConnected(true);
      if (msg.payload) {
        setControllerInput(msg.payload);
      }
    }
  }, []);

  // Setup Host WebSocket Connection
  useEffect(() => {
    if (mode !== 'game' || !roomId) return;

    const client = new GameSocketClient(
      roomId,
      'host',
      handleHostMessage,
      (isConnected) => {
        // host connected to server
      }
    );
    socketClientRef.current = client;

    // HTTP polling fallback every 100ms in case WS proxy is latent
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room/${roomId}/poll`);
        if (res.ok) {
          const data = await res.json();
          if (data.connected && data.input) {
            setIsControllerConnected(true);
            setControllerInput(data.input);
          }
        }
      } catch (e) {}
    }, 120);

    return () => {
      clearInterval(pollInterval);
      client.destroy();
    };
  }, [mode, roomId, handleHostMessage]);

  // Dispatch game event (e.g. crash, coin, boost) to controller for haptic feedback
  const handleGameEvent = useCallback((eventType: 'crash' | 'coin' | 'boost') => {
    if (socketClientRef.current && isControllerConnected) {
      socketClientRef.current.send({
        type: 'game_event',
        roomId,
        payload: { event: eventType },
      });
    }
  }, [roomId, isControllerConnected]);

  // Render Mobile Controller View
  if (mode === 'controller') {
    return <MobileController roomId={roomId} />;
  }

  // Render Host Game Screen with QR Modal & Canvas
  return (
    <div id="game-app-root" className="relative w-screen h-screen overflow-hidden bg-neutral-950 select-none">
      {/* 2D Canvas Racing Simulator */}
      <GameCanvas
        controllerInput={controllerInput}
        onGameEvent={handleGameEvent}
        isControllerConnected={isControllerConnected}
      />

      {/* Floating QR Code Scanner Modal */}
      {roomId && (
        <QRCodeModal
          roomId={roomId}
          isControllerConnected={isControllerConnected}
          isMinimized={isQRMinimized}
          onToggleMinimize={() => setIsQRMinimized(!isQRMinimized)}
        />
      )}
    </div>
  );
}
