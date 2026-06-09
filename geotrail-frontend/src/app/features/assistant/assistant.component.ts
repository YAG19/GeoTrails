import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { RagQueryRequest, RagEmbedRequest } from '../../core/models/api.models';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  sources?: string[];
}

type LlmProvider = 'gemini' | 'ollama' | 'lmstudio';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="assistant-container">
      <!-- Settings Sidebar Panel -->
      <aside class="settings-sidebar">
        <div class="sidebar-section">
          <h3>🤖 LLM Provider</h3>
          <div class="form-group">
            <label for="llm-provider">Provider</label>
            <select
              id="llm-provider"
              [(ngModel)]="selectedProvider"
              (ngModelChange)="onProviderChange()"
              class="form-control"
            >
              <option value="gemini">Google Gemini (Cloud)</option>
              <option value="ollama">Ollama</option>
              <option value="lmstudio">LM Studio (Local)</option>
            </select>
            <small class="help-text">Set RAG_LLM_PROVIDER on the backend to match.</small>
          </div>

          @if (selectedProvider === 'gemini') {
            <div class="form-group mt-3">
              <label for="gemini-model">LLM Model</label>
              <select id="gemini-model" [(ngModel)]="selectedModel" class="form-control">
                @for (m of geminiModels; track m) {
                  <option [value]="m">{{ m }}</option>
                }
              </select>
            </div>
          }

          @if (selectedProvider === 'ollama') {
            <div class="form-group mt-3">
              <label for="ollama-model">LLM Model</label>
              <select id="ollama-model" [(ngModel)]="selectedModel" class="form-control">
                @for (m of ollamaModels; track m) {
                  <option [value]="m">{{ m }}</option>
                }
              </select>
              <small class="help-text">Uses the Ollama instance configured on the backend (OLLAMA_BASE_URL).</small>
            </div>
          }

          @if (selectedProvider === 'lmstudio') {
            <div class="form-group mt-3">
              <label for="lms-url">Base API URL</label>
              <input
                id="lms-url"
                type="text"
                [(ngModel)]="lmsUrl"
                placeholder="http://localhost:1234"
                class="form-control"
              />
            </div>
            <button class="btn btn-secondary" (click)="fetchModels()" [disabled]="loadingModels()">
              {{ loadingModels() ? 'Fetching...' : '🔄 Refresh Models' }}
            </button>
            <div class="form-group mt-3">
              <label for="lms-model">LLM Model</label>
              <select id="lms-model" [(ngModel)]="selectedModel" class="form-control">
                @if (lmsModels().length === 0) {
                  <option value="">-- No models loaded --</option>
                } @else {
                  @for (m of lmsModels(); track m) {
                    <option [value]="m">{{ m }}</option>
                  }
                }
              </select>
              @if (lmsModels().length === 0) {
                <small class="help-text">Click "Refresh Models" or ensure LM Studio local server is active.</small>
              }
            </div>
          }

          <div class="form-group mt-3">
            <label for="temp-slider">Temperature: {{ temperature }}</label>
            <input
              id="temp-slider"
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              [(ngModel)]="temperature"
              class="slider"
            />
          </div>
        </div>

        <div class="sidebar-section mt-4">
          <h3>📦 RAG Vector Indexing</h3>
          <p class="section-desc">Before querying, index your timeline into the pgvector database so the AI can retrieve it.</p>
          
          <div class="form-group">
            <label for="embed-since">Index Since (Optional)</label>
            <input
              id="embed-since"
              type="date"
              [(ngModel)]="embedSince"
              class="form-control"
            />
          </div>

          <button 
            class="btn btn-gradient w-100" 
            (click)="triggerEmbedding()" 
            [disabled]="indexing()">
            {{ indexing() ? '⚡ Indexing...' : '⚡ Index Timeline data' }}
          </button>

          @if (embedResult()) {
            <div class="embed-report mt-3 animate-fade-in">
              <h4>Indexing Report</h4>
              <ul>
                <li>Processed: <strong>{{ embedResult()!.processed }}</strong></li>
                <li>Skipped: <strong>{{ embedResult()!.skipped }}</strong></li>
                <li>Failed: <strong [class.text-danger]="embedResult()!.failed > 0">{{ embedResult()!.failed }}</strong></li>
                <li>Time: <strong>{{ embedResult()!.elapsedSeconds }}s</strong></li>
              </ul>
            </div>
          }
        </div>
      </aside>

      <!-- Main Chat Interface -->
      <main class="chat-main">
        <header class="chat-header">
          <div class="title-area">
            <h2>💬 Timeline AI Assistant</h2>
            @if (selectedProvider === 'gemini') {
              <span class="status-indicator online">
                Gemini Cloud Active ({{ selectedModel }})
              </span>
            } @else if (selectedProvider === 'ollama') {
              <span class="status-indicator online">
                Ollama Active ({{ selectedModel }})
              </span>
            } @else {
              <span class="status-indicator" [class.online]="lmsConnected()">
                {{ lmsConnected() ? 'LM Studio Connected (' + selectedModel + ')' : 'Local Server Offline' }}
              </span>
            }
          </div>
        </header>

        <!-- Message History Feed -->
        <div class="chat-history" #historyFeed>
          @if (messages().length === 0) {
            <div class="empty-state">
              <span class="empty-icon">🗺️</span>
              <h3>Ask anything about your past locations</h3>
              <p>Explore your Google Timeline using natural language queries.</p>
              
              <div class="suggestions-grid">
                @for (chip of quickSuggestions; track chip) {
                  <button class="suggestion-chip" (click)="useSuggestion(chip)">
                    {{ chip }}
                  </button>
                }
              </div>

              <div class="narrate-row">
                <button class="suggestion-chip narrate" (click)="narratePeriod(7)" [disabled]="typing()">📖 Narrate my last 7 days</button>
                <button class="suggestion-chip narrate" (click)="narratePeriod(30)" [disabled]="typing()">📖 Narrate my last 30 days</button>
              </div>
            </div>
          }

          @for (msg of messages(); track msg.timestamp) {
            <div class="message-wrapper" [class.user]="msg.sender === 'user'" [class.assistant]="msg.sender === 'assistant'">
              <div class="avatar">
                {{ msg.sender === 'user' ? '👤' : '🤖' }}
              </div>
              <div class="message-bubble">
                <div class="message-text">{{ msg.text }}</div>
                
                @if (msg.sources && msg.sources.length > 0) {
                  <div class="message-sources mt-2">
                    <details>
                      <summary>🔍 Sources Used ({{ msg.sources.length }} timeline records)</summary>
                      <ul class="sources-list mt-2">
                        @for (source of msg.sources; track source) {
                          <li>{{ source }}</li>
                        }
                      </ul>
                    </details>
                  </div>
                }
                
                <span class="message-time">{{ msg.timestamp | date:'shortTime' }}</span>
              </div>
            </div>
          }

          @if (typing()) {
            <div class="message-wrapper assistant">
              <div class="avatar">🤖</div>
              <div class="message-bubble typing">
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Chat Input Footer -->
        <footer class="chat-input-area">
          <form (submit)="sendMessage()" class="input-form">
            <input
              type="text"
              [(ngModel)]="userInput"
              name="userInput"
              placeholder="e.g. what I was doing on 1 jan 2026"
              [disabled]="typing()"
              class="chat-input"
              autocomplete="off"
            />
            <button type="submit" class="btn-send" [disabled]="!userInput.trim() || typing()">
              <span class="send-icon">🚀</span>
            </button>
          </form>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    .assistant-container {
      display: flex;
      height: calc(100vh - 64px);
      background: var(--bg-page, #0f0f1b);
      color: var(--text-primary, #e2e8f0);
      font-family: 'Outfit', 'Inter', sans-serif;
    }

    /* Sidebar Settings Panel */
    .settings-sidebar {
      width: 320px;
      background: rgba(26, 26, 46, 0.95);
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      overflow-y: auto;
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(8px);
    }

    .sidebar-section {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 16px;
    }

    .sidebar-section h3 {
      font-size: 1rem;
      margin: 0 0 12px;
      color: #00e5ff;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-desc {
      font-size: 0.8rem;
      color: #94a3b8;
      line-height: 1.4;
      margin-bottom: 16px;
    }

    .form-group {
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 0.8rem;
      color: #94a3b8;
      font-weight: 500;
    }

    .form-control {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 10px 12px;
      color: #fff;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .form-control:focus {
      outline: none;
      border-color: #00e5ff;
      box-shadow: 0 0 8px rgba(0, 229, 255, 0.25);
    }

    .help-text {
      font-size: 0.75rem;
      color: #64748b;
      line-height: 1.3;
      margin-top: 4px;
    }

    .slider {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.1);
      outline: none;
    }

    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #00e5ff;
      cursor: pointer;
      box-shadow: 0 0 8px #00e5ff;
    }

    .btn {
      padding: 10px 16px;
      border-radius: 8px;
      border: none;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .btn-gradient {
      background: linear-gradient(135deg, #00e5ff, #0088ff);
      color: #111;
      box-shadow: 0 4px 15px rgba(0, 229, 255, 0.2);
    }

    .btn-gradient:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(0, 229, 255, 0.35);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .embed-report {
      background: rgba(15, 23, 42, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px;
    }

    .embed-report h4 {
      font-size: 0.8rem;
      margin: 0 0 8px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .embed-report ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.8rem;
    }

    .text-danger {
      color: #ff5252;
    }

    /* Main Chat Section */
    .chat-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #090910;
      position: relative;
    }

    .chat-header {
      background: rgba(26, 26, 46, 0.5);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding: 16px 24px;
      backdrop-filter: blur(8px);
    }

    .chat-header h2 {
      font-size: 1.2rem;
      font-weight: 700;
      margin: 0 0 4px;
    }

    .status-indicator {
      font-size: 0.75rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-indicator::before {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef5350;
    }

    .status-indicator.online::before {
      background: #00e5ff;
      box-shadow: 0 0 6px #00e5ff;
    }

    .status-indicator.online {
      color: #00e5ff;
    }

    /* Chat Messages Feed */
    .chat-history {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .empty-state {
      max-width: 600px;
      margin: 80px auto;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .empty-icon {
      font-size: 3rem;
    }

    .empty-state h3 {
      font-size: 1.4rem;
      margin: 0;
      font-weight: 700;
    }

    .empty-state p {
      color: #94a3b8;
      margin: 0 0 16px;
    }

    .suggestions-grid {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
    }

    .suggestion-chip {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 20px;
      padding: 8px 16px;
      color: #e2e8f0;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .suggestion-chip:hover {
      background: rgba(0, 229, 255, 0.1);
      border-color: #00e5ff;
      color: #00e5ff;
    }

    .narrate-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      margin-top: 14px;
    }

    .suggestion-chip.narrate {
      border-color: rgba(0, 229, 255, 0.25);
      color: #00e5ff;
    }

    .suggestion-chip.narrate:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Message Bubbles */
    .message-wrapper {
      display: flex;
      gap: 12px;
      max-width: 80%;
      animation: bubble-fade 0.25s ease-out;
    }

    @keyframes bubble-fade {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message-wrapper.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }

    .message-wrapper.assistant {
      align-self: flex-start;
    }

    .avatar {
      width: 36px;
      height: 36px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    .user .avatar {
      background: rgba(0, 229, 255, 0.1);
      border-color: rgba(0, 229, 255, 0.2);
    }

    .message-bubble {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .user .message-bubble {
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.08), rgba(0, 136, 255, 0.08));
      border-color: rgba(0, 229, 255, 0.15);
    }

    .message-text {
      font-size: 0.95rem;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .message-time {
      font-size: 0.7rem;
      color: #64748b;
      align-self: flex-end;
    }

    /* Collapsible Sources Drawer */
    .message-sources summary {
      font-size: 0.8rem;
      color: #00e5ff;
      cursor: pointer;
      outline: none;
      font-weight: 600;
      user-select: none;
    }

    .message-sources summary:hover {
      text-decoration: underline;
    }

    .sources-list {
      list-style: none;
      padding: 8px 12px;
      margin: 0;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      max-height: 150px;
      overflow-y: auto;
      font-size: 0.78rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
      color: #94a3b8;
    }

    .sources-list li {
      position: relative;
      padding-left: 14px;
    }

    .sources-list li::before {
      content: '📍';
      position: absolute;
      left: 0;
      font-size: 0.7rem;
    }

    /* Loading Typing Indicator */
    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 6px 12px;
      align-items: center;
      height: 12px;
    }

    .typing-indicator span {
      width: 6px;
      height: 6px;
      background: #00e5ff;
      border-radius: 50%;
      animation: jump 1.4s infinite ease-in-out both;
    }

    .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
    .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes jump {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1.0) translateY(-6px); }
    }

    /* Chat Input Area */
    .chat-input-area {
      background: rgba(15, 23, 42, 0.4);
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding: 16px 24px;
    }

    .input-form {
      display: flex;
      gap: 12px;
      background: rgba(9, 9, 16, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 4px 6px 4px 18px;
      transition: all 0.2s;
    }

    .input-form:focus-within {
      border-color: #00e5ff;
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.15);
    }

    .chat-input {
      flex: 1;
      background: transparent;
      border: none;
      color: #fff;
      font-size: 0.95rem;
      padding: 10px 0;
    }

    .chat-input:focus {
      outline: none;
    }

    .btn-send {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #00e5ff, #0088ff);
      border: none;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s;
      flex-shrink: 0;
      box-shadow: 0 0 8px rgba(0, 229, 255, 0.3);
    }

    .btn-send:hover:not(:disabled) {
      transform: scale(1.08);
    }

    .btn-send:disabled {
      background: rgba(255, 255, 255, 0.1);
      cursor: not-allowed;
      box-shadow: none;
    }

    .send-icon {
      font-size: 0.95rem;
    }

    .animate-fade-in {
      animation: fade-in 0.3s ease-out;
    }

    @keyframes fade-in {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class AssistantComponent implements OnInit {
  private apiService = inject(ApiService);

  selectedProvider: LlmProvider = 'gemini';
  lmsUrl = 'http://localhost:1234';
  selectedModel = 'gemini-2.5-flash';
  temperature = 0.2;
  userInput = '';
  embedSince = '';

  readonly geminiModels = ['gemini-2.5-flash'];
  readonly ollamaModels = ['kimi-k2.6', 'qwen3.5'];
  lmsModels = signal<string[]>([]);
  lmsConnected = signal<boolean>(false);
  typing = signal<boolean>(false);
  indexing = signal<boolean>(false);
  loadingModels = signal<boolean>(false);
  messages = signal<Message[]>([]);
  embedResult = signal<any | null>(null);

  quickSuggestions = [
    'What was I doing on 1 jan 2026?',
    'Summarize my locations on January 1, 2026',
    'Where did I travel on 2026-01-01?',
    'Which places did I visit on 1 jan 2026?'
  ];

  ngOnInit(): void {
    if (this.selectedProvider === 'lmstudio') {
      this.fetchModels();
    }
  }

  onProviderChange(): void {
    const models = this.modelsForProvider(this.selectedProvider);
    if (!models.includes(this.selectedModel)) {
      this.selectedModel = models[0] ?? '';
    }
    if (this.selectedProvider === 'lmstudio') {
      this.fetchModels();
    }
  }

  private modelsForProvider(provider: LlmProvider): string[] {
    switch (provider) {
      case 'gemini':
        return this.geminiModels;
      case 'ollama':
        return this.ollamaModels;
      case 'lmstudio':
        return this.lmsModels();
    }
  }

  fetchModels(): void {
    this.loadingModels.set(true);
    this.apiService.getLMSModels(this.lmsUrl).subscribe({
      next: (res) => {
        this.loadingModels.set(false);
        if (res && res.data && Array.isArray(res.data)) {
          const modelList = res.data.map((item: any) => item.id);
          this.lmsModels.set(modelList);
          this.lmsConnected.set(true);
          if (this.selectedProvider === 'lmstudio' &&
              (!this.selectedModel || !this.lmsModels().includes(this.selectedModel))) {
            this.selectedModel = this.lmsModels()[0] ?? '';
          }
        }
      },
      error: (err) => {
        this.loadingModels.set(false);
        this.lmsModels.set([]);
        this.lmsConnected.set(false);
        if (this.selectedProvider === 'lmstudio') {
          this.selectedModel = '';
        }
        console.warn('Failed to auto-fetch models from LM Studio:', err);
      }
    });
  }

  triggerEmbedding(): void {
    this.indexing.set(true);
    this.embedResult.set(null);

    const req: RagEmbedRequest = {};
    if (this.embedSince) {
      req.since = this.embedSince;
    }

    this.apiService.triggerRagEmbedding(req).subscribe({
      next: (res) => {
        this.indexing.set(false);
        this.embedResult.set(res);
      },
      error: (err) => {
        this.indexing.set(false);
        alert('Indexing failed. Check backend logs. Make sure LM Studio local embedding server is active.');
        console.error(err);
      }
    });
  }

  useSuggestion(chip: string): void {
    this.userInput = chip;
    this.sendMessage();
  }

  /** AI narrative of the user's recent timeline — grounded in stored segments (no indexing needed). */
  narratePeriod(days: number): void {
    if (this.typing()) return;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);

    this.messages.update((prev) => [...prev, {
      sender: 'user',
      text: `Narrate my last ${days} days`,
      timestamp: new Date()
    }]);
    this.typing.set(true);

    this.apiService.narrative({ from: from.toISOString(), to: to.toISOString() }).subscribe({
      next: (res) => {
        this.typing.set(false);
        this.messages.update((prev) => [...prev, {
          sender: 'assistant',
          text: res.narrative,
          timestamp: new Date()
        }]);
      },
      error: (err) => {
        this.typing.set(false);
        this.messages.update((prev) => [...prev, {
          sender: 'assistant',
          text: '⚠️ Could not generate a narrative. Ensure the backend LLM provider is configured and you have imported a semantic Google Timeline export.',
          timestamp: new Date()
        }]);
        console.error(err);
      }
    });
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.typing()) return;

    // Append user bubble
    this.messages.update((prev) => [...prev, {
      sender: 'user',
      text,
      timestamp: new Date()
    }]);

    this.userInput = '';
    this.typing.set(true);

    const req: RagQueryRequest = {
      question: text,
      model: this.selectedModel || undefined,
      temperature: this.temperature
    };

    this.apiService.queryRag(req).subscribe({
      next: (res) => {
        this.typing.set(false);
        this.messages.update((prev) => [...prev, {
          sender: 'assistant',
          text: res.answer,
          timestamp: new Date(),
          sources: res.sources
        }]);
      },
      error: (err) => {
        this.typing.set(false);
        this.messages.update((prev) => [...prev, {
          sender: 'assistant',
          text: this.buildQueryErrorMessage(),
          timestamp: new Date()
        }]);
        console.error(err);
      }
    });
  }

  private buildQueryErrorMessage(): string {
    const base = `⚠️ I couldn't query the RAG service. Make sure:\n` +
      `1. You ran **RAG Vector Indexing** in the settings side panel.\n` +
      `2. Backend \`RAG_LLM_PROVIDER\` is set to \`${this.selectedProvider}\`.\n`;

    if (this.selectedProvider === 'gemini') {
      return base + `3. \`GEMINI_API_KEY\` is configured on the backend.`;
    }
    if (this.selectedProvider === 'ollama') {
      return base +
        `3. Ollama is reachable at the backend \`OLLAMA_BASE_URL\`.\n` +
        `4. The model \`${this.selectedModel}\` is available in Ollama.`;
    }
    return base +
      `3. LM Studio API server is running at \`${this.lmsUrl}\`.\n` +
      `4. The model \`${this.selectedModel || 'local-model'}\` is loaded in LM Studio.`;
  }
}
