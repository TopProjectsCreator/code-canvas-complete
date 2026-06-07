import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { DiscordSDK } from "@discord/embedded-app-sdk";
import { initDiscordSdk, getDiscordSdk, getDiscordAuth, isInDiscord, setActivity as setDiscordActivity } from '@/lib/discord';

interface DiscordContextType {
  isDiscordActivity: boolean;
  discordSdk: DiscordSDK | null;
  auth: any;
  channelName: string | null;
  guildName: string | null;
  guildAvatar: string | null;
  initialized: boolean;
  error: string | null;
  setActivity: (activity: {
    details?: string;
    state?: string;
    assets?: { large_image?: string; large_text?: string; small_image?: string; small_text?: string };
    timestamps?: { start?: number; end?: number };
    party?: { size: [number, number] };
    type?: number;
  }) => Promise<void>;
}

const DiscordContext = createContext<DiscordContextType>({
  isDiscordActivity: false,
  discordSdk: null,
  auth: null,
  channelName: null,
  guildName: null,
  guildAvatar: null,
  initialized: false,
  error: null,
  setActivity: async () => {},
});

export const useDiscord = () => useContext(DiscordContext);

export const DiscordProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<DiscordContextType>({
    isDiscordActivity: false,
    discordSdk: null,
    auth: null,
    channelName: null,
    guildName: null,
    guildAvatar: null,
    initialized: false,
    error: null,
    setActivity: async () => {},
  });

  const setActivity = useCallback(async (activity: Parameters<DiscordContextType['setActivity']>[0]) => {
    await setDiscordActivity(activity);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const inDiscord = isInDiscord();
      if (!inDiscord) {
        setState({
          isDiscordActivity: false,
          discordSdk: null,
          auth: null,
          channelName: null,
          guildName: null,
          guildAvatar: null,
          initialized: true,
          error: null,
          setActivity: async () => {},
        });
        return;
      }

      const success = await initDiscordSdk();
      if (cancelled) return;

      if (!success) {
        setState({
          isDiscordActivity: true,
          discordSdk: null,
          auth: null,
          channelName: null,
          guildName: null,
          guildAvatar: null,
          initialized: true,
          error: 'Failed to initialize Discord SDK',
          setActivity: async () => {},
        });
        return;
      }

      const sdk = getDiscordSdk()!;
      const authData = getDiscordAuth();

      let channelName: string | null = null;
      let guildName: string | null = null;
      let guildAvatar: string | null = null;

      try {
        if (sdk.channelId != null && sdk.guildId != null) {
          const channel = await sdk.commands.getChannel({ channel_id: sdk.channelId });
          channelName = channel.name ?? null;
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
            guildName = currentGuild.name ?? null;
            guildAvatar = currentGuild.icon
              ? `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.webp?size=128`
              : null;
          }
        }
      } catch (err) {
        console.warn('[Discord] Failed to fetch channel/guild info:', err);
      }

      if (!cancelled) {
        setState({
          isDiscordActivity: true,
          discordSdk: sdk,
          auth: authData,
          channelName,
          guildName,
          guildAvatar,
          initialized: true,
          error: null,
          setActivity,
        });
      }
    }

    setup();

    return () => { cancelled = true; };
  }, [setActivity]);

  return (
    <DiscordContext.Provider value={state}>
      {children}
    </DiscordContext.Provider>
  );
};
