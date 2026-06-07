import { createContext, useContext, useEffect, useCallback, useRef, useState, ReactNode } from 'react';
import { DiscordSDK } from "@discord/embedded-app-sdk";
import { initDiscordSdk, getDiscordSdk, getDiscordAuth, isInDiscord, updateRichPresence } from '@/lib/discord';

interface DiscordContextType {
  isDiscordActivity: boolean;
  discordSdk: DiscordSDK | null;
  auth: any;
  channelName: string | null;
  guildName: string | null;
  guildAvatar: string | null;
  initialized: boolean;
  initError: string | null;
  updateRichPresence: (fileName?: string | null, language?: string | null, projectName?: string | null, isRunning?: boolean) => Promise<void>;
}

const DiscordContext = createContext<DiscordContextType>({
  isDiscordActivity: false,
  discordSdk: null,
  auth: null,
  channelName: null,
  guildName: null,
  guildAvatar: null,
  initialized: false,
  initError: null,
  updateRichPresence: async () => {},
});

export const useDiscord = () => useContext(DiscordContext);

export const DiscordProvider = ({ children }: { children: ReactNode }) => {
  const [isDiscordActivity, setIsDiscordActivity] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [guildName, setGuildName] = useState<string | null>(null);
  const [guildAvatar, setGuildAvatar] = useState<string | null>(null);
  const discordSdkRef = useRef<DiscordSDK | null>(null);
  const authRef = useRef<any>(null);

  const updatePresence = useCallback(async (fileName?: string | null, language?: string | null, projectName?: string | null, isRunning?: boolean) => {
    await updateRichPresence(fileName, language, projectName, isRunning);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!isInDiscord()) {
        setInitialized(true);
        return;
      }

      setIsDiscordActivity(true);
      const success = await initDiscordSdk();
      if (cancelled) return;

      if (!success) {
        setInitError("Failed to initialize Discord SDK. Check console for details.");
        setInitialized(true);
        return;
      }

      const sdk = getDiscordSdk()!;
      const authData = getDiscordAuth();
      discordSdkRef.current = sdk;
      authRef.current = authData;

      try {
        if (sdk.channelId != null && sdk.guildId != null) {
          const channel = await sdk.commands.getChannel({ channel_id: sdk.channelId });
          setChannelName(channel.name ?? null);
        }

        if (sdk.guildId != null) {
          const guilds = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
              Authorization: `Bearer ${authData.access_token}`,
              'Content-Type': 'application/json',
            },
          }).then((r) => r.json());

          const currentGuild = guilds.find((g: any) => g.id === sdk.guildId);
          if (currentGuild) {
            setGuildName(currentGuild.name ?? null);
            setGuildAvatar(currentGuild.icon
              ? `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.webp?size=128`
              : null
            );
          }
        }
      } catch (err) {
        console.warn('[Discord] Failed to fetch channel/guild info:', err);
      }

      setInitialized(true);
    }

    setup();
    return () => { cancelled = true; };
  }, []);

  const value: DiscordContextType = {
    isDiscordActivity,
    discordSdk: discordSdkRef.current,
    auth: authRef.current,
    channelName,
    guildName,
    guildAvatar,
    initialized,
    initError,
    updateRichPresence: updatePresence,
  };

  return (
    <DiscordContext.Provider value={value}>
      {children}
    </DiscordContext.Provider>
  );
};
