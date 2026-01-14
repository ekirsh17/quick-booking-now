# Booking Links Fix

## Problem
Booking links in SMS notifications weren't working on mobile devices or sometimes on local computer.

## Root Cause
The `notify-consumers` Edge Function was defaulting to `http://localhost:5173` (wrong port) and `localhost` doesn't work on mobile devices.

## Solution

### For Local Development (Same Computer)
- Links now default to `http://localhost:8080` (matching Vite config)
- Make sure your dev server is running: `pnpm dev` or `npm run dev`
- Links should work when clicking from your computer

### For Mobile Testing
You have two options:

#### Option 1: Use Your Computer's Local IP Address
1. Find your computer's local IP address:
   - Mac: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: `ipconfig` (look for IPv4 Address)
   - Linux: `hostname -I`
2. Set `FRONTEND_URL` in Supabase Dashboard:
   - Go to: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/functions/notify-consumers/settings
   - Add secret: `FRONTEND_URL` = `http://YOUR_IP:8080` (e.g., `http://192.168.1.100:8080`)
3. Make sure your computer and phone are on the same WiFi network
4. Make sure your firewall allows connections on port 8080

#### Option 2: Use Production URL (Recommended)
1. Deploy your frontend to a hosting service (Vercel, Netlify, etc.)
2. Set `FRONTEND_URL` in Supabase Dashboard to your production URL:
   - Go to: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/functions/notify-consumers/settings
   - Add secret: `FRONTEND_URL` = `https://www.openalert.org`

## How to Set FRONTEND_URL in Supabase

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/functions
2. Click on `notify-consumers` function
3. Go to "Settings" tab
4. Scroll to "Secrets" section
5. Click "Add new secret"
6. Key: `FRONTEND_URL`
7. Value: Your frontend URL (e.g., `http://localhost:8080` for local, or `https://www.openalert.org` for production)
8. Click "Save"

## Testing

1. Create a new appointment slot
2. Check the SMS notification - the link should be clickable
3. On your computer: Click the link - should open in browser
4. On mobile: Click the link - should open in mobile browser (if using local IP or production URL)

## Current Status
- ✅ Fixed default port (8080 instead of 5173)
- ✅ Added warning logs when FRONTEND_URL is not set
- ✅ Route `/claim/:slotId` is properly configured
- ⚠️ You still need to set `FRONTEND_URL` in Supabase for mobile/production use
