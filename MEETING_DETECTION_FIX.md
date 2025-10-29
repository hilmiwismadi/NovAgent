# Meeting Detection & Offer Fix

## Problem Identified

**User**: 6281717407674 (Edwin from PSM UGM)
**Issue**: Bot failed to offer meeting despite multiple clear interest signals

### Root Causes

1. **System Prompt Insufficiently Strong**
   - Meeting instructions existed but were not emphatic enough
   - Bot didn't recognize critical interest signals like "pusing", "tertarik", "lalu apa"
   - No explicit examples of WRONG vs CORRECT behavior

2. **No Post-Processing Detection**
   - Bot relied solely on LLM to follow instructions
   - LLM (llama-3.1-8b-instant) failed to consistently follow meeting offer guidelines
   - No automated detection of interest signals

3. **Specific Failures in Conversation**
   - Message 8: User said "lewat chat bikin saya pusing" → Bot said "bicara langsung" but NEVER asked for meeting time
   - Message 23: User said "Iya oke sy tertarik lalu apa" → Bot just explained more instead of offering meeting
   - Message 24: User said "Oke lalu" → Bot continued explaining without meeting offer

## Solutions Implemented

### 1. Strengthened System Prompt (`novabot.js:114-170`)

**Changes:**
- Added `CRITICAL - WAJIB DILAKUKAN!` emphasis
- Listed explicit meeting triggers with visual indicators (⚠️, ✅, ❌)
- Added common mistakes section (🚨 KESALAHAN UMUM)
- Included real examples from failed conversation showing WRONG vs CORRECT responses
- Added urgency language: "LANGSUNG tawarkan meeting!", "WAJIB!"

**Key Additions:**
```
⚠️ CRITICAL MEETING TRIGGERS (LANGSUNG TAWARKAN MEETING!):
1. Mereka bilang "tertarik", "menarik", "boleh", "oke", "siap"
2. Mereka bilang "pusing", "bingung", "ribet" dengan chat → LANGSUNG offer meeting
3. Mereka tanya "lalu?", "terus?", "next step?" → Mereka MENUNGGU offering meeting!
```

### 2. Added Interest Signal Detection (`novabot.js:489-547`)

**New Methods:**

#### `detectInterestSignals(userMessage)`
- Detects CRITICAL signals: "pusing", "tertarik", "lalu apa", "terus?", etc.
- Detects HIGH signals: "boleh", "oke", "siap", "deal" (when data complete)
- Returns urgency level: 'critical', 'high', or null
- Logs detected signals for debugging

#### `buildMeetingOfferGuidance(urgencyLevel, userMessage)`
- Builds explicit instructions for bot based on detected signals
- Provides specific response templates based on user's message type
- Emphasizes with 🚨 CRITICAL TRIGGER markers
- Includes what NOT to do (❌ JANGAN)

### 3. Integrated Detection into Chat Flow (`novabot.js:562-564`)

**Changes:**
```javascript
// Detect interest signals for meeting offer (CRITICAL for conversion!)
const interestLevel = this.detectInterestSignals(userMessage);
const meetingOfferGuidance = this.buildMeetingOfferGuidance(interestLevel, userMessage);

// Append to additional context
let additionalContext = dataCollectionGuidance + meetingOfferGuidance;
```

**How it Works:**
1. User sends message
2. System detects if message contains interest signals
3. If detected, injects CRITICAL guidance into bot's context
4. Bot receives emphatic instructions with specific templates
5. Increases likelihood bot will offer meeting

## Testing

### Test Results
- ✅ All 7 test cases passed
- ✅ Correctly detects "pusing" as critical signal
- ✅ Correctly detects "tertarik" as critical signal
- ✅ Correctly detects "lalu apa" as critical signal
- ✅ Correctly detects "boleh" as high signal (when data complete)
- ✅ Correctly ignores neutral messages like "hi" or "1500"

### Signal Detection Categories

