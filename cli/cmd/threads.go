package cmd

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/codecanvas/cli/internal/client"
	"github.com/codecanvas/cli/internal/output"
	"github.com/spf13/cobra"
)

func NewThreadsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "threads",
		Short: "Community discussion threads (Reddit-style)",
		Long: `Browse and manage community discussion threads. Create topics, post
comments, vote, and organize by categories.`,
	}

	cmd.AddCommand(newThreadsListCmd())
	cmd.AddCommand(newThreadsShowCmd())
	cmd.AddCommand(newThreadsCreateCmd())
	cmd.AddCommand(newThreadsCommentCmd())
	cmd.AddCommand(newThreadsVoteCmd())
	cmd.AddCommand(newThreadsPinCmd())
	cmd.AddCommand(newThreadsDeleteCmd())
	cmd.AddCommand(newThreadsCategoriesCmd())
	cmd.AddCommand(newThreadsMeCmd())

	return cmd
}

func computeHotness(voteScore float64, createdAt string) float64 {
	t, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		return voteScore
	}
	hours := time.Since(t).Hours()
	if hours <= 0 {
		return voteScore
	}
	return voteScore / math.Pow(hours+2, 1.5)
}

func newThreadsListCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List threads with sorting",
		RunE: func(cmd *cobra.Command, args []string) error {
			sortMode, _ := cmd.Flags().GetString("sort")
			limit, _ := cmd.Flags().GetInt("limit")

			c := client.NewSupabaseFromFlags(cmd)
			var order string
			switch sortMode {
			case "new":
				order = "created_at"
			case "top":
				order = "vote_score"
			default:
				order = ""
			}
			data, err := c.Query("threads", "*", nil, order, limit)
			if err != nil {
				return fmt.Errorf("failed to list threads: %w", err)
			}

			type threadRow struct {
				ID           string
				Title        string
				VoteScore    int
				CommentCount int
				Author       string
				Category     string
				Pinned       bool
				CreatedAt    string
				Hotness      float64
			}

			var threads []threadRow
			authorIDs := make(map[string]bool)
			for _, r := range data {
				authorID := fmt.Sprint(r["author_id"])
				authorIDs[authorID] = true
			}

			authorMap := make(map[string]string)
			if len(authorIDs) > 0 {
				ids := make([]string, 0, len(authorIDs))
				for id := range authorIDs {
					ids = append(ids, id)
				}
				profiles, _ := c.Query("profiles", "display_name,user_id", []string{"user_id=in.(" + strings.Join(ids, ",") + ")"}, "", 100)
				for _, p := range profiles {
					authorMap[fmt.Sprint(p["user_id"])] = fmt.Sprint(p["display_name"])
				}
			}

			for _, r := range data {
				voteScore := toInt(r["vote_score"])
				commentCount := toInt(r["comment_count"])
				createdAt := fmt.Sprint(r["created_at"])
				authorID := fmt.Sprint(r["author_id"])

				authorName := authorMap[authorID]
				if authorName == "" {
					authorName = "unknown"
				}

				hotness := computeHotness(float64(voteScore), createdAt)
				pinned := false
				if v, ok := r["pinned"].(bool); ok {
					pinned = v
				}

				threads = append(threads, threadRow{
					ID:           fmt.Sprint(r["id"]),
					Title:        fmt.Sprint(r["title"]),
					VoteScore:    voteScore,
					CommentCount: commentCount,
					Author:       authorName,
					Category:     fmt.Sprint(r["category"]),
					Pinned:       pinned,
					CreatedAt:    createdAt,
					Hotness:      hotness,
				})
			}

			if sortMode == "hot" {
				sort.Slice(threads, func(i, j int) bool {
					if threads[i].Pinned != threads[j].Pinned {
						return threads[i].Pinned
					}
					return threads[i].Hotness > threads[j].Hotness
				})
			}

			rows := make([][]string, len(threads))
			for i, t := range threads {
				pinned := ""
				if t.Pinned {
					pinned = "*"
				}
				rows[i] = []string{
					strconv.Itoa(t.VoteScore),
					strconv.Itoa(t.CommentCount),
					pinned + t.Title,
					t.Author,
					t.Category,
					t.CreatedAt,
				}
			}
			output.PrintTable([]string{"SCORE", "REPLIES", "TITLE", "AUTHOR", "CATEGORY", "CREATED"}, rows)
			return nil
		},
	}
	cmd.Flags().String("sort", "hot", "Sort: hot, new, top")
	cmd.Flags().Int("limit", 25, "Number of threads")
	return cmd
}

func newThreadsShowCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "show [thread-id]",
		Short: "Show a thread with its comments",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			data, err := c.Query("threads", "*", []string{"id=eq." + args[0]}, "", 1)
			if err != nil || len(data) == 0 {
				return fmt.Errorf("thread not found")
			}
			t := data[0]
			fmt.Printf("Title: %s\n", t["title"])
			fmt.Printf("Score: %v | Comments: %v | Created: %s\n\n", t["vote_score"], t["comment_count"], t["created_at"])
			fmt.Println(fmt.Sprint(t["content"]))

			comments, _ := c.Query("comments", "*", []string{"thread_id=eq." + args[0]}, "created_at", 500)
			if len(comments) > 0 {
				fmt.Printf("\n--- %d Comments ---\n", len(comments))
				for _, comment := range comments {
					fmt.Printf("\n[%s] (score: %v):\n%s", comment["author_id"], comment["vote_score"], comment["content"])
				}
			}
			return nil
		},
	}
}

func newThreadsCreateCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new thread",
		RunE: func(cmd *cobra.Command, args []string) error {
			title, _ := cmd.Flags().GetString("title")
			content, _ := cmd.Flags().GetString("content")
			category, _ := cmd.Flags().GetString("category")
			if title == "" || content == "" {
				return fmt.Errorf("--title and --content are required")
			}
			c := client.NewSupabaseFromFlags(cmd)
			data := map[string]interface{}{
				"title":    title,
				"content":  content,
				"vote_score": 0,
				"comment_count": 0,
			}
			if category != "" {
				data["category"] = category
			}
			result, err := c.Insert("threads", data)
			if err != nil {
				return fmt.Errorf("failed to create thread: %w", err)
			}
			output.PrintSuccess(fmt.Sprintf("Thread created with ID: %s", result["id"]))
			return nil
		},
	}
	cmd.Flags().String("title", "", "Thread title (required)")
	cmd.Flags().String("content", "", "Thread body (required)")
	cmd.Flags().String("category", "", "Category name")
	return cmd
}

func newThreadsCommentCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "comment",
		Short: "Post a comment on a thread",
		RunE: func(cmd *cobra.Command, args []string) error {
			threadID, _ := cmd.Flags().GetString("thread")
			content, _ := cmd.Flags().GetString("content")
			parentID, _ := cmd.Flags().GetString("parent")
			if threadID == "" || content == "" {
				return fmt.Errorf("--thread and --content are required")
			}
			c := client.NewSupabaseFromFlags(cmd)
			data := map[string]interface{}{
				"thread_id": threadID,
				"content":   content,
				"vote_score": 0,
				"depth":     0,
			}
			if parentID != "" {
				data["parent_id"] = parentID
			}
			_, err := c.Insert("comments", data)
			if err != nil {
				return fmt.Errorf("failed to post comment: %w", err)
			}
			output.PrintSuccess("Comment posted")
			return nil
		},
	}
	cmd.Flags().String("thread", "", "Thread ID (required)")
	cmd.Flags().String("content", "", "Comment text (required)")
	cmd.Flags().String("parent", "", "Parent comment ID")
	return cmd
}

func newThreadsVoteCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "vote",
		Short: "Vote on a thread or comment",
		RunE: func(cmd *cobra.Command, args []string) error {
			id, _ := cmd.Flags().GetString("id")
			up, _ := cmd.Flags().GetBool("up")
			down, _ := cmd.Flags().GetBool("down")
			if id == "" {
				return fmt.Errorf("--id is required")
			}
			if up == down {
				return fmt.Errorf("specify exactly one of --up or --down")
			}
			vote := 1
			if down {
				vote = -1
			}
			c := client.NewSupabaseFromFlags(cmd)
			_, err := c.Insert("votes", map[string]interface{}{
				"target_id": id,
				"vote":      vote,
			})
			if err != nil {
				return fmt.Errorf("failed to vote: %w", err)
			}
			output.PrintSuccess(fmt.Sprintf("Voted %d on %s", vote, id))
			return nil
		},
	}
	cmd.Flags().String("id", "", "Target ID (required)")
	cmd.Flags().Bool("up", false, "Upvote")
	cmd.Flags().Bool("down", false, "Downvote")
	return cmd
}

func newThreadsPinCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "pin [thread-id]",
		Short: "Pin or unpin a thread",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			unpin, _ := cmd.Flags().GetBool("unpin")
			c := client.NewSupabaseFromFlags(cmd)
			err := c.Update("threads", args[0], map[string]interface{}{"pinned": !unpin})
			if err != nil {
				return fmt.Errorf("failed to pin thread: %w", err)
			}
			if unpin {
				output.PrintSuccess("Thread unpinned")
			} else {
				output.PrintSuccess("Thread pinned")
			}
			return nil
		},
	}
	cmd.Flags().Bool("unpin", false, "Unpin instead of pin")
	return cmd
}

func newThreadsDeleteCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "delete [thread-id]",
		Short: "Delete a thread",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			if err := c.Delete("threads", args[0]); err != nil {
				return fmt.Errorf("failed to delete thread: %w", err)
			}
			output.PrintSuccess("Thread deleted")
			return nil
		},
	}
}

func newThreadsCategoriesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "categories",
		Short: "Manage thread categories",
	}

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List all categories",
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			data, err := c.Query("thread_categories", "*", nil, "name", 100)
			if err != nil {
				return err
			}
			rows := make([][]string, len(data))
			for i, r := range data {
				rows[i] = []string{fmt.Sprint(r["id"]), fmt.Sprint(r["name"])}
			}
			output.PrintTable([]string{"ID", "NAME"}, rows)
			return nil
		},
	}

	createCmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new category",
		RunE: func(cmd *cobra.Command, args []string) error {
			name, _ := cmd.Flags().GetString("name")
			if name == "" {
				return fmt.Errorf("--name is required")
			}
			c := client.NewSupabaseFromFlags(cmd)
			_, err := c.Insert("thread_categories", map[string]interface{}{"name": name})
			if err != nil {
				return err
			}
			output.PrintSuccess("Category created")
			return nil
		},
	}
	createCmd.Flags().String("name", "", "Category name (required)")

	deleteCmd := &cobra.Command{
		Use:   "delete [id]",
		Short: "Delete a category",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			return c.Delete("thread_categories", args[0])
		},
	}

	cmd.AddCommand(listCmd, createCmd, deleteCmd)
	return cmd
}

func newThreadsMeCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "me",
		Short: "Show your karma and recent activity",
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)

			userInfo, err := c.Query("profiles", "display_name,karma,user_id", nil, "", 1)
			if err != nil || len(userInfo) == 0 {
				return fmt.Errorf("not logged in or profile not found")
			}
			p := userInfo[0]
			fmt.Printf("Display Name: %s\n", p["display_name"])
			fmt.Printf("Karma: %v\n", p["karma"])
			return nil
		},
	}
}

func toInt(v interface{}) int {
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	case json.Number:
		n, _ := val.Int64()
		return int(n)
	default:
		s := fmt.Sprint(val)
		n, _ := strconv.Atoi(s)
		return n
	}
}
