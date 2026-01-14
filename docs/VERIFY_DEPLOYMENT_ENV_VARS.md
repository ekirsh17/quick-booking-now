# Verify Deployment Environment Variables

This guide helps you verify and update environment variables in your deployment platforms.

## Quick Checklist

### Frontend (Vercel)
- [ ] `VITE_SUPABASE_URL` = `https://gawcuwlmvcveddqjjqxc.supabase.co`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` = (production anon key)
- [ ] `VITE_SUPABASE_PROJECT_ID` = `gawcuwlmvcveddqjjqxc`

### Backend (Railway)
- [ ] `SUPABASE_URL` = `https://gawcuwlmvcveddqjjqxc.supabase.co`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = (production service_role key)

## Step-by-Step Verification

### Step 1: Check Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your frontend project
3. Navigate to: **Settings** → **Environment Variables**
4. Check these variables:

   **Required Variables:**
   - `VITE_SUPABASE_URL`
     - ✅ Should be: `https://gawcuwlmvcveddqjjqxc.supabase.co`
     - ❌ If different: Update to production URL
   
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
     - ✅ Should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
     - ✅ Should be the **anon** key from production project
     - ❌ If different: Update to production anon key
   
   - `VITE_SUPABASE_PROJECT_ID`
     - ✅ Should be: `gawcuwlmvcveddqjjqxc`
     - ❌ If different: Update to production project ID

5. **If any need updating:**
   - Click on the variable → **Edit**
   - Update the value
   - Ensure it's set for **Production** environment (and Preview/Development if needed)
   - Click **Save**
   - **Important**: After updating, go to **Deployments** tab → Click **"..."** on latest deployment → **Redeploy**

### Step 2: Check Railway Environment Variables

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Select your backend project/service
3. Navigate to: **Variables** tab
4. Check these variables:

   **Required Variables:**
   - `SUPABASE_URL`
     - ✅ Should be: `https://gawcuwlmvcveddqjjqxc.supabase.co`
     - ❌ If different: Update to production URL
   
   - `SUPABASE_SERVICE_ROLE_KEY`
     - ✅ Should be the **service_role** key from production project
     - ❌ If different: Update to production service_role key
     - **To verify**: Decode the JWT at [jwt.io](https://jwt.io) and check the `ref` field in payload:
       - ✅ Should be: `gawcuwlmvcveddqjjqxc`
       - ❌ If it's `thuelgbhfoaqbaaojezb`: This is the OLD project key - needs updating!

5. **If any need updating:**
   - Click on the variable (or **New Variable** if it doesn't exist)
   - Update the value
   - Click **Save**
   - Railway will automatically redeploy when variables are updated

### Step 3: Get Production Keys (If Needed)

If you need to get the production keys:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc)
2. Navigate to: **Settings** → **API**
3. Copy these values:

   - **Project URL**: `https://gawcuwlmvcveddqjjqxc.supabase.co`
   - **anon/public key**: Use for `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel
   - **service_role key**: Use for `SUPABASE_SERVICE_ROLE_KEY` in Railway
     - ⚠️ **Important**: This is a secret key - never commit it to git or share it publicly

### Step 4: Verify Updates

#### Frontend Verification (Vercel)
1. After Vercel redeploys, visit your production site
2. Open browser console (F12 → Console tab)
3. Check for errors:
   - ✅ No Supabase connection errors
   - ✅ No authentication errors
4. Test login:
   - ✅ Should connect to production database
   - ✅ Should be able to authenticate users

#### Backend Verification (Railway)
1. Check Railway logs after redeploy:
   - Go to Railway Dashboard → Your Service → **Deployments** → View logs
   - ✅ Should not see Supabase connection errors
   - ✅ Server should start successfully
2. Test backend endpoint:
   - Visit `https://your-railway-app.up.railway.app/health`
   - ✅ Should return `{"status":"ok"}`
   - ✅ Should not show database connection errors

#### Cross-Verification
1. **Frontend → Backend**: Frontend should be able to authenticate users in production database
2. **Backend → Database**: Backend should be able to read/write to production database
3. **SMS Parsing**: SMS parsing should work (merchants should be found in production database)

## Common Issues

### Issue: "Invalid API key" or "Project not found"
**Solution**: The Supabase URL or keys are pointing to the wrong project. Verify:
- URL matches: `https://gawcuwlmvcveddqjjqxc.supabase.co`
- Keys are from the production project dashboard

### Issue: "Merchant not found" in SMS parsing
**Solution**: Backend is using wrong Supabase project. Verify:
- `SUPABASE_URL` in Railway points to production
- `SUPABASE_SERVICE_ROLE_KEY` in Railway is from production project

### Issue: Frontend can't authenticate users
**Solution**: Frontend is using wrong Supabase project. Verify:
- All `VITE_SUPABASE_*` variables in Vercel point to production

## Production Keys Reference

**Production Project**: `gawcuwlmvcveddqjjqxc`
**Production URL**: `https://gawcuwlmvcveddqjjqxc.supabase.co`

**Get Keys From**: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/api

## Next Steps

After verifying/updating environment variables:
1. ✅ All variables point to production project
2. ✅ Frontend and backend redeployed
3. ✅ Verified no connection errors
4. ✅ Tested authentication and database access
5. ✅ SMS parsing works correctly






