import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  provider: 'resend' | 'mailgun' | 'postmark' | 'twilio';
  apiKey: string;
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
  // API key format: key-xxx or domain:key-xxx
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
    headers: {
      'Authorization': `Basic ${btoa(`api:${key}`)}`,
    },
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
  // Twilio SendGrid API
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
    const body: EmailRequest = await req.json();
    const { provider, apiKey, from, to, subject, html } = body;

    if (!provider || !apiKey || !to || !subject) {
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

    const response = await sender({ provider, apiKey, from, to, subject, html });
    const responseBody = await response.text();

    if (!response.ok && response.status !== 202) {
      console.error(`Email send failed [${response.status}]:`, responseBody);
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
