/**
 * Twilio SMS Webhook Route
 * 
 * TODO: Implement Twilio SMS webhook handler
 * 
 * This route will:
 * 1. Verify Twilio signature
 * 2. Extract SMS text and merchant phone number
 * 3. Look up merchant in Supabase
 * 4. Call OpenAI API to parse SMS
 * 5. Create opening in Supabase
 * 6. Send confirmation SMS to merchant
 */

import { Router } from 'express';
import { config } from '../config.js';

export const twilioWebhookRouter = Router();

twilioWebhookRouter.post('/', async (req, res) => {
  try {
    // TODO: Implement Twilio signature verification
    // const signature = req.headers['x-twilio-signature'];
    // const url = req.url;
    // const params = req.body;
    // const isValid = validateTwilioSignature(signature, url, params);
    // if (!isValid) {
    //   return res.status(403).json({ error: 'Invalid Twilio signature' });
    // }

    // TODO: Extract SMS data
    // const { Body: messageBody, From: fromNumber, To: toNumber } = req.body;

    // TODO: Look up merchant in Supabase by phone number
    // const merchant = await lookupMerchant(fromNumber);

    // TODO: Call OpenAI API to parse SMS
    // const parsedOpening = await parseSMSWithOpenAI(messageBody, merchant);

    // TODO: Create opening in Supabase
    // const opening = await createOpening(merchant.id, parsedOpening);

    // TODO: Send confirmation SMS to merchant
    // await sendConfirmationSMS(fromNumber, opening);

    // TODO: Notify consumers if applicable
    // await notifyConsumers(opening);

    // Temporary response
    res.json({
      success: true,
      message: 'Twilio SMS webhook received (not yet implemented)',
      // opening: opening
    });
  } catch (error) {
    console.error('Error processing Twilio SMS webhook:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

