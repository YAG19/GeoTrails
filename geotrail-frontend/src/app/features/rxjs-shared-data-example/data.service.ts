import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root' // Service is available application-wide
})
export class DataService {
  // BehaviorSubject holds an initial value and emits its current value whenever subscribed to
  // It's ideal for shared state
  private dataSource = new BehaviorSubject<string>('Default Shared Message');
  
  // Expose as an Observable for components to subscribe to
  // This prevents components from accidentally calling .next() directly on the BehaviorSubject
  currentData = this.dataSource.asObservable();

  constructor() { }

  // Method for components to call when they want to update the shared data
  changeData(data: string) {
    this.dataSource.next(data);
  }
}
