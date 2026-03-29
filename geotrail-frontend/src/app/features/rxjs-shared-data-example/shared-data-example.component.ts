import { Component } from '@angular/core';
import { SenderComponent } from './sender/sender.component';
import { ReceiverComponent } from './receiver/receiver.component';

@Component({
  selector: 'app-shared-data-example',
  standalone: true,
  imports: [SenderComponent, ReceiverComponent],
  template: `
    <div class="m-8 max-w-4xl mx-auto rounded-xl shadow-2xl bg-white overflow-hidden">
      <!-- Header Section -->
      <div class="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
        <h2 class="text-3xl font-extrabold mb-2 text-white">RxJS BehaviorSubject Pattern</h2>
        <p class="text-blue-100 font-medium">Sharing Data Between Unrelated Angular Components</p>
      </div>
      
      <!-- Explanation Section -->
      <div class="p-8">
        <div class="mb-8 prose prose-indigo max-w-none bg-gray-50 border-l-4 border-indigo-500 p-4 rounded-r shadow-sm">
          <p class="text-gray-700 m-0 text-sm md:text-base leading-relaxed">
            This example demonstrates how to create a centralized state management approach using a shared 
            <code class="bg-gray-200 text-indigo-700 px-1 py-0.5 rounded">DataService</code> and RxJS 
            <code class="bg-gray-200 text-indigo-700 px-1 py-0.5 rounded">BehaviorSubject</code>.
            Because both sender and receiver interact with the singleton service, they don't need continuous links like 
            <code>@Input</code> or <code>@Output</code> to share the latest data state.
          </p>
        </div>
        
        <!-- Component Showcase -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          <!-- The component that writes data -->
          <div class="col-span-1 border-gray-200 lg:col-span-1 shadow-md hover:shadow-lg transition">
            <app-sender></app-sender>
          </div>
          
          <!-- The components that read data -->
          <div class="col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 shadow-md hover:shadow-lg transition bg-gray-100 p-4 rounded-lg">
            <!-- First Subscriber -->
            <app-receiver></app-receiver>
            
            <!-- Second Subscriber to prove multicast functionality -->
            <app-receiver></app-receiver>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SharedDataExampleComponent {}
