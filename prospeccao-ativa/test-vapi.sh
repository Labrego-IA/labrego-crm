#!/bin/bash
source .env

echo "=== 1. Importando número do Twilio para o Vapi ==="
curl -s -X POST "https://api.vapi.ai/phone-number" \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"provider\": \"twilio\",
    \"number\": \"$TWILIO_PHONE_NUMBER\",
    \"twilioAccountSid\": \"$TWILIO_ACCOUNT_SID\",
    \"twilioAuthToken\": \"$TWILIO_AUTH_TOKEN\"
  }" | jq .

