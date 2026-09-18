import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Car, Coin, Cone, BoostPad, SkidMark, Particle, ControllerInput } from '../types';
import { soundFx } from '../utils/audio';
import { Volume2, VolumeX, RotateCcw, Palette, Trophy, Sparkles } from 'lucide-react';

interface GameCanvasProps {
  controllerInput: ControllerInput | null;
  onGameEvent?: (event: 'crash' | 'coin' | 'boost') => void;
  isControllerConnected: boolean;
}

const CAR_COLORS = [
  { name: '스칼렛 레드', body: '#ef4444', secondary: '#991b1b', light: '#fca5a5' },
  { name: '네온 사이언', body: '#06b6d4', secondary: '#0e7490', light: '#67e8f9' },
  { name: '일렉트릭 옐로우', body: '#eab308', secondary: '#a16207', light: '#fef08a' },
  { name: '레이싱 그린', body: '#10b981', secondary: '#047857', light: '#6ee7b7' },
  { name: '사이버 퍼플', body: '#a855f7', secondary: '#6b21a8', light: '#d8b4fe' },
];

export const GameCanvas: React.FC<GameCanvasProps> = ({
  controllerInput,
  onGameEvent,
  isControllerConnected,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Audio mute state
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [selectedColorIdx, setSelectedColorIdx] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [lapCount, setLapCount] = useState<number>(1);
  const [lapTime, setLapTime] = useState<number>(0);
  const [bestLap, setBestLap] = useState<number | null>(null);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [turboPercent, setTurboPercent] = useState<number>(100);
  const [hornActive, setHornActive] = useState<boolean>(false);

  // Keyboard inputs state for PC desktop fallback
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Game world references (avoid re-instantiating on every react render)
  const carRef = useRef<Car>({
    x: 400,
    y: 500,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2, // Facing North
    angularVelocity: 0,
    speed: 0,
    drift: 0,
    turboGauge: 100,
    isTurboActive: false,
    headlightsOn: true,
    color: CAR_COLORS[0].body,
    width: 32,
    height: 56,
  });

  const skidMarksRef = useRef<SkidMark[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const conesRef = useRef<Cone[]>([]);
  const boostPadsRef = useRef<BoostPad[]>([]);

  // Checkpoints for lap detection
  const checkpointsRef = useRef<{ x: number; y: number; radius: number; passed: boolean }[]>([]);
  const lastLapTimestampRef = useRef<number>(Date.now());
  const hornCooldownRef = useRef<number>(0);

  // Arena dimensions
  const arenaWidth = 1920;
  const arenaHeight = 1080;

  // Initialize Arena Entities
  const initWorld = useCallback(() => {
    // Collectible Coins along racing line
    const coins: Coin[] = [
      { id: 1, x: 400, y: 350, radius: 14, collected: false, angle: 0 },
      { id: 2, x: 400, y: 220, radius: 14, collected: false, angle: 0 },
      { id: 3, x: 550, y: 150, radius: 14, collected: false, angle: 0 },
      { id: 4, x: 750, y: 150, radius: 14, collected: false, angle: 0 },
      { id: 5, x: 950, y: 150, radius: 14, collected: false, angle: 0 },
      { id: 6, x: 1200, y: 180, radius: 14, collected: false, angle: 0 },
      { id: 7, x: 1450, y: 280, radius: 14, collected: false, angle: 0 },
      { id: 8, x: 1550, y: 450, radius: 14, collected: false, angle: 0 },
      { id: 9, x: 1550, y: 650, radius: 14, collected: false, angle: 0 },
      { id: 10, x: 1400, y: 820, radius: 14, collected: false, angle: 0 },
      { id: 11, x: 1150, y: 880, radius: 14, collected: false, angle: 0 },
      { id: 12, x: 900, y: 750, radius: 14, collected: false, angle: 0 },
      { id: 13, x: 700, y: 680, radius: 14, collected: false, angle: 0 },
      { id: 14, x: 500, y: 800, radius: 14, collected: false, angle: 0 },
      { id: 15, x: 400, y: 650, radius: 14, collected: false, angle: 0 },
      // Bonus coins in infield stunt area
      { id: 16, x: 960, y: 450, radius: 16, collected: false, angle: 0 },
      { id: 17, x: 960, y: 550, radius: 16, collected: false, angle: 0 },
      { id: 18, x: 1060, y: 500, radius: 16, collected: false, angle: 0 },
      { id: 19, x: 860, y: 500, radius: 16, collected: false, angle: 0 },
    ];
    coinsRef.current = coins;

    // Cones around corners and slalom zones
    const cones: Cone[] = [
      { id: 1, x: 340, y: 200, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      { id: 2, x: 340, y: 260, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      { id: 3, x: 1300, y: 120, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      { id: 4, x: 1380, y: 150, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      { id: 5, x: 1620, y: 380, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      { id: 6, x: 1620, y: 460, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      { id: 7, x: 1480, y: 880, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      { id: 8, x: 1380, y: 920, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      // Slalom cones in middle
      { id: 9, x: 800, y: 480, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      { id: 10, x: 880, y: 540, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      { id: 11, x: 1040, y: 480, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
      { id: 12, x: 1120, y: 540, vx: 0, vy: 0, rotation: 0, vRot: 0, radius: 12 },
    ];
    conesRef.current = cones;

    // Boost Pads
    boostPadsRef.current = [
      { id: 1, x: 400, y: 420, width: 60, height: 40, angle: -Math.PI / 2, force: 9 },
      { id: 2, x: 1050, y: 150, width: 60, height: 40, angle: 0, force: 9 },
      { id: 3, x: 1550, y: 550, width: 60, height: 40, angle: Math.PI / 2, force: 9 },
      { id: 4, x: 1250, y: 880, width: 60, height: 40, angle: Math.PI, force: 9 },
    ];

    // Checkpoints around the circuit
    checkpointsRef.current = [
      { x: 400, y: 180, radius: 160, passed: false },
      { x: 1100, y: 150, radius: 160, passed: false },
      { x: 1550, y: 550, radius: 160, passed: false },
      { x: 1100, y: 880, radius: 160, passed: false },
    ];
  }, []);

  // Keyboard Event Listeners for PC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      soundFx.startEngine();

      if (e.code === 'KeyH') {
        soundFx.playHorn();
        setHornActive(true);
        setTimeout(() => setHornActive(false), 300);
      }
      if (e.code === 'KeyL') {
        carRef.current.headlightsOn = !carRef.current.headlightsOn;
      }
      if (e.code === 'KeyR') {
        resetCarPosition();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Init world once
  useEffect(() => {
    initWorld();
  }, [initWorld]);

  // Handle color change
  const handleColorSelect = (idx: number) => {
    setSelectedColorIdx(idx);
    carRef.current.color = CAR_COLORS[idx].body;
  };

  // Reset car
  const resetCarPosition = () => {
    carRef.current.x = 400;
    carRef.current.y = 520;
    carRef.current.vx = 0;
    carRef.current.vy = 0;
    carRef.current.angle = -Math.PI / 2;
    carRef.current.angularVelocity = 0;
    carRef.current.speed = 0;
    carRef.current.drift = 0;
  };

  // Toggle audio mute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundFx.setMuted(nextMuted);
  };

  // Main Game Animation Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const gameLoop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Update Lap Timer
      const currentLapSec = ((Date.now() - lastLapTimestampRef.current) / 1000);
      setLapTime(Math.floor(currentLapSec * 10) / 10);

      // 1. Gather Inputs (Combines Mobile Controller + PC Keyboard)
      const keys = keysRef.current;
      let steer = 0;
      let throttle = 0;
      let isTurbo = false;
      let isHorn = false;
      let headlightsToggle = carRef.current.headlightsOn;

      // Check Mobile Controller input
      if (controllerInput) {
        steer = controllerInput.x;
        throttle = controllerInput.y;
        isTurbo = controllerInput.turbo;
        isHorn = controllerInput.horn;
        if (controllerInput.headlights !== undefined) {
          headlightsToggle = controllerInput.headlights;
        }
      }

      // Check Keyboard fallback input
      if (keys['KeyA'] || keys['ArrowLeft']) steer = -1;
      if (keys['KeyD'] || keys['ArrowRight']) steer = 1;
      if (keys['KeyW'] || keys['ArrowUp']) throttle = 1;
      if (keys['KeyS'] || keys['ArrowDown']) throttle = -1;
      if (keys['Space']) isTurbo = true;

      carRef.current.headlightsOn = headlightsToggle;

      // Mobile Horn handling
      if (isHorn && Date.now() - hornCooldownRef.current > 400) {
        hornCooldownRef.current = Date.now();
        soundFx.playHorn();
        setHornActive(true);
        setTimeout(() => setHornActive(false), 350);
      }

      // 2. Physics Update
      const car = carRef.current;
      const acceleration = 360; // px/s^2
      const reverseAcc = 180;
      const maxNormalSpeed = 440;
      const maxTurboSpeed = 660;
      const turnSpeed = 3.2; // rad/s
      const friction = 0.975;
      const lateralFriction = 0.88;

      // Turbo consumption & regeneration
      if (isTurbo && car.turboGauge > 5) {
        car.isTurboActive = true;
        car.turboGauge = Math.max(0, car.turboGauge - dt * 28);
        soundFx.playTurbo();
        onGameEvent?.('boost');
      } else {
        car.isTurboActive = false;
        car.turboGauge = Math.min(100, car.turboGauge + dt * 6);
      }
      setTurboPercent(Math.round(car.turboGauge));

      const maxSpeed = car.isTurboActive ? maxTurboSpeed : maxNormalSpeed;

      // Apply acceleration / brake
      if (throttle > 0) {
        const boostMultiplier = car.isTurboActive ? 1.6 : 1.0;
        car.speed += acceleration * throttle * boostMultiplier * dt;
      } else if (throttle < 0) {
        car.speed += reverseAcc * throttle * dt;
      } else {
        car.speed *= friction;
      }

      car.speed = Math.max(-160, Math.min(maxSpeed, car.speed));

      // Steering: car only turns if moving
      const speedFactor = Math.min(1, Math.abs(car.speed) / 100);
      if (speedFactor > 0.05) {
        const reverseSteer = car.speed < 0 ? -1 : 1;
        car.angle += steer * turnSpeed * speedFactor * reverseSteer * dt;
      }

      // Forward direction vector
      const forwardX = Math.cos(car.angle);
      const forwardY = Math.sin(car.angle);

      // Lateral vector (perpendicular to car heading)
      const rightX = -forwardY;
      const rightY = forwardX;

      // Target velocities
      const targetVx = forwardX * car.speed;
      const targetVy = forwardY * car.speed;

      // Drift calculation
      const currentLateralSpeed = car.vx * rightX + car.vy * rightY;
      car.drift = Math.abs(currentLateralSpeed) / 180;

      // Interpolate velocity towards target forward velocity with lateral slip
      car.vx = car.vx * lateralFriction + targetVx * (1 - lateralFriction);
      car.vy = car.vy * lateralFriction + targetVy * (1 - lateralFriction);

      // Move car
      car.x += car.vx * dt;
      car.y += car.vy * dt;

      // Update audio
      const speedRatio = Math.abs(car.speed) / maxNormalSpeed;
      soundFx.updateEnginePitch(speedRatio, car.isTurboActive);
      soundFx.playDrift(car.drift);

      setCurrentSpeedKmh(Math.round(Math.hypot(car.vx, car.vy) * 0.42));

      // 3. Skid Marks & Tire Smoke
      const isDrifting = car.drift > 0.25 && Math.abs(car.speed) > 150;
      const isBurnout = car.isTurboActive || (throttle > 0.8 && Math.abs(car.speed) < 100);

      if (isDrifting || isBurnout) {
        // Rear tire positions
        const rearDist = 20;
        const tireTrackWidth = 14;
        const rx1 = car.x - forwardX * rearDist + rightX * tireTrackWidth;
        const ry1 = car.y - forwardY * rearDist + rightY * tireTrackWidth;
        const rx2 = car.x - forwardX * rearDist - rightX * tireTrackWidth;
        const ry2 = car.y - forwardY * rearDist - rightY * tireTrackWidth;

        skidMarksRef.current.push(
          { x1: rx1, y1: ry1, x2: rx1 - car.vx * dt, y2: ry1 - car.vy * dt, alpha: 0.35, width: 4 },
          { x1: rx2, y1: ry2, x2: rx2 - car.vx * dt, y2: ry2 - car.vy * dt, alpha: 0.35, width: 4 }
        );

        // Emit smoke particles
        particlesRef.current.push({
          x: rx1 + (Math.random() - 0.5) * 6,
          y: ry1 + (Math.random() - 0.5) * 6,
          vx: -car.vx * 0.2 + (Math.random() - 0.5) * 20,
          vy: -car.vy * 0.2 + (Math.random() - 0.5) * 20,
          life: 0.6,
          maxLife: 0.6,
          color: 'rgba(220, 220, 220, 0.4)',
          size: Math.random() * 8 + 6,
        });
      }

      // Turbo exhaust fire particles
      if (car.isTurboActive) {
        const exhaustDist = 26;
        particlesRef.current.push({
          x: car.x - forwardX * exhaustDist + (Math.random() - 0.5) * 6,
          y: car.y - forwardY * exhaustDist + (Math.random() - 0.5) * 6,
          vx: -forwardX * 300 + (Math.random() - 0.5) * 40,
          vy: -forwardY * 300 + (Math.random() - 0.5) * 40,
          life: 0.25,
          maxLife: 0.25,
          color: Math.random() > 0.4 ? '#38bdf8' : '#67e8f9',
          size: Math.random() * 6 + 4,
        });
      }

      // Update particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.size += dt * 8;
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
        }
      }

      // Keep max 250 skid marks to optimize canvas performance
      if (skidMarksRef.current.length > 250) {
        skidMarksRef.current.splice(0, skidMarksRef.current.length - 250);
      }

      // 4. Track Boundary Collisions (Outer & Infield Barrier Walls)
      const trackPadding = 40;
      let collided = false;

      if (car.x < trackPadding) {
        car.x = trackPadding;
        car.vx = -car.vx * 0.5;
        car.speed = -car.speed * 0.4;
        collided = true;
      } else if (car.x > arenaWidth - trackPadding) {
        car.x = arenaWidth - trackPadding;
        car.vx = -car.vx * 0.5;
        car.speed = -car.speed * 0.4;
        collided = true;
      }

      if (car.y < trackPadding) {
        car.y = trackPadding;
        car.vy = -car.vy * 0.5;
        car.speed = -car.speed * 0.4;
        collided = true;
      } else if (car.y > arenaHeight - trackPadding) {
        car.y = arenaHeight - trackPadding;
        car.vy = -car.vy * 0.5;
        car.speed = -car.speed * 0.4;
        collided = true;
      }

      if (collided) {
        soundFx.playCrash(1.2);
        onGameEvent?.('crash');
        // Spark particles
        for (let k = 0; k < 10; k++) {
          particlesRef.current.push({
            x: car.x,
            y: car.y,
            vx: (Math.random() - 0.5) * 300,
            vy: (Math.random() - 0.5) * 300,
            life: 0.3,
            maxLife: 0.3,
            color: '#f59e0b',
            size: 3,
          });
        }
      }

      // 5. Boost Pads Interaction
      for (const pad of boostPadsRef.current) {
        const dx = car.x - pad.x;
        const dy = car.y - pad.y;
        if (Math.abs(dx) < pad.width / 2 + 10 && Math.abs(dy) < pad.height / 2 + 10) {
          car.speed = maxTurboSpeed;
          car.turboGauge = Math.min(100, car.turboGauge + 25);
          soundFx.playTurbo();
          onGameEvent?.('boost');
        }
      }

      // 6. Coins Pickup Interaction
      for (const coin of coinsRef.current) {
        if (!coin.collected) {
          coin.angle += dt * 3;
          const dist = Math.hypot(car.x - coin.x, car.y - coin.y);
          if (dist < coin.radius + 20) {
            coin.collected = true;
            soundFx.playCoin();
            onGameEvent?.('coin');
            setScore((s) => s + 100);
            car.turboGauge = Math.min(100, car.turboGauge + 20);

            // Coin spark particles
            for (let k = 0; k < 12; k++) {
              particlesRef.current.push({
                x: coin.x,
                y: coin.y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                life: 0.4,
                maxLife: 0.4,
                color: '#fbbf24',
                size: 4,
              });
            }

            // Respawn coin after 8 seconds
            setTimeout(() => {
              coin.collected = false;
            }, 8000);
          }
        }
      }

      // 7. Cone Physics
      for (const cone of conesRef.current) {
        // Friction on cones
        cone.vx *= 0.94;
        cone.vy *= 0.94;
        cone.vRot *= 0.94;
        cone.x += cone.vx * dt;
        cone.y += cone.vy * dt;
        cone.rotation += cone.vRot * dt;

        // Collision with car
        const dist = Math.hypot(car.x - cone.x, car.y - cone.y);
        if (dist < cone.radius + 22) {
          const pushAngle = Math.atan2(cone.y - car.y, cone.x - car.x);
          const impact = Math.max(120, Math.abs(car.speed) * 0.9);
          cone.vx = Math.cos(pushAngle) * impact;
          cone.vy = Math.sin(pushAngle) * impact;
          cone.vRot = (Math.random() - 0.5) * 12;
          soundFx.playCrash(0.4);
          onGameEvent?.('crash');
        }
      }

      // 8. Checkpoint & Lap System
      const currentCheckpoint = checkpointsRef.current.find((cp) => !cp.passed);
      if (currentCheckpoint) {
        const d = Math.hypot(car.x - currentCheckpoint.x, car.y - currentCheckpoint.y);
        if (d < currentCheckpoint.radius) {
          currentCheckpoint.passed = true;
        }
      } else {
        // Check if crossed finish line (x around 400, y around 500)
        const finishDist = Math.hypot(car.x - 400, car.y - 500);
        if (finishDist < 60) {
          // All checkpoints completed, lap finished!
          const lapDuration = (Date.now() - lastLapTimestampRef.current) / 1000;
          if (lapDuration > 4) { // Guard against instant re-trigger
            setLapCount((l) => l + 1);
            setBestLap((b) => (b === null ? lapDuration : Math.min(b, lapDuration)));
            lastLapTimestampRef.current = Date.now();
            checkpointsRef.current.forEach((cp) => (cp.passed = false));
            soundFx.playCoin();
          }
        }
      }

      // -------------------------------------------------------------
      // 9. RENDERING PASSES
      // -------------------------------------------------------------
      ctx.clearRect(0, 0, arenaWidth, arenaHeight);

      // Camera view setup: smooth camera tracking car with slight look-ahead
      const scaleX = canvas.width / arenaWidth;
      const scaleY = canvas.height / arenaHeight;

      ctx.save();
      ctx.scale(scaleX, scaleY);

      // Background grass / stadium ground
      ctx.fillStyle = '#141e17';
      ctx.fillRect(0, 0, arenaWidth, arenaHeight);

      // Draw Infield Grass Pattern
      ctx.strokeStyle = '#18241b';
      ctx.lineWidth = 1;
      for (let x = 0; x < arenaWidth; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, arenaHeight);
        ctx.stroke();
      }

      // Draw Main Asphalt Racing Circuit
      ctx.beginPath();
      ctx.lineWidth = 140;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#23262d';

      // Circuit path
      ctx.moveTo(400, 500);
      ctx.lineTo(400, 220);
      ctx.bezierCurveTo(400, 140, 500, 140, 600, 140);
      ctx.lineTo(1200, 140);
      ctx.bezierCurveTo(1550, 140, 1600, 300, 1600, 500);
      ctx.bezierCurveTo(1600, 750, 1500, 900, 1300, 900);
      ctx.lineTo(1100, 900);
      ctx.bezierCurveTo(950, 900, 900, 750, 800, 720);
      ctx.lineTo(600, 720);
      ctx.bezierCurveTo(400, 720, 400, 650, 400, 500);
      ctx.stroke();

      // Infield Center Stunt Arena Pad
      ctx.fillStyle = '#1e2129';
      ctx.beginPath();
      ctx.roundRect(760, 380, 400, 240, 30);
      ctx.fill();
      ctx.strokeStyle = '#333a46';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Curbs (Red & White Racing Strips along asphalt borders)
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 8;
      ctx.setLineDash([20, 20]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Finish / Start Line (Checkered pattern at x=400, y=500)
      ctx.save();
      ctx.translate(400, 500);
      for (let row = -60; row <= 60; row += 12) {
        ctx.fillStyle = ((row / 12) % 2 === 0) ? '#ffffff' : '#111827';
        ctx.fillRect(-15, row, 15, 12);
        ctx.fillStyle = ((row / 12) % 2 === 0) ? '#111827' : '#ffffff';
        ctx.fillRect(0, row, 15, 12);
      }
      ctx.restore();

      // Draw Boost Pads
      for (const pad of boostPadsRef.current) {
        ctx.save();
        ctx.translate(pad.x, pad.y);
        ctx.rotate(pad.angle);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-pad.width / 2, -pad.height / 2, pad.width, pad.height);
        // Glowing animated arrows
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-15, 8);
        ctx.lineTo(0, -10);
        ctx.lineTo(15, 8);
        ctx.moveTo(-15, -2);
        ctx.lineTo(0, -20);
        ctx.lineTo(15, -2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Skid Marks
      ctx.lineWidth = 4;
      for (const sm of skidMarksRef.current) {
        ctx.strokeStyle = `rgba(15, 15, 15, ${sm.alpha})`;
        ctx.beginPath();
        ctx.moveTo(sm.x1, sm.y1);
        ctx.lineTo(sm.x2, sm.y2);
        ctx.stroke();
      }

      // Draw Collectible Coins (Spinning Golden Stars)
      for (const coin of coinsRef.current) {
        if (coin.collected) continue;
        ctx.save();
        ctx.translate(coin.x, coin.y);
        ctx.rotate(coin.angle);

        // Outer glow
        const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, coin.radius + 8);
        glow.addColorStop(0, 'rgba(251, 191, 36, 0.9)');
        glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, coin.radius + 8, 0, Math.PI * 2);
        ctx.fill();

        // Star Shape
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const spikes = 5;
        const outerRadius = coin.radius;
        const innerRadius = coin.radius * 0.5;
        let rot = Math.PI / 2 * 3;
        const step = Math.PI / spikes;

        ctx.moveTo(0, -outerRadius);
        for (let i = 0; i < spikes; i++) {
          ctx.lineTo(Math.cos(rot) * outerRadius, Math.sin(rot) * outerRadius);
          rot += step;
          ctx.lineTo(Math.cos(rot) * innerRadius, Math.sin(rot) * innerRadius);
          rot += step;
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      // Draw Traffic Cones
      for (const cone of conesRef.current) {
        ctx.save();
        ctx.translate(cone.x, cone.y);
        ctx.rotate(cone.rotation);
        // Base
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(0, 0, cone.radius, 0, Math.PI * 2);
        ctx.fill();
        // White reflective band
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, cone.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
        // Top tip
        ctx.fillStyle = '#c2410c';
        ctx.beginPath();
        ctx.arc(0, 0, cone.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Particles (Smoke & Sparks)
      for (const p of particlesRef.current) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Headlights Beam Projection (if headlights are on)
      if (car.headlightsOn) {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);

        // Left and right headlight cones
        for (const offset of [-10, 10]) {
          const grad = ctx.createRadialGradient(25, offset, 5, 140, offset, 180);
          grad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
          grad.addColorStop(0.4, 'rgba(254, 240, 138, 0.15)');
          grad.addColorStop(1, 'rgba(254, 240, 138, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(25, offset);
          ctx.arc(25, offset, 190, -0.35, 0.35);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // -------------------------------------------------------------
      // DRAW CAR
      // -------------------------------------------------------------
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      // Car Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.roundRect(-22, -14, 52, 28, 6);
      ctx.fill();

      // Steered Front Wheels
      const maxSteerAngle = 0.5; // ~28 degrees
      const steerVisualAngle = steer * maxSteerAngle;

      ctx.fillStyle = '#171717';
      // Front-left wheel
      ctx.save();
      ctx.translate(16, -14);
      ctx.rotate(steerVisualAngle);
      ctx.fillRect(-7, -3, 14, 6);
      ctx.restore();

      // Front-right wheel
      ctx.save();
      ctx.translate(16, 14);
      ctx.rotate(steerVisualAngle);
      ctx.fillRect(-7, -3, 14, 6);
      ctx.restore();

      // Rear wheels (fixed)
      ctx.fillRect(-22, -16, 14, 6);
      ctx.fillRect(-22, 10, 14, 6);

      // Car Main Body Chassis
      const activeColor = CAR_COLORS[selectedColorIdx];
      ctx.fillStyle = activeColor.body;
      ctx.beginPath();
      ctx.roundRect(-24, -13, 50, 26, 8);
      ctx.fill();

      // Racing Stripes
      ctx.fillStyle = activeColor.light;
      ctx.fillRect(-24, -3, 50, 6);

      // Cockpit / Windshield Glass
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-8, -9, 20, 18, 4);
      ctx.fill();

      // Roof
      ctx.fillStyle = activeColor.secondary;
      ctx.beginPath();
      ctx.roundRect(-6, -7, 14, 14, 3);
      ctx.fill();

      // Headlight bulbs (front)
      ctx.fillStyle = car.headlightsOn ? '#fef08a' : '#525252';
      ctx.fillRect(23, -11, 3, 5);
      ctx.fillRect(23, 6, 3, 5);

      // Taillights (rear)
      const isBraking = throttle < 0 || keys['KeyS'] || keys['ArrowDown'];
      ctx.fillStyle = isBraking ? '#ef4444' : '#7f1d1d';
      ctx.shadowColor = isBraking ? '#ef4444' : 'transparent';
      ctx.shadowBlur = isBraking ? 10 : 0;
      ctx.fillRect(-25, -11, 2, 6);
      ctx.fillRect(-25, 5, 2, 6);
      ctx.shadowBlur = 0;

      // Rear Spoiler
      ctx.fillStyle = '#171717';
      ctx.fillRect(-26, -14, 4, 28);

      // Horn Speech Bubble Effect if active
      if (hornActive) {
        ctx.save();
        ctx.rotate(-car.angle);
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-30, -50, 60, 24, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BEEP!! 📢', 0, -34);
        ctx.restore();
      }

      ctx.restore(); // Restore car transform

      // Stadium Outer Border Railings
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 16;
      ctx.strokeRect(8, 8, arenaWidth - 16, arenaHeight - 16);

      ctx.restore(); // Restore world scale

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [controllerInput, selectedColorIdx, onGameEvent, hornActive]);

  // Responsive Canvas Resize Observer
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div id="game-canvas-container" ref={containerRef} className="relative w-full h-full overflow-hidden bg-neutral-950">
      <canvas id="race-canvas" ref={canvasRef} className="w-full h-full block cursor-crosshair" />

      {/* Top HUD Bar */}
      <div id="game-hud-top" className="absolute top-4 right-4 z-20 flex items-center gap-3">
        {/* Color Switcher */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-neutral-900/90 backdrop-blur-md border border-neutral-800 shadow-lg">
          <Palette className="w-3.5 h-3.5 text-neutral-400 ml-1 mr-0.5" />
          {CAR_COLORS.map((c, idx) => (
            <button
              key={c.name}
              id={`color-picker-${idx}`}
              onClick={() => handleColorSelect(idx)}
              className={`w-6 h-6 rounded-full transition-transform border-2 ${
                selectedColorIdx === idx ? 'scale-110 border-white shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'border-transparent opacity-75 hover:opacity-100'
              }`}
              style={{ backgroundColor: c.body }}
              title={c.name}
            />
          ))}
        </div>

        {/* Audio Mute Button */}
        <button
          id="btn-sound-toggle"
          onClick={toggleMute}
          className={`p-2.5 rounded-2xl border transition-all ${
            isMuted
              ? 'bg-neutral-900/80 border-neutral-700 text-neutral-500'
              : 'bg-neutral-900/90 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
          }`}
          title={isMuted ? '음소거 해제' : '음소거'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Reset Car Position Button */}
        <button
          id="btn-reset-car"
          onClick={resetCarPosition}
          className="p-2.5 rounded-2xl bg-neutral-900/90 border border-neutral-700 text-neutral-300 hover:text-white transition-colors"
          title="자동차 위치 초기화 (R 키)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Racing Cockpit Dashboard (Speedometer & Turbo & Lap) */}
      <div
        id="racing-cockpit-hud"
        className="absolute bottom-6 right-6 z-20 flex items-end gap-4 pointer-events-none"
      >
        {/* Lap & Score Stats Card */}
        <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-2 min-w-[140px]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 flex items-center gap-1 font-medium">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              LAP
            </span>
            <span className="font-bold text-white font-mono text-sm">{lapCount}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 font-medium">현재 랩</span>
            <span className="font-bold text-cyan-400 font-mono text-xs">{lapTime.toFixed(1)}s</span>
          </div>

          {bestLap && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-400 font-medium">최고 랩</span>
              <span className="font-bold text-amber-300 font-mono text-xs">{bestLap.toFixed(1)}s</span>
            </div>
          )}

          <div className="pt-1.5 border-t border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              점수
            </span>
            <span className="font-bold text-yellow-400 font-mono text-sm">{score}</span>
          </div>
        </div>

        {/* Speedometer Gauge Widget */}
        <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-2xl p-4 shadow-2xl flex flex-col items-center min-w-[170px]">
          {/* Digital km/h Display */}
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-black font-teko tracking-tight text-white leading-none">
              {currentSpeedKmh}
            </span>
            <span className="text-xs font-bold text-neutral-400">KM/H</span>
          </div>

          {/* Speed meter bar */}
          <div className="w-full bg-neutral-800 h-2 rounded-full mt-2 overflow-hidden border border-neutral-700">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                currentSpeedKmh > 160
                  ? 'bg-gradient-to-r from-cyan-400 to-red-500'
                  : 'bg-gradient-to-r from-emerald-400 to-cyan-400'
              }`}
              style={{ width: `${Math.min(100, (currentSpeedKmh / 220) * 100)}%` }}
            />
          </div>

          {/* Turbo / Nitro Gauge Bar */}
          <div className="w-full mt-3 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-wider">
              <span className="text-cyan-400">NITRO TURBO</span>
              <span className="text-neutral-300">{turboPercent}%</span>
            </div>
            <div className="w-full bg-neutral-800 h-2.5 rounded-full overflow-hidden border border-cyan-900/40">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-100 rounded-full"
                style={{ width: `${turboPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
