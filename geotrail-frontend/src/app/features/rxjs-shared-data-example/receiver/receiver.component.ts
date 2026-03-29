import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DataService } from '../data.service';

@Component({
  selector: 'app-receiver',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-5 border-2 border-emerald-400 rounded-lg bg-emerald-50 h-full flex flex-col mt-4 shadow-sm">
      <h3 class="text-xl font-bold mb-3 text-emerald-800">Receiver Component</h3>
      <p class="text-sm text-emerald-700 mb-4">
        This component subscribes to the Observable and will immediately receive any updates.
      </p>
      
      <div class="flex-grow flex flex-col mb-4">
        <p class="font-semibold text-emerald-800">Current Value:</p>
        <div class="p-4 bg-white border border-emerald-200 mt-2 rounded shadow-inner text-lg break-words text-gray-800 min-h-[4rem] flex items-center justify-center font-mono">
          "{{ message }}"
        </div>
      </div>
      
      <div class="text-xs text-emerald-600 bg-emerald-100 p-2 rounded w-max">
        <span class="font-bold">Subscription Status:</span> Active
      </div>
    </div>
  `
})
export class ReceiverComponent implements OnInit, OnDestroy {
  message: string = '';
  // Keep track of our subscription so we can unsubscribe later
  private subscription!: Subscription;

  // Inject the shared DataService
  constructor(private dataService: DataService) { }

  ngOnInit() {
    // Subscribe to the observable in the service
    // This callback fires immediately with the current behavior subject value,
    // and fires again every time a new value is emitted
    this.subscription = this.dataService.currentData.subscribe((sharedMessage: string) => {
      this.message = sharedMessage;
    });
  }

  ngOnDestroy() {
    // Crucial step: To prevent memory leaks by unsubscribing when the component is destroyed
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
