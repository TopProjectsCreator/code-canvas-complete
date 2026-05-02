import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { detectDeploymentPlatform } from '@/lib/platform';

interface PasskeyCredential {
  id: string;
  credential_id: string;
  device_name: string;
  created_at: string;
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export const usePasskeys = () => {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  const isSupported = typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function';
  const isReplit = detectDeploymentPlatform() === 'replit';

  const fetchCredentials = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isReplit) {
        setCredentials([]);
        return;
      }
      const { data } = await supabase.functions.invoke('webauthn-register', {
        body: { action: 'list' },
      });
      setCredentials(data?.credentials || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const register = async (deviceName?: string) => {
    if (!user || !isSupported || isReplit) return { error: 'WebAuthn is not supported on Replit' };
    setRegistering(true);

    try {
      // 1. Get challenge from server
      const { data: challengeData, error: challengeError } = await supabase.functions.invoke(
        'webauthn-register',
        { body: { action: 'get-challenge' } }
      );

      if (challengeError || !challengeData?.options) {
        setRegistering(false);
        return { error: 'Failed to get registration challenge' };
      }

      const options = challengeData.options;

      // 2. Convert base64url values to ArrayBuffers for the browser API
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64urlToBuffer(options.challenge),
        rp: options.rp,
        user: {
          ...options.user,
          id: base64urlToBuffer(options.user.id),
        },
        pubKeyCredParams: options.pubKeyCredParams,
        authenticatorSelection: options.authenticatorSelection,
        timeout: options.timeout,
        attestation: options.attestation,
        excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
          ...c,
          id: base64urlToBuffer(c.id),
        })),
      };

      // 3. Call WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        setRegistering(false);
        return { error: 'Registration cancelled' };
      }

      const response = credential.response as AuthenticatorAttestationResponse;

      // 4. Send to server for verification and storage
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
        'webauthn-register',
        {
          body: {
            action: 'verify-registration',
            credential: {
              id: bufferToBase64url(credential.rawId),
              type: credential.type,
              response: {
                attestationObject: bufferToBase64url(response.attestationObject),
                clientDataJSON: bufferToBase64url(response.clientDataJSON),
                transports: response.getTransports?.() || [],
              },
            },
            deviceName: deviceName || 'Passkey',
          },
        }
      );

      if (verifyError || verifyData?.error) {
        setRegistering(false);
        return { error: verifyData?.error || 'Verification failed' };
      }

      await fetchCredentials();
      setRegistering(false);
      return { error: null };
    } catch (err: any) {
      setRegistering(false);
      if (err.name === 'NotAllowedError') {
        return { error: 'Registration was cancelled or timed out' };
      }
      return { error: err.message || 'Registration failed' };
    }
  };

  const remove = async (credentialId: string) => {
    try {
      if (isReplit) return { error: 'WebAuthn is not supported on Replit' };
      await supabase.functions.invoke('webauthn-register', {
        body: { action: 'delete', credentialId },
      });
      await fetchCredentials();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  return {
    isSupported,
    credentials,
    loading,
    registering,
    register,
    remove,
    refresh: fetchCredentials,
  };
};
