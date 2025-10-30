/**
 * Google Calendar Token Manager
 * Handles automatic token refresh and lifecycle management
 */

import { google } from 'googleapis';

export class TokenManager {
  constructor() {
    this.auth = null;
    this.lastRefresh = null;
    this.refreshInterval = 50 * 60 * 1000; // Refresh every 50 minutes (before 1h expiry)
    this.isEnabled = process.env.GOOGLE_CALENDAR_ENABLED === 'true';
  }

  /**
   * Initialize OAuth2 client with credentials
   */
  async initialize() {
    if (!this.isEnabled) {
      console.log('[TokenManager] Google Calendar integration is disabled');
      return false;
    }

    try {
      this.auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob'
      );

      const credentials = {
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        access_token: process.env.GOOGLE_ACCESS_TOKEN
      };

      this.auth.setCredentials(credentials);
      this.lastRefresh = Date.now();

      console.log('[TokenManager] OAuth2 client initialized successfully');

      // Start automatic refresh timer
      this.startAutoRefresh();

      return true;
    } catch (error) {
      console.error('[TokenManager] Failed to initialize OAuth2 client:', error);
      return false;
    }
  }

  /**
   * Start automatic token refresh timer
   */
  startAutoRefresh() {
    if (!this.isEnabled || !this.auth) return;

    setInterval(async () => {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('[TokenManager] Auto refresh failed:', error.message);
      }
    }, this.refreshInterval);

    console.log(`[TokenManager] Auto refresh started (every ${this.refreshInterval/1000/60} minutes)`);
  }

  /**
   * Force token refresh
   */
  async refreshToken() {
    if (!this.auth || !this.auth.credentials.refresh_token) {
      throw new Error('No refresh token available');
    }

    try {
      console.log('[TokenManager] Refreshing access token...');
      const credentials = await this.auth.refreshAccessToken();

      this.lastRefresh = Date.now();

      // Update environment variable (for other processes)
      process.env.GOOGLE_ACCESS_TOKEN = credentials.access_token;

      console.log('[TokenManager] ✅ Token refreshed successfully');
      console.log(`[TokenManager] New token expires: ${new Date(credentials.expiry_date).toISOString()}`);

      return credentials;
    } catch (error) {
      console.error('[TokenManager] ❌ Token refresh failed:', error.message);

      if (error.message.includes('invalid_grant') || error.message.includes('unauthorized_client')) {
        console.log('[TokenManager] ⚠️  Refresh token is invalid. Manual re-authorization required.');

        // Emit a signal that manual intervention is needed
        this.emitRefreshFailure();
      }

      throw error;
    }
  }

  /**
   * Check if token needs refresh
   */
  shouldRefresh() {
    if (!this.lastRefresh) return true;

    const timeSinceRefresh = Date.now() - this.lastRefresh;
    return timeSinceRefresh > this.refreshInterval;
  }

  /**
   * Get authenticated client (auto-refresh if needed)
   */
  async getAuthClient() {
    if (!this.auth) {
      throw new Error('Auth client not initialized');
    }

    if (this.shouldRefresh()) {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('[TokenManager] Auto refresh failed, using current token:', error.message);
      }
    }

    return this.auth;
  }

  /**
   * Handle refresh failure
   */
  emitRefreshFailure() {
    console.log('\n' + '='.repeat(60));
    console.log('🚨 GOOGLE CALENDAR TOKEN REFRESH FAILED');
    console.log('='.repeat(60));
    console.log('The refresh token has been revoked or is invalid.');
    console.log('');
    console.log('🔧 STEPS TO FIX:');
    console.log('1. Go to: https://console.developers.google.com/');
    console.log('2. Select your project');
    console.log('3. Go to "Credentials"');
    console.log('4. Create/Update OAuth 2.0 Client ID');
    console.log('5. Re-authorize the application');
    console.log('6. Get new refresh token');
    console.log('7. Update environment variables');
    console.log('');
    console.log('📱 QUICK FIX (for development):');
    console.log('1. Run: node get_google_tokens.js');
    console.log('2. Follow the authorization flow');
    console.log('3. Copy the new tokens to .env file');
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Test current tokens
   */
  async testTokens() {
    if (!this.auth) {
      return { valid: false, error: 'Auth client not initialized' };
    }

    try {
      const calendar = google.calendar({ version: 'v3', auth: this.auth });
      await calendar.events.list({
        calendarId: 'primary',
        maxResults: 1,
        timeMin: new Date().toISOString()
      });

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get token status
   */
  getTokenStatus() {
    return {
      initialized: !!this.auth,
      lastRefresh: this.lastRefresh,
      timeSinceRefresh: this.lastRefresh ? Date.now() - this.lastRefresh : null,
      refreshInterval: this.refreshInterval,
      needsRefresh: this.shouldRefresh(),
      hasRefreshToken: !!(this.auth && this.auth.credentials.refresh_token)
    };
  }
}

export default TokenManager;