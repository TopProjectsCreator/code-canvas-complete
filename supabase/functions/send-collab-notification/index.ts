import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  provider: 'resend' | 'mailgun' | 'postmark' | 'twilio';
  apiKey: string;
  accountSid?: string;
  authToken?: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}

async function sendViaResend(req: EmailRequest): Promise<Response> {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${req.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: req.from,
      to: [req.to],
      subject: req.subject,
      html: req.html,
    }),
  });
}

async function sendViaMailgun(req: EmailRequest): Promise<Response> {
  const parts = req.apiKey.split(':');
  let domain = 'sandbox.mailgun.org';
  let key = req.apiKey;
  if (parts.length === 2) {
    domain = parts[0];
    key = parts[1];
  }

  const form = new FormData();
  form.append('from', req.from);
  form.append('to', req.to);
  form.append('subject', req.subject);
  form.append('html', req.html);

  return fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${btoa(`api:${key}`)}` },
    body: form,
  });
}

async function sendViaPostmark(req: EmailRequest): Promise<Response> {
  return fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': req.apiKey,
    },
    body: JSON.stringify({
      From: req.from,
      To: req.to,
      Subject: req.subject,
      HtmlBody: req.html,
    }),
  });
}

async function sendViaTwilio(req: EmailRequest): Promise<Response> {
  if (req.accountSid) {
    // Twilio SMS
    const auth = btoa(`${req.accountSid}:${req.authToken}`);
    const form = new URLSearchParams();
    form.set('From', req.from);
    form.set('To', req.to);
    form.set('Body', req.subject);
    return fetch(`https://api.twilio.com/2010-04-01/Accounts/${req.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
  }
  // Twilio SendGrid email
  return fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${req.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: req.to }] }],
      from: { email: req.from },
      subject: req.subject,
      content: [{ type: 'text/html', value: req.html }],
    }),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication to prevent abuse as an open email relay.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: EmailRequest = await req.json();
    const { provider, apiKey, accountSid, authToken, from, to, subject, html } = body;

    const hasEmail = !!(apiKey && subject && html);
    const hasSms = !!(accountSid && authToken);
    if (!provider || !to || !(hasEmail || hasSms)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const senders: Record<string, (req: EmailRequest) => Promise<Response>> = {
      resend: sendViaResend,
      mailgun: sendViaMailgun,
      postmark: sendViaPostmark,
      twilio: sendViaTwilio,
    };

    const sender = senders[provider];
    if (!sender) {
      return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await sender({ provider, apiKey, accountSid, authToken, from, to, subject, html });
    const responseBody = await response.text();

    if (!response.ok && response.status !== 202) {
      console.error(`Email send failed [${response.status}]`);
      return new Response(JSON.stringify({ error: `Provider returned ${response.status}`, details: responseBody.slice(0, 200) }), {
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
