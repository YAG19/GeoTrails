import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LocationPoint } from '../models/api.models';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private client: Client | null = null;
  private _livePoints$ = new Subject<LocationPoint>();
  private _connected$ = new BehaviorSubject<boolean>(false);

  readonly livePoints$: Observable<LocationPoint> = this._livePoints$.asObservable();
  readonly connected$: Observable<boolean> = this._connected$.asObservable();

  constructor(private authService: AuthService) {}

  connect(userId: number): void {
    if (this.client?.active) return;

    this.client = new Client({
      webSocketFactory: () => new SockJS(environment.wsUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this._connected$.next(true);
        console.log('[WS] Connected to tracking');

        this.client!.subscribe(
          `/topic/tracking/${userId}`,
          (message: IMessage) => {
            try {
              const point: LocationPoint = JSON.parse(message.body);
              this._livePoints$.next(point);
            } catch (e) {
              console.error('[WS] Failed to parse message:', e);
            }
          },
        );
      },
      onDisconnect: () => {
        this._connected$.next(false);
        console.log('[WS] Disconnected');
      },
      onStompError: (frame) => {
        console.error('[WS] STOMP error:', frame.headers['message']);
        this._connected$.next(false);
      },
    });

    this.client.activate();
  }

  disconnect(): void {
    if (this.client?.active) {
      this.client.deactivate();
    }
    this._connected$.next(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
