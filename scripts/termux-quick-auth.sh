#!/data/data/com.termux/files/usr/bin/bash
# Quick Auth Check - Minimal widget for Termux
# Place in ~/.shortcuts/ for Termux:Widget
#
# One-tap: shows status toast
# If expired: directly opens auth URL

SERVER="${ASSISTANT_SERVER:-l36}"

STATUS=$(ssh -o ConnectTimeout=5 "$SERVER" '$HOME/assistant/scripts/claude-auth-status.sh simple' 2>&1)

case "$STATUS" in
    OK)
        termux-toast -s "Auth OK"
        ;;
    *EXPIRING*)
        termux-vibrate -d 100
        termux-toast "Auth expiring soon - tap again if needed"
        ;;
    *EXPIRED*|*MISSING*)
        termux-vibrate -d 200
        termux-toast "Auth expired - opening console..."
        termux-open-url "https://console.anthropic.com/settings/api-keys"
        sleep 2
        termux-notification -t "Assistant Re-Auth" -c "After getting key, run: ssh $SERVER '~/assistant/scripts/mobile-reauth.sh'" --id assistant-auth
        ;;
    *)
        termux-toast "Connection error"
        ;;
esac
