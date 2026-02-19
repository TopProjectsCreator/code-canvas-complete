import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function createWavHeader(pcmDataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Uint8Array {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmDataLength, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmDataLength, true);

  return new Uint8Array(header);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase configuration missing");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Music generation is not configured. GEMINI_API_KEY is required." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, bpm = 120, duration = 15 } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clampedDuration = Math.min(Math.max(duration, 5), 30);
    console.log(`Generating music: "${prompt}" at ${bpm} BPM for ${clampedDuration}s`);

    // Connect to Lyria RealTime via WebSocket
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
    
    const audioChunks: Uint8Array[] = [];
    let totalPcmBytes = 0;
    const sampleRate = 48000;
    const channels = 2;
    const bitsPerSample = 16;

    const result = await new Promise<{ audioUrl: string; duration: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { ws.close(); } catch {}
        // If we have audio data, return what we have
        if (audioChunks.length > 0) {
          const pcmData = new Uint8Array(totalPcmBytes);
          let offset = 0;
          for (const chunk of audioChunks) {
            pcmData.set(chunk, offset);
            offset += chunk.length;
          }
          const wavHeader = createWavHeader(totalPcmBytes, sampleRate, channels, bitsPerSample);
          const wavFile = new Uint8Array(wavHeader.length + pcmData.length);
          wavFile.set(wavHeader);
          wavFile.set(pcmData, wavHeader.length);
          const base64Audio = uint8ArrayToBase64(wavFile);
          const actualDuration = totalPcmBytes / (sampleRate * channels * (bitsPerSample / 8));
          resolve({ audioUrl: `data:audio/wav;base64,${base64Audio}`, duration: Math.round(actualDuration) });
        } else {
          reject(new Error("Timed out waiting for audio"));
        }
      }, (clampedDuration + 10) * 1000);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Send setup message for Lyria
        ws.send(JSON.stringify({
          setup: {
            model: "models/lyria-realtime-exp",
          }
        }));
      };

      let setupComplete = false;

      ws.onmessage = (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : null;
          if (!data) return;

          // Handle setup completion
          if (data.setupComplete || data.setup_complete) {
            setupComplete = true;
            // Send weighted prompts
            ws.send(JSON.stringify({
              music_generation_input: {
                weighted_prompts: [
                  { text: prompt, weight: 1.0 }
                ],
                music_generation_config: {
                  bpm: bpm,
                  temperature: 1.0,
                },
                playback_control: "PLAY"
              }
            }));

            // Schedule stop
            setTimeout(() => {
              try {
                ws.send(JSON.stringify({
                  music_generation_input: {
                    playback_control: "STOP"
                  }
                }));
                setTimeout(() => {
                  try { ws.close(); } catch {}
                }, 1000);
              } catch {}
            }, clampedDuration * 1000);
            return;
          }

          // Handle audio chunks
          const audioData = data.serverContent?.audioChunks?.[0]?.data 
            || data.server_content?.audio_chunks?.[0]?.data;
          if (audioData) {
            const pcmBytes = base64ToUint8Array(audioData);
            audioChunks.push(pcmBytes);
            totalPcmBytes += pcmBytes.length;
          }
        } catch (e) {
          console.error("WS message parse error:", e);
        }
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        if (audioChunks.length > 0) {
          const pcmData = new Uint8Array(totalPcmBytes);
          let offset = 0;
          for (const chunk of audioChunks) {
            pcmData.set(chunk, offset);
            offset += chunk.length;
          }
          const wavHeader = createWavHeader(totalPcmBytes, sampleRate, channels, bitsPerSample);
          const wavFile = new Uint8Array(wavHeader.length + pcmData.length);
          wavFile.set(wavHeader);
          wavFile.set(pcmData, wavHeader.length);
          const base64Audio = uint8ArrayToBase64(wavFile);
          const actualDuration = totalPcmBytes / (sampleRate * channels * (bitsPerSample / 8));
          resolve({ audioUrl: `data:audio/wav;base64,${base64Audio}`, duration: Math.round(actualDuration) });
        } else {
          reject(new Error("No audio data received"));
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        console.error("WebSocket error:", err);
        reject(new Error("WebSocket connection failed"));
      };
    });

    console.log(`Music generated: ${result.duration}s`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-music error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
