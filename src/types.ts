export interface ControllerInput {
  x: number;          // Steering: -1 (full left) to 1 (full right)
  y: number;          // Throttle / Reverse: -1 (reverse) to 1 (forward)
  gas: boolean;       // Gas pedal pressed
  brake: boolean;     // Brake pedal pressed
  turbo: boolean;     // Turbo / Nitro pressed
  horn: boolean;      // Car horn pressed
  headlights: boolean;// Headlights toggle
  timestamp: number;
}

export type SocketMessageType =
  | 'register_host'
  | 'join_controller'
  | 'host_ready'
  | 'controller_connected'
  | 'controller_disconnected'
  | 'input'
  | 'haptic'
  | 'game_event'
  | 'ping'
  | 'pong';

export interface SocketMessage {
  type: SocketMessageType;
  roomId: string;
  role?: 'host' | 'controller';
  payload?: any;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface SkidMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
  width: number;
}

export interface Coin {
  id: number;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  angle: number;
}

export interface Cone {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  radius: number;
}

export interface BoostPad {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // direction of boost
  force: number;
}

export interface Car {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;       // Facing angle in radians
  angularVelocity: number;
  speed: number;       // Forward speed
  drift: number;       // Lateral drift factor
  turboGauge: number;  // 0 to 100
  isTurboActive: boolean;
  headlightsOn: boolean;
  color: string;
  width: number;
  height: number;
}

export interface TrackCheckpoint {
  x: number;
  y: number;
  radius: number;
  passed: boolean;
}
