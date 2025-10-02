const API_URL = 'http://localhost:3000';

export interface SessionData {
  id: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  customerProfile: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export class API {
  private token: string | null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  async checkAuth(): Promise<User | null> {
    if (!this.token) return null;
    
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
      return null;
    } catch {
      return null;
    }
  }

  async startSession(): Promise<{ session: SessionData; systemPrompt: string } | null> {
    if (!this.token) return null;

    try {
      const response = await fetch(`${API_URL}/api/sessions/start`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  async endSession(sessionId: string): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async saveTranscript(sessionId: string, speaker: string, text: string): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/transcript`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ speaker, text })
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async saveEvaluation(sessionId: string, result: string, score?: number): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/evaluation`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ result, score })
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getCustomerPrompt(): Promise<string | null> {
    if (!this.token) return null;

    try {
      const response = await fetch(`${API_URL}/api/customer-prompt`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (response.ok) {
        const data = await response.json();
        return data.systemPrompt;
      }
      return null;
    } catch {
      return null;
    }
  }
}
