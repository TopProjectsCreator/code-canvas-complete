import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SmsProvider = 'twilio' | 'vonage' | 'messagebird';

interface SmsRequest {
  provider: SmsProvider;
  // Twilio: accountSid + authToken; Vonage: apiKey (=key) + apiSecret (=token); MessageBird: just apiKey in `authToken`
  accountSid?: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
}

async function sendViaTwilio(req: SmsRequest): Promise<Response> {
  if (!req.accountSid) {
    return new Response('Missing accountSid for Twilio', { status: 400 });
  }
  const auth = btoa(`${req.accountSid}:${req.authToken}`);
  const form = new URLSearchParams();
  form.set('From', req.from);
  form.set('To', req.to);
  form.set('Body', req.body);
  return fetch(`https://api.twilio.com/2010-04-01/Accounts/${req.accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
}

async function sendViaVonage(req: SmsRequest): Promise<Response> {
  // Vonage uses api_key + api_secret. We re-use accountSid as api_key, authToken as api_secret.
  const form = new URLSearchParams();
  form.set('api_key', req.accountSid || '');
  form.set('api_secret', req.authToken);
  form.set('from', req.from);
  form.set('to', req.to.replace(/^\+/, ''));
  form.set('text', req.body);
  return fetch('https://rest.nexmo.com/sms/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
}

async function sendViaMessageBird(req: SmsRequest): Promise<Response> {
  const form = new URLSearchParams();
  form.set('originator', req.from);
  form.set('recipients', req.to);
  form.set('body', req.body);
  return fetch('https://rest.messagebird.com/messages', {
    method: 'POST',
    headers: {
      'Authorization': `AccessKey ${req.authToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body: SmsRequest = await req.json();
    const { provider, authToken, from, to, body: text } = body;
    if (!provider || !authToken || !from || !to || !text) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const senders: Record<SmsProvider, (r: SmsRequest) => Promise<Response>> = {
      twilio: sendViaTwilio,
      vonage: sendViaVonage,
      messagebird: sendViaMessageBird,
    };
    const sender = senders[provider];
    if (!sender) {
      return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const response = await sender(body);
    const text2 = await response.text();
    if (!response.ok && response.status !== 202) {
      console.error(`SMS send failed [${response.status}]:`, text2);
      return new Response(JSON.stringify({ error: `Provider returned ${response.status}`, details: text2.slice(0, 300) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
