# External CRM Integration Guide

This guide explains how to integrate NovAgent with external CRM systems.

## Overview

NovAgent supports bidirectional sync with any REST-based CRM system through:
- **Webhooks** (Push from external CRM to NovAgent)
- **Polling** (Pull from external CRM to NovAgent)
- **API Push** (Push from NovAgent to external CRM)

## Quick Start

### 1. Configure Environment Variables

```env
# Enable external CRM
EXTERNAL_CRM_ENABLED=true

# External CRM API details
EXTERNAL_CRM_API_URL=https://your-crm.com/api/contacts
EXTERNAL_CRM_API_KEY=your_api_key_here

# Sync mode: 'webhook' or 'polling'
EXTERNAL_CRM_SYNC_MODE=webhook

# For polling mode (minutes between syncs)
EXTERNAL_CRM_SYNC_INTERVAL=30

# Webhook secret for validation
EXTERNAL_CRM_WEBHOOK_SECRET=your_secret_here

# NovAgent API authentication
API_AUTH_ENABLED=true
CRM_API_KEY=your_novagent_api_key
RATE_LIMIT_ENABLED=true
```

### 2. Choose Sync Method

#### Option A: Webhook (Recommended)

External CRM pushes data to NovAgent when changes occur.

**Setup:**
1. Configure webhook in your CRM to point to:
   ```
   POST https://novabot.izcy.tech/api/external/webhook
   ```

2. Add headers:
   ```
   X-API-Key: your_novagent_api_key
   Content-Type: application/json
   ```

3. Webhook payload format:
   ```json
   {
     "secret": "your_webhook_secret",
     "phone": "628123456789@c.us",
     "name": "John Doe",
     "company": "Acme Corp",
     "event_name": "Tech Conference 2025",
     "ticket_price": 150000,
     "capacity": 500,
     "status": "deal",
     "meeting_date": "2025-02-15T10:00:00Z",
     "event_date": "2025-06-20T09:00:00Z"
   }
   ```

#### Option B: Polling

NovAgent periodically fetches data from external CRM.

**Setup:**
1. Set `EXTERNAL_CRM_SYNC_MODE=polling`
2. Configure `EXTERNAL_CRM_API_URL` to your CRM's list endpoint
3. Set `EXTERNAL_CRM_SYNC_INTERVAL` (default: 30 minutes)

**External CRM API Response Format:**
```json
{
  "records": [
    {
      "phone": "628123456789@c.us",
      "name": "John Doe",
      "company": "Acme Corp",
      ...
    }
  ]
}
```

## Field Mapping

### External CRM → NovAgent

| External CRM Field | NovAgent Field | Type |
|-------------------|----------------|------|
| `phone` / `whatsapp_id` | `id` | String (WhatsApp ID) |
| `name` / `contact_name` | `nama` | String |
| `company` / `organization` | `instansi` | String |
| `event_name` | `event` | String |
| `ticket_price` / `price` | `ticketPrice` | Integer |
| `capacity` / `venue_size` | `capacity` | Integer |
| `status` / `deal_stage` | `dealStatus` | String |
| `notes` / `description` | `notes` | Text |
| `phone_1` / `contact_phone` | `cpFirst` | String |
| `phone_2` | `cpSecond` | String |
| `instagram` / `social_media` | `igLink` | String |
| `sales_rep` / `assigned_to` | `pic` | String |
| `task_status` | `status` | String |
| `meeting_date` | `meetingDate` | DateTime |
| `sale_date` | `ticketSaleDate` | DateTime |
| `event_date` | `eventDayDate` | DateTime |

### Customizing Field Mapping

Edit `apps/dashboard-api/src/backend/services/externalCrmService.js`:

```javascript
mapExternalToInternal(externalData) {
  return {
    id: externalData.your_id_field,
    nama: externalData.your_name_field,
    // ... customize mappings
  };
}

mapInternalToExternal(userData) {
  return {
    your_id_field: userData.id,
    your_name_field: userData.nama,
    // ... customize mappings
  };
}
```

## API Endpoints

All endpoints require authentication via `X-API-Key` header.

### Receive Webhook
```http
POST /api/external/webhook
X-API-Key: your_novagent_api_key
Content-Type: application/json

{
  "secret": "your_webhook_secret",
  "phone": "628123456789@c.us",
  "name": "John Doe",
  ...
}
```

**Response:**
```json
{
  "success": true,
  "userId": "628123456789@c.us",
  "action": "updated"
}
```