**CRITICAL Signals (Immediate Meeting Offer Required):**
- Frustration: "pusing", "bingung", "ribet", "susah", "rumit"
- Interest: "tertarik", "interest", "menarik"
- Next Steps: "lalu apa", "lalu?", "terus?", "terus gimana", "next step", "oke lalu", "ya lalu"

**HIGH Signals (Strong Recommendation):**
- Agreement: "boleh", "oke", "ok", "siap", "setuju", "deal"
- Positive: "sip", "mantap", "bagus", "cocok"
- Note: Only triggers if basic data (nama, instansi, event) collected

## Expected Behavior After Fix

### Scenario 1: User Frustrated
```
User: "Oke baik tapi tampaknya lewat chat bikin saya pusing"
Bot: "Betul banget! Gimana kalau kita meeting aja biar lebih jelas? Kapan kira-kira ada waktu?"
```

### Scenario 2: User Shows Interest
```
User: "Iya oke sy tertarik lalu apa"
Bot: "Oke siap! Biar lebih detail, yuk kita meeting. Kapan enaknya? Minggu ini available?"
```

### Scenario 3: User Asks Next Steps
```
User: "Oke lalu"
Bot: "Next step-nya kita meeting ya! Kapan kira-kira ada waktu?"
```

## Impact on Conversion

### Before Fix:
- User showed interest 3 times
- Bot NEVER offered specific meeting time request
- Conversation ended without meeting scheduled
- Deal Status: Stuck at "prospect"

### After Fix:
- Bot will detect interest signals automatically
- Bot receives CRITICAL instructions to offer meeting
- Multiple safety nets:
  1. Stronger system prompt
  2. Automated signal detection
  3. Explicit guidance injection
  4. Real examples of mistakes

## Files Modified

1. `apps/whatsapp-bot/src/agent/novabot.js`
   - Lines 114-170: Enhanced system prompt with critical triggers
   - Lines 489-547: Added `detectInterestSignals()` and `buildMeetingOfferGuidance()` methods
   - Lines 562-564: Integrated detection into chat flow

## Testing Commands

```bash
# Check syntax
node --check apps/whatsapp-bot/src/agent/novabot.js

# Run full test suite
npm test

# View user conversation
DATABASE_URL="postgresql://novabot:novabot123@localhost:5433/novagent" \
  node check_user_conversation.js
```

## Recommendations

### Short Term (Already Implemented)
- ✅ Strengthen system prompt with explicit examples
- ✅ Add automated interest signal detection
- ✅ Inject critical guidance when signals detected

### Medium Term (Future Improvements)
1. **Track Meeting Offer Metrics**
   - Add `meetingOffered` boolean to Session table
   - Track when meeting was offered vs when scheduled
   - Monitor conversion rate from offer to scheduled

2. **A/B Test Different Models**
   - Current: llama-3.1-8b-instant (fast, cheap, but inconsistent)
   - Test: llama-3.1-70b-versatile (larger, more reliable)
   - Compare meeting conversion rates

3. **Add Fallback Detection**
   - If user shows interest 3+ times without meeting offer
   - Automatically inject meeting calendar link
   - Send notification to sales team

### Long Term (Strategic)
1. **Human Handoff Trigger**
   - If bot fails to offer meeting after 2 critical signals
   - Escalate to human sales rep
   - Notify via Slack/Telegram

2. **Post-Conversation Analysis**
   - Review all conversations that didn't schedule meeting
   - Identify new interest signal patterns
   - Continuously improve detection keywords

## Monitoring

### Key Metrics to Track
1. **Detection Rate**: % of interest signals successfully detected
2. **Offer Rate**: % of conversations where meeting was offered
3. **Acceptance Rate**: % of offered meetings that got scheduled
4. **Conversion Rate**: % of leads that scheduled meetings

### Alert Conditions
- ⚠️ If detection rate < 80% → Review new signal patterns
- ⚠️ If offer rate < 60% (when signals detected) → LLM not following instructions
- ⚠️ If acceptance rate < 40% → Review offer phrasing

---

**Date Implemented**: October 29, 2025
**Issue Reported By**: User 6281717407674 (Edwin, PSM UGM)
**Status**: ✅ Fixed and Tested
