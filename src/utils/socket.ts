import { ControllerInput, SocketMessage } from '../types';

export class GameSocketClient {
  private ws: WebSocket | null = null;
  private roomId: string;
  private role: 'host' | 'controller';
  private onMessageCallback: (msg: SocketMessage) => void;
  private onStatusChangeCallback: (connected: boolean) => void;
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private isDestroyed: boolean = false;
  public latency: number = 0;
  private lastPingSent: number = 0;

  constructor(
    roomId: string,
    role: 'host' | 'controller',
    onMessage: (msg: SocketMessage) => void,
    onStatusChange: (connected: boolean) => void
  ) {
    this.roomId = roomId;
    this.role = role;
    this.onMessageCallback = onMessage;
    this.onStatusChangeCallback = onStatusChange;
    this.connect();
  }

  private connect() {
    if (this.isDestroyed) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.onStatusChangeCallback(true);
        // Register role
        this.send({
          type: this.role === 'host' ? 'register_host' : 'join_controller',
          roomId: this.roomId,
          role: this.role,
        });

        // Setup ping
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: SocketMessage = JSON.parse(event.data);
          if (data.type === 'pong') {
            this.latency = Date.now() - this.lastPingSent;
          }
          this.onMessageCallback(data);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.onStatusChangeCallback(false);
        this.stopPing();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Handled in onclose
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSent = Date.now();
        this.ws.send(JSON.stringify({ type: 'ping', roomId: this.roomId }));
      }
    }, 2000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 1500);
  }

  public send(msg: Partial<SocketMessage>) {
    const fullMsg: SocketMessage = {
      type: msg.type || 'input',
      roomId: this.roomId,
      role: this.role,
      payload: msg.payload,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMsg));
    } else if (this.role === 'controller' && msg.type === 'input') {
      // Fallback via HTTP POST
      fetch(`/api/room/${this.roomId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg.payload),
      }).catch(() => {});
    }
  }

  public sendInput(input: ControllerInput) {
    this.send({
      type: 'input',
      roomId: this.roomId,
      payload: input,
    });
  }

  public destroy() {
    this.isDestroyed = true;
    this.stopPing();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