### Manual Fetch
```http
GET /api/external/fetch
X-API-Key: your_novagent_api_key
```

**Response:**
```json
{
  "success": true,
  "syncedRecords": 25,
  "userIds": ["628xxx@c.us", ...]
}
```

### Push User to External CRM
```http
POST /api/external/push/628123456789@c.us
X-API-Key: your_novagent_api_key
```

**Response:**
```json
{
  "success": true,
  "userId": "628123456789@c.us",
  "message": "User pushed to external CRM successfully"
}
```

### Get Integration Status
```http
GET /api/external/status
X-API-Key: your_novagent_api_key
```

**Response:**
```json
{
  "enabled": true,
  "mode": "webhook",
  "polling": "inactive",
  "configured": true
}
```

## Programmatic Usage

```javascript
import { ExternalCRMService } from './services/externalCrmService.js';

const crmService = new ExternalCRMService(databaseService);

// Process webhook
await crmService.processWebhook(webhookData);

// Manual poll
const synced = await crmService.pollExternalCRM();

// Push to external CRM
await crmService.pushToExternalCRM(userId);

// Start/stop polling
crmService.startPolling();
crmService.stopPolling();

// Get status
const status = crmService.getStatus();
```

## CRM-Specific Examples

### HubSpot Integration

```env
EXTERNAL_CRM_API_URL=https://api.hubapi.com/crm/v3/objects/contacts
EXTERNAL_CRM_API_KEY=your_hubspot_api_key
```

Customize field mapping for HubSpot's property names.

### Salesforce Integration

```env
EXTERNAL_CRM_API_URL=https://your-instance.salesforce.com/services/data/v58.0/sobjects/Contact
EXTERNAL_CRM_API_KEY=your_salesforce_bearer_token
```

Implement OAuth2 flow for Salesforce authentication.

### Zoho CRM Integration

```env
EXTERNAL_CRM_API_URL=https://www.zohoapis.com/crm/v2/Contacts
EXTERNAL_CRM_API_KEY=your_zoho_oauth_token
```

## Security Best Practices

1. **Use HTTPS only** - Never send API keys over HTTP
2. **Validate webhook secrets** - Always check `EXTERNAL_CRM_WEBHOOK_SECRET`
3. **Rate limiting** - Default 100 requests/minute per IP
4. **Rotate API keys** - Change keys periodically
5. **Monitor logs** - Check for unauthorized access attempts
6. **IP whitelisting** - Add firewall rules for known IPs

## Troubleshooting

### Webhook not receiving data
- Verify webhook URL is accessible from external CRM
- Check firewall/security group settings
- Validate API key is correct
- Check webhook secret matches
- Review server logs for errors

### Polling not working
- Ensure `EXTERNAL_CRM_SYNC_MODE=polling`
- Check `EXTERNAL_CRM_API_URL` is correct
- Verify API key has read permissions
- Check cron job is running: `crmService.getStatus()`

### Data not syncing
- Verify field mappings match your CRM
- Check data types are compatible
- Review logs for mapping errors
- Test with single record first

### Rate limit errors
- Reduce polling frequency
- Implement exponential backoff
- Contact support to increase limits

## Monitoring

Check sync health:
```bash
curl -H "X-API-Key: your_key" https://novabot.izcy.tech/api/external/status
```

View recent logs:
```bash
docker-compose logs -f dashboard-api | grep "External CRM"
```

## Performance Tips

1. **Use webhooks over polling** - Real-time, more efficient
2. **Batch operations** - Sync multiple records at once
3. **Cache frequently accessed data** - Reduce API calls
4. **Async processing** - Don't block main thread
5. **Monitor API quotas** - Stay within limits

## Advanced Configuration

### Custom Sync Logic

Extend `ExternalCRMService` class:

```javascript
class CustomCRMService extends ExternalCRMService {
  async processWebhook(webhookData) {
    // Custom preprocessing
    const processed = this.customTransform(webhookData);
    return super.processWebhook(processed);
  }

  customTransform(data) {
    // Your custom logic
    return data;
  }
}
```

### Selective Sync

Only sync specific deal statuses:

```javascript
mapExternalToInternal(externalData) {
  if (!['deal', 'negotiating'].includes(externalData.status)) {
    return null; // Skip syncing
  }
  return super.mapExternalToInternal(externalData);
}
```

## Support

For integration assistance:
- Review logs: `docker-compose logs dashboard-api`
- Check status endpoint
- Verify environment variables
- Test field mappings manually
