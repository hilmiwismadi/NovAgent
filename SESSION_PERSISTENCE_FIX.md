# Session Persistence Bug Fix

**Issue ID**: Session not cleared after dashboard reset
**User Reported**: 6281717407674
**Date Fixed**: 2025-10-29

---

## 🐛 Problem Description

**Symptom**: After deleting a client from the dashboard, when the user chats again, the bot still remembers their old name from the previous session.

**Example**:
1. User first session: Bot learned name "Petang"
2. Dashboard: Admin clicks "Reset" to delete client
3. User second session: User says "My name is De Broglie"
4. **BUG**: Bot responses show "De Broglie" BUT database still shows "Petang"

---

## 🔍 Root Cause Analysis

The system has **THREE layers** of data persistence:

| Layer | Location | Deleted by Reset? | Issue |
|-------|----------|-------------------|-------|
| 1. **Database User** | PostgreSQL `User` table | ✅ Yes | Working correctly |
| 2. **Database Session** | PostgreSQL `Session` table | ❌ **NO** | **BUG #1** |
| 3. **In-Memory Session** | WhatsApp bot `Map<userId, NovaBot>` | ❌ **NO** | **BUG #2** |

### **Bug #1: Database Session Not Deleted**

**File**: `apps/dashboard-api/src/backend/services/crmService.js:338-382`

The `resetClientContext()` function only deleted:
```javascript
// OLD CODE - Missing session deletion
await prisma.conversation.deleteMany({ where: { userId } });
await prisma.user.delete({ where: { userId } });
// ❌ Session NOT deleted!
```

**Impact**: When user chats again:
1. `saveConversation()` calls `getOrCreateUser()` → creates NEW user with empty data
2. `updateSession()` at line 513 → updates OLD session with OLD context
3. Next chat loads OLD context with "Petang" instead of fresh start

---

### **Bug #2: In-Memory Session Not Cleared**

**File**: `apps/whatsapp-bot/src/integrations/whatsapp-client.js`

The WhatsApp bot is a **long-running process** that keeps sessions in memory:
```javascript
this.sessions = new Map(); // In-memory storage
```

When dashboard deletes a client:
- ✅ Database User deleted
- ✅ Database Session deleted (after fix)
- ❌ In-memory Map still has old NovaBot instance

**Impact**: When user chats again:
1. `getSession(contactId)` checks `this.sessions.has(contactId)` → **TRUE** (still exists)
2. Returns OLD NovaBot instance with OLD context
3. Bot uses "Petang" from memory, not from fresh database

---

## ✅ Solution Implemented

### **Fix #1: Delete Database Session**

**File**: `apps/dashboard-api/src/backend/services/crmService.js` (lines 365-368)

**Added**:
```javascript
// Delete session (to clear in-memory context)
await prisma.session.deleteMany({
  where: { userId: userId }
});
```

**Result**: Database session is now properly deleted along with User and Conversations.

---

### **Fix #2: Clear In-Memory Session via Signal File**

**Problem**: Dashboard API and WhatsApp bot are **separate processes**. We need inter-process communication.

**Solution**: File-based signaling using `.message-queue/` directory (already used for other features).

#### **Step 1: Dashboard Creates Reset Signal**

**File**: `apps/dashboard-api/src/backend/services/crmService.js` (lines 377-394)

```javascript
// Signal WhatsApp bot to clear in-memory session
const queueDir = path.resolve(process.cwd(), '.message-queue');
const resetSignalFile = path.join(queueDir, `reset-${userId}.json`);

fs.writeFileSync(resetSignalFile, JSON.stringify({
  action: 'RESET_SESSION',
  userId: userId,
  timestamp: new Date().toISOString()
}));
```

**Result**: Creates file `.message-queue/reset-6281717407674_c_us.json`

---

#### **Step 2: WhatsApp Bot Processes Reset Signals**

**File**: `apps/whatsapp-bot/src/integrations/whatsapp-client.js` (lines 336-381)

**Added new function**:
```javascript
async processResetSignals() {
  const resetFiles = files.filter(f => f.startsWith('reset-') && f.endsWith('.json'));

  for (const file of resetFiles) {
    const signalData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (signalData.action === 'RESET_SESSION') {
      // Clear in-memory session
      if (this.sessions.has(userId)) {
        this.sessions.delete(userId);
        console.log(`[WhatsApp] Cleared in-memory session for ${userId}`);
      }

      fs.unlinkSync(filePath); // Delete signal file
    }
  }
}
```

**Integrated into queue processor** (line 226):
```javascript
setInterval(async () => {
  await this.processMessageQueue();
  await this.processCommands();
  await this.processResetSignals(); // ✅ NEW
}, 5000); // Checks every 5 seconds
```

**Result**: Bot clears in-memory session within 5 seconds of dashboard reset.

---

## 📊 Data Flow: Before vs After

### **Before Fix** ❌

```
Dashboard Reset
  ├─ Delete User from DB ✅
  ├─ Delete Conversations ✅
  ├─ Delete Session ❌ MISSING
  └─ Clear in-memory session ❌ MISSING

User Chats Again
  ├─ getSession() → Returns OLD NovaBot instance (still in memory)
  ├─ Bot uses OLD context: "Petang"
  ├─ User says "De Broglie"
  ├─ Bot extracts "De Broglie" → this.userContext.nama
  ├─ updateSession() → Updates OLD session with OLD + NEW context (mixed)
  └─ Result: Database shows "Petang" but bot says "De Broglie" ❌
```

