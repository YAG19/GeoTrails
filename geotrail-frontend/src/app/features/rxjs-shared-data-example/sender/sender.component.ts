import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';

@Component({
  selector: 'app-sender',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-5 border-2 border-indigo-400 rounded-lg bg-indigo-50 shadow-sm h-full flex flex-col justify-between">
      <div>
        <h3 class="text-xl font-bold mb-3 text-indigo-800">Sender Component</h3>
        <p class="text-sm text-indigo-600 mb-4">
          This component calls the service method to update the shared BehaviorSubject.
        </p>
        <div class="flex flex-col gap-3">
          <label for="messageInput" class="font-semibold text-indigo-700">New Message:</label>
          <input 
            id="messageInput"
            type="text" 
            [(ngModel)]="message" 
            placeholder="Type your message here..."
            class="p-3 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            (keyup.enter)="newMessage()"
          >
        </div>
      </div>
      
      <button 
        (click)="newMessage()" 
        class="mt-4 bg-indigo-600 text-white font-semibold px-5 py-3 rounded-md hover:bg-indigo-700 transition duration-200"
      >
        Update Shared State
      </button>
    </div>
  `
})
export class SenderComponent {
  message: string = '';

  // Inject the shared DataService
  constructor(private dataService: DataService) { }

  newMessage() {
    if (this.message.trim()) {
      // Pass the new data to the service
      this.dataService.changeData(this.message);
      this.message = ''; // clear input after sending
    }
  }
}
