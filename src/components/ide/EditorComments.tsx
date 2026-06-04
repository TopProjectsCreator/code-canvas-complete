import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextComposer } from "./RichTextComposer";
import { richTextToPlainText, sanitizeRichText } from "@/lib/richText";
import type { useCollaboration } from "@/hooks/useCollaboration";

type CollabType = ReturnType<typeof useCollaboration>;

interface EditorCommentsProps {
  selectedLine: number | null;
  currentFilePath: string | null;
  collab: CollabType;
  fileComments: any[];
  selectedLineThreads: any[];
  activePresence: { userId: string; cursorLine?: number; color: string; displayName: string }[];
}

export const EditorComments = ({
  selectedLine,
  currentFilePath,
  collab,
  fileComments,
  selectedLineThreads,
  activePresence,
}: EditorCommentsProps) => {
  const [newComment, setNewComment] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState(false);
  const [postingReplyId, setPostingReplyId] = useState<string | null>(null);

  const postComment = async () => {
    if (!collab || !currentFilePath || !selectedLine || !sanitizeRichText(newComment)) return;
    setPostingComment(true);
    const ok = await collab.addComment(currentFilePath, selectedLine, sanitizeRichText(newComment));
    setPostingComment(false);
    if (ok) setNewComment("");
  };

  const postReply = async (commentId: string) => {
    if (!collab || !currentFilePath || !selectedLine) return;
    const draft = sanitizeRichText(replyDrafts[commentId] || "");
    if (!draft) return;
    setPostingReplyId(commentId);
    const ok = await collab.addComment(currentFilePath, selectedLine, draft, commentId);
    setPostingReplyId(null);
    if (ok) {
      setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
    }
  };

  if (!collab || !currentFilePath || selectedLine === null) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a line in a collaborative file to open threaded comments.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Line {selectedLine}</p>
            <p className="text-xs text-muted-foreground">
              Highlight a line, click comment, and keep the thread where the code lives.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Word-style
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {activePresence.slice(0, 4).map((entry) => (
            <Badge key={entry.userId} variant="outline" className="gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.displayName}
              {entry.cursorLine ? ` · Ln ${entry.cursorLine}` : ""}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-auto px-4 py-4">
        {selectedLineThreads.map((comment) => {
          const replies = fileComments.filter((entry) => entry.parent_id === comment.id);
          return (
            <div key={comment.id} className="rounded-xl border border-border bg-card/70 p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <Avatar className="mt-0.5 h-8 w-8">
                  <AvatarImage src={comment.profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {(comment.profile?.display_name || "U").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{comment.profile?.display_name || "User"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!comment.resolved ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => collab.resolveComment(comment.id, true)}
                      >
                        Resolve
                      </Button>
                    ) : (
                      <Badge variant="outline">Resolved</Badge>
                    )}
                  </div>
                  <div
                    className="prose prose-sm mt-2 max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichText(comment.content) }}
                  />
                </div>
              </div>

              {replies.length > 0 && (
                <div className="mt-3 space-y-2 border-l border-border pl-4">
                  {replies.map((reply) => (
                    <div key={reply.id} className="rounded-lg bg-muted/40 p-2.5">
                      <div className="mb-1 flex items-center gap-2 text-xs">
                        <span className="font-semibold">{reply.profile?.display_name || "User"}</span>
                        <span className="text-muted-foreground">
                          {new Date(reply.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichText(reply.content) }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-2">
                <RichTextComposer
                  value={replyDrafts[comment.id] || ""}
                  onChange={(value) => setReplyDrafts((prev) => ({ ...prev, [comment.id]: value }))}
                  placeholder="Add a follow-up…"
                  minHeightClassName="min-h-[84px]"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={
                      !richTextToPlainText(replyDrafts[comment.id] || "") || postingReplyId === comment.id
                    }
                    onClick={() => postReply(comment.id)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {postingReplyId === comment.id ? "Posting…" : "Reply"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {selectedLineThreads.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
            No comments on this line yet. Add one to start an inline review thread.
          </div>
        )}
      </div>

      <div className="border-t border-border px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Comment on line {selectedLine}</p>
          <Badge variant="outline">{currentFilePath}</Badge>
        </div>
        <RichTextComposer
          value={newComment}
          onChange={setNewComment}
          placeholder="Mention changes, leave suggestions, or ask for follow-ups…"
        />
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            className="gap-2"
            onClick={postComment}
            disabled={!richTextToPlainText(newComment) || postingComment}
          >
            <Send className="h-4 w-4" />
            {postingComment ? "Posting…" : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
};
