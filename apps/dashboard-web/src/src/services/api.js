const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/dashboard';

class DashboardAPI {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.message || error.error || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error(`[API] Error fetching ${endpoint}:`, error);
      throw error;
    }
  }

  // Client Management
  async getAllClients() {
    return this.request('/clients');
  }

  async getClientById(id) {
    return this.request(`/clients/${encodeURIComponent(id)}`);
  }

  async createClient(data) {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateClient(id, data) {
    return this.request(`/clients/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteClient(id) {
    return this.request(`/clients/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  // Conversation Management
  async getConversations(userId, limit = 50) {
    return this.request(`/conversations/${encodeURIComponent(userId)}?limit=${limit}`);
  }

  // Statistics
  async getStatistics() {
    return this.request('/statistics');
  }

  // WhatsApp Integration
  async sendWhatsAppMessage(userId, message) {
    return this.request('/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify({
        to: userId,
        message: message
      })
    });
  }

  // Whitelist Management
  async getAllWhitelist(type = null) {
    const query = type ? `?type=${type}` : '';
    return this.request(`/whitelist${query}`);
  }

  async getWhitelistStats() {
    return this.request('/whitelist/stats');
  }

  async addToWhitelist(data) {
    return this.request('/whitelist', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateWhitelist(phoneNumber, data) {
    return this.request(`/whitelist/${encodeURIComponent(phoneNumber)}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async removeFromWhitelist(phoneNumber) {
    return this.request(`/whitelist/${encodeURIComponent(phoneNumber)}`, {
      method: 'DELETE'
    });
  }

  async checkWhitelist(phoneNumber, type = null) {
    const query = type ? `?type=${type}` : '';
    return this.request(`/whitelist/check/${encodeURIComponent(phoneNumber)}${query}`);
  }
}

export default new DashboardAPI();
