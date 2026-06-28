import { useVoiceVideoRoom } from '@/hooks/useVoiceVideoRoom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Loader2 } from 'lucide-react';

interface VoiceVideoRoomProps {
  projectId: string | undefined;
  roomName: string;
}

export function VoiceVideoRoom({ projectId, roomName }: VoiceVideoRoomProps) {
  const {
    isInRoom,
    // localStream unused
    peers,
    audioEnabled,
    videoEnabled,
    connecting,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
  } = useVoiceVideoRoom(projectId, roomName);

  const peerCount = peers.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isInRoom ? <Phone className="h-4 w-4 text-green-500" /> : <Video className="h-4 w-4" />}
          Voice / video room
        </CardTitle>
        <CardDescription>
          {isInRoom
            ? `Connected — ${peerCount} peer${peerCount !== 1 ? 's' : ''} in room`
            : 'WebRTC room orchestration embedded in the IDE.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isInRoom ? (
          <>
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{roomName}</span>
                <Badge variant="secondary">
                  {peerCount} peer{peerCount !== 1 ? 's' : ''}
                </Badge>
              </div>

              {peers.length > 0 && (
                <div className="space-y-2">
                  {peers.map((peer) => (
                    <div key={peer.userId} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
                      {peer.stream ? (
                        <video
                          ref={(el) => {
                            if (el && peer.stream) el.srcObject = peer.stream;
                          }}
                          autoPlay
                          muted
                          className="h-14 w-14 rounded-lg bg-muted object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-lg font-bold text-muted-foreground">
                          {peer.displayName[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{peer.displayName}</div>
                        <div className="flex gap-2 mt-0.5">
                          {peer.audioEnabled ? (
                            <Mic className="h-3 w-3 text-green-500" />
                          ) : (
                            <MicOff className="h-3 w-3 text-muted-foreground" />
                          )}
                          {peer.videoEnabled ? (
                            <Video className="h-3 w-3 text-green-500" />
                          ) : (
                            <VideoOff className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {peers.length === 0 && (
                <div className="text-center text-muted-foreground py-2">
                  Waiting for others to join...
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant={audioEnabled ? 'default' : 'secondary'} onClick={toggleAudio}>
                {audioEnabled ? <Mic className="mr-1 h-3.5 w-3.5" /> : <MicOff className="mr-1 h-3.5 w-3.5" />}
                {audioEnabled ? 'Mute' : 'Unmute'}
              </Button>
              <Button size="sm" variant={videoEnabled ? 'default' : 'outline'} onClick={toggleVideo}>
                {videoEnabled ? <Video className="mr-1 h-3.5 w-3.5" /> : <VideoOff className="mr-1 h-3.5 w-3.5" />}
                {videoEnabled ? 'Disable camera' : 'Enable camera'}
              </Button>
              <Button size="sm" variant="destructive" onClick={leaveRoom} className="ml-auto">
                <PhoneOff className="mr-1 h-3.5 w-3.5" /> Leave
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{roomName}</span>
                <Badge variant="secondary">WebRTC</Badge>
              </div>
              <div className="text-muted-foreground">
                Join to talk with collaborators in this project.
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={joinRoom} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mic className="mr-1 h-3.5 w-3.5" />
                )}
                {connecting ? 'Connecting...' : 'Join audio'}
              </Button>
              <Button size="sm" variant="outline" onClick={joinRoom} disabled={connecting}>
                <Video className="mr-1 h-3.5 w-3.5" /> Join with video
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