### **After Fix** ✅

```
Dashboard Reset
  ├─ Delete User from DB ✅
  ├─ Delete Conversations ✅
  ├─ Delete Session ✅ FIXED
  ├─ Create reset signal file ✅ NEW
  └─ Within 5s: Bot clears in-memory session ✅ NEW

User Chats Again
  ├─ getSession() → No in-memory session, creates NEW NovaBot
  ├─ Bot has FRESH context (empty)
  ├─ User says "De Broglie"
  ├─ Bot extracts "De Broglie" → this.userContext.nama
  ├─ updateUser() → Saves "De Broglie" to database
  └─ Result: Database shows "De Broglie", bot says "De Broglie" ✅
```

---

## 🧪 Testing Procedure

### **Test Case: Full Reset Cycle**

1. **Setup**: User 6281717407674 exists with name "Petang"

2. **Delete from Dashboard**:
   ```
   Expected logs:
   [CRM Service] Client deleted: 6281717407674@c.us, conversations: X, session cleared
   [CRM Service] Created reset signal for WhatsApp bot
   ```

3. **Wait 5 seconds** (for bot to process signal)
   ```
   Expected logs from WhatsApp bot:
   [WhatsApp] Processing reset signal for 6281717407674@c.us
   [WhatsApp] Cleared in-memory session for 6281717407674@c.us
   ```

4. **Verify Database**:
   ```sql
   SELECT * FROM "User" WHERE id = '6281717407674@c.us';
   -- Should return 0 rows

   SELECT * FROM "Session" WHERE "userId" = '6281717407674@c.us';
   -- Should return 0 rows
   ```

5. **User Chats Again**: "Hai, nama saya John"
   ```
   Expected:
   - Bot creates NEW user
   - Bot extracts "John"
   - Database saves "John"
   - Bot responds using "John"
   ```

6. **Verify Database Again**:
   ```sql
   SELECT nama FROM "User" WHERE id = '6281717407674@c.us';
   -- Should return "John"
   ```

---

## 📁 Files Modified

| File | Lines | Change |
|------|-------|--------|
| `apps/dashboard-api/src/backend/services/crmService.js` | 1-3 | Added imports: `fs`, `path` |
| `apps/dashboard-api/src/backend/services/crmService.js` | 365-368 | Delete database session |
| `apps/dashboard-api/src/backend/services/crmService.js` | 377-394 | Create reset signal file |
| `apps/whatsapp-bot/src/integrations/whatsapp-client.js` | 226 | Call `processResetSignals()` |
| `apps/whatsapp-bot/src/integrations/whatsapp-client.js` | 336-381 | New function `processResetSignals()` |

**Total Lines Added**: ~65 lines
**Total Lines Modified**: ~5 lines

---

## 🎯 Expected Behavior After Fix

### **Scenario 1: Normal Reset**
- ✅ Database User deleted
- ✅ Database Session deleted
- ✅ In-memory session cleared within 5 seconds
- ✅ Next chat starts with fresh context

### **Scenario 2: Reset During Active Chat**
- ✅ Mid-conversation, admin clicks reset
- ✅ In-memory session cleared within 5 seconds
- ✅ Next user message creates fresh session
- ✅ No old data leaks

### **Scenario 3: Multiple Resets**
- ✅ Reset client A → cleared
- ✅ Reset client B → cleared
- ✅ Each reset signal processed independently
- ✅ No interference between users

---

## 🚨 Edge Cases Handled

1. **Reset signal file is corrupted**
   - ✅ Caught by try-catch, file deleted, continues

2. **WhatsApp bot offline during reset**
   - ✅ Signal file remains in queue
   - ✅ Processed when bot comes back online

3. **Multiple reset signals for same user**
   - ✅ Each signal processed
   - ✅ Second signal is no-op (session already gone)

4. **User chats during 5-second window**
   - ⚠️ May still use old session
   - ✅ Next chat (after 5s) uses fresh session
   - **Acceptable**: 5-second race window is minimal

---

## 💡 Future Improvements

### **Option 1: WebSocket for Real-Time Clearing**
Replace file-based signaling with WebSocket:
```javascript
// Dashboard emits
socket.emit('RESET_SESSION', { userId });

// WhatsApp bot receives immediately
socket.on('RESET_SESSION', ({ userId }) => {
  this.sessions.delete(userId);
});
```
**Pros**: Instant (no 5-second delay)
**Cons**: Requires WebSocket infrastructure

### **Option 2: Shared Redis Cache**
Use Redis for session storage instead of in-memory Map:
```javascript
// Both processes access same Redis
await redis.del(`session:${userId}`);
```
**Pros**: No inter-process communication needed
**Cons**: Requires Redis deployment

---

## 📝 Summary

**Problem**: Bot remembered old names after dashboard reset due to:
1. Database Session not deleted
2. In-memory session not cleared

**Solution**:
1. Delete database Session in `resetClientContext()`
2. Create reset signal file for WhatsApp bot
3. Bot processes signals every 5 seconds and clears in-memory session

**Result**: Full session reset, no data persistence after dashboard delete ✅

---

**Status**: ✅ Ready for Testing
**Deployment**: Requires bot restart to load new code
**Last Updated**: 2025-10-29 03:45 WIB
