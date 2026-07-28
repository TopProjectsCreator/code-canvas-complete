package cmd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/codecanvas/cli/internal/client"
	"github.com/codecanvas/cli/internal/output"
)

func NewIDECmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "ide",
		Short: "IDE workspace and development tools",
		Long:  "Commands for managing IDE sandboxes, workspaces, file operations, AI tools, and development features.",
	}

	cmd.AddCommand(newIDERunCmd())
	cmd.AddCommand(newIDEWorkspaceCmd())
	cmd.AddCommand(newIDEExecCmd())
	cmd.AddCommand(newIDEFilesCmd())
	cmd.AddCommand(newIDEPreviewCmd())
	cmd.AddCommand(newIDEAICmd())
	cmd.AddCommand(newIDEGitCmd())
	cmd.AddCommand(newIDELspCmd())
	cmd.AddCommand(newIDEScanCmd())

	return cmd
}

func newIDERunCmd() *cobra.Command {
	var lang string
	var file string
	var input string

	cmd := &cobra.Command{
		Use:   "run",
		Short: "Execute code in a sandboxed environment",
		Long:  "Execute code snippets in a sandboxed environment with support for multiple languages.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if lang == "" {
				return fmt.Errorf("--lang is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			var code string

			if file != "" {
				data, err := os.ReadFile(file)
				if err != nil {
					return fmt.Errorf("reading file: %w", err)
				}
				code = string(data)
			} else {
				scanner := bufio.NewScanner(os.Stdin)
				var lines []string
				for scanner.Scan() {
					lines = append(lines, scanner.Text())
				}
				if err := scanner.Err(); err != nil {
					return fmt.Errorf("reading stdin: %w", err)
				}
				code = strings.Join(lines, "\n")
			}

			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]string{
				"code":     code,
				"language": lang,
				"stdin":    input,
			}

			resp, err := c.POST("/api/replit/execute", body)
			if err != nil {
				return err
			}

			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			if output, ok := result["output"].(string); ok && output != "" {
				fmt.Print(output)
			}
			if stderr, ok := result["stderr"].(string); ok && stderr != "" {
				fmt.Fprint(os.Stderr, stderr)
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&lang, "lang", "", "Programming language")
	cmd.Flags().StringVar(&file, "file", "", "File containing code to execute")
	cmd.Flags().StringVar(&input, "input", "", "Standard input for the code")

	return cmd
}

func newIDEWorkspaceCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "workspace",
		Short: "Manage persistent workspace containers",
		Long:  "Create, list, manage, and destroy persistent workspace containers for development.",
	}

	cmd.AddCommand(newWorkspaceListCmd())
	cmd.AddCommand(newWorkspaceCreateCmd())
	cmd.AddCommand(newWorkspaceDestroyCmd())
	cmd.AddCommand(newWorkspaceStatusCmd())

	return cmd
}

func newWorkspaceListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List all workspaces",
		Long:  "List all persistent workspace containers.",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			resp, err := c.GET("/api/replit/container")
			if err != nil {
				return err
			}

			var containers []map[string]interface{}
			if err := json.Unmarshal(resp.Body, &containers); err != nil {
				return fmt.Errorf("parsing response: %w", err)
			}

			fmt.Printf("%-20s %-30s %-12s %-20s %-20s\n", "ID", "NAME", "STATUS", "CREATED", "LAST USED")
			fmt.Println(strings.Repeat("-", 102))

			for _, c := range containers {
				id := fmt.Sprintf("%v", c["id"])
				name := fmt.Sprintf("%v", c["projectName"])
				status := fmt.Sprintf("%v", c["status"])
				created := fmt.Sprintf("%v", c["createdAt"])
				lastUsed := fmt.Sprintf("%v", c["lastUsedAt"])
				fmt.Printf("%-20s %-30s %-12s %-20s %-20s\n", id, name, status, created, lastUsed)
			}

			return nil
		},
	}
}

func newWorkspaceCreateCmd() *cobra.Command {
	var name string

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new workspace",
		Long:  "Create a new persistent workspace container.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if name == "" {
				return fmt.Errorf("--name is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]string{
				"projectName": name,
			}

			resp, err := c.POST("/api/replit/container", body)
			if err != nil {
				return err
			}

			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			if id, ok := result["id"].(string); ok {
				fmt.Printf("Workspace created: %s\n", id)
			} else {
				fmt.Println(string(resp.Body))
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&name, "name", "", "Workspace name")

	return cmd
}

func newWorkspaceDestroyCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "destroy [workspace-id]",
		Short: "Destroy a workspace",
		Long:  "Destroy a persistent workspace container.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			workspaceID := args[0]
			_, err = c.DELETE("/api/replit/container/" + workspaceID)
			if err != nil {
				return err
			}

			fmt.Printf("Workspace %s destroyed\n", workspaceID)
			return nil
		},
	}
}

func newWorkspaceStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status [workspace-id]",
		Short: "Get workspace status",
		Long:  "Get detailed status of a workspace container.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			workspaceID := args[0]
			resp, err := c.GET("/api/replit/container")
			if err != nil {
				return err
			}

			var containers []map[string]interface{}
			if err := json.Unmarshal(resp.Body, &containers); err != nil {
				return fmt.Errorf("parsing response: %w", err)
			}

			for _, container := range containers {
				if id, ok := container["id"].(string); ok && id == workspaceID {
					data, _ := json.MarshalIndent(container, "", "  ")
					fmt.Println(string(data))
					return nil
				}
			}

			return fmt.Errorf("workspace %s not found", workspaceID)
		},
	}
}

func newIDEExecCmd() *cobra.Command {
	var workspace string
	var timeout int

	cmd := &cobra.Command{
		Use:   "exec [command...]",
		Short: "Run shell commands in a workspace",
		Long:  "Execute shell commands within a workspace container.",
		Args:  cobra.MinimumNArgs(1),
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" {
				return fmt.Errorf("--workspace is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			command := strings.Join(args, " ")
			body := map[string]interface{}{
				"command":    command,
				"timeout_ms": timeout,
			}

			resp, err := c.POST("/api/replit/container/"+workspace+"/exec", body)
			if err != nil {
				return err
			}

			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			if output, ok := result["output"].(string); ok {
				fmt.Print(output)
			}
			if stderr, ok := result["stderr"].(string); ok && stderr != "" {
				fmt.Fprint(os.Stderr, stderr)
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID")
	cmd.Flags().IntVar(&timeout, "timeout", 30000, "Timeout in milliseconds")

	return cmd
}

func newIDEFilesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "files",
		Short: "Manage files in a workspace",
		Long:  "List, read, and write files within a workspace container.",
	}

	cmd.AddCommand(newFilesListCmd())
	cmd.AddCommand(newFilesReadCmd())
	cmd.AddCommand(newFilesWriteCmd())

	return cmd
}

func newFilesListCmd() *cobra.Command {
	var workspace string

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List files in a workspace",
		Long:  "List all files in a workspace container.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" {
				return fmt.Errorf("--workspace is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			resp, err := c.GET("/api/replit/container/" + workspace + "/files")
			if err != nil {
				return err
			}

			var files []map[string]interface{}
			if err := json.Unmarshal(resp.Body, &files); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			for _, f := range files {
				path := fmt.Sprintf("%v", f["path"])
				size := fmt.Sprintf("%v", f["size"])
				fmt.Printf("%s (%s bytes)\n", path, size)
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID")

	return cmd
}

func newFilesReadCmd() *cobra.Command {
	var workspace string
	var filePath string

	cmd := &cobra.Command{
		Use:   "read",
		Short: "Read a file from a workspace",
		Long:  "Read the contents of a file in a workspace container.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" {
				return fmt.Errorf("--workspace is required")
			}
			if filePath == "" {
				return fmt.Errorf("--path is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			resp, err := c.GET("/api/replit/container/" + workspace + "/read-file?path=" + url.QueryEscape(filePath))
			if err != nil {
				return err
			}

			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			if content, ok := result["content"].(string); ok {
				fmt.Print(content)
			} else {
				fmt.Println(string(resp.Body))
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID")
	cmd.Flags().StringVar(&filePath, "path", "", "File path")

	return cmd
}

func newFilesWriteCmd() *cobra.Command {
	var workspace string
	var filePath string
	var content string

	cmd := &cobra.Command{
		Use:   "write",
		Short: "Write a file to a workspace",
		Long:  "Write content to a file in a workspace container.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" {
				return fmt.Errorf("--workspace is required")
			}
			if filePath == "" {
				return fmt.Errorf("--path is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			if content == "" {
				scanner := bufio.NewScanner(os.Stdin)
				var lines []string
				for scanner.Scan() {
					lines = append(lines, scanner.Text())
				}
				if err := scanner.Err(); err != nil {
					return fmt.Errorf("reading stdin: %w", err)
				}
				content = strings.Join(lines, "\n")
			}

			body := map[string]string{
				"path":    filePath,
				"content": content,
			}

			_, err = c.POST("/api/replit/container/"+workspace+"/write-file", body)
			if err != nil {
				return err
			}

			fmt.Printf("File written: %s\n", filePath)
			return nil
		},
	}

	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID")
	cmd.Flags().StringVar(&filePath, "path", "", "File path")
	cmd.Flags().StringVar(&content, "content", "", "File content")

	return cmd
}

func newIDEPreviewCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "preview",
		Short: "Preview and screenshot projects",
		Long:  "Generate screenshots and preview URLs for workspace projects.",
	}

	cmd.AddCommand(newPreviewScreenshotCmd())
	cmd.AddCommand(newPreviewOpenCmd())

	return cmd
}

func newPreviewScreenshotCmd() *cobra.Command {
	var workspace string
	var output string

	cmd := &cobra.Command{
		Use:   "screenshot",
		Short: "Take a screenshot of a workspace",
		Long:  "Generate a screenshot of the current state of a workspace.",
		RunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" {
				return fmt.Errorf("--workspace is required")
			}
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]string{
				"workspaceId": workspace,
			}

			resp, err := c.POST("/api/replit/container/"+workspace+"/screenshot", body)
			if err != nil {
				return err
			}

			if output != "" {
				if err := os.WriteFile(output, resp.Body, 0644); err != nil {
					return fmt.Errorf("writing file: %w", err)
				}
				fmt.Printf("Screenshot saved to %s\n", output)
			} else {
				fmt.Println(string(resp.Body))
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID")
	cmd.Flags().StringVar(&output, "output", "", "Output file path")

	return cmd
}

func newPreviewOpenCmd() *cobra.Command {
	var workspace string

	cmd := &cobra.Command{
		Use:   "open",
		Short: "Get preview URL for a workspace",
		Long:  "Get the preview URL for a workspace.",
		RunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" {
				return fmt.Errorf("--workspace is required")
			}
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			resp, err := c.GET("/api/replit/container/" + workspace + "/preview")
			if err != nil {
				return err
			}

			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			if url, ok := result["url"].(string); ok {
				fmt.Println(url)
			} else {
				fmt.Println(string(resp.Body))
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID")

	return cmd
}

func newIDEAICmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "ai",
		Short: "AI assistant and generation tools",
		Long:  "Access AI-powered chat, image generation, video creation, and other AI tools.",
	}

	cmd.AddCommand(newAIChatCmd())
	cmd.AddCommand(newAIImageCmd())
	cmd.AddCommand(newAIVideoCmd())
	cmd.AddCommand(newAI3DCmd())
	cmd.AddCommand(newAICommandCmd())
	cmd.AddCommand(newAIIdentifyCmd())
	cmd.AddCommand(newAIProvidersCmd())
	cmd.AddCommand(newAIMCPCmd())
	cmd.AddCommand(newAISkillsCmd())

	return cmd
}

func newAIChatCmd() *cobra.Command {
	var message string
	var model string
	var file string
	var stream bool

	cmd := &cobra.Command{
		Use:   "chat",
		Short: "Chat with AI assistant",
		Long:  "Have a conversation with the AI assistant.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if message == "" {
				return fmt.Errorf("--message is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			messages := []map[string]string{
				{"role": "user", "content": message},
			}

			if file != "" {
				data, err := os.ReadFile(file)
				if err != nil {
					return fmt.Errorf("reading file: %w", err)
				}
				messages[0]["content"] = message + "\n\nFile contents:\n" + string(data)
			}

			body := map[string]interface{}{
				"messages": messages,
				"model":    model,
				"stream":   stream,
			}

			resp, err := c.POST("/api/replit/ai/chat", body)
			if err != nil {
				return err
			}

			if stream {
				reader := bufio.NewReader(strings.NewReader(string(resp.Body)))
				for {
					line, err := reader.ReadString('\n')
					if err != nil {
						break
					}
					line = strings.TrimSpace(line)
					if strings.HasPrefix(line, "data: ") {
						data := strings.TrimPrefix(line, "data: ")
						if data == "[DONE]" {
							break
						}
						var event map[string]interface{}
						if json.Unmarshal([]byte(data), &event) == nil {
							if delta, ok := event["choices"].([]interface{}); ok && len(delta) > 0 {
								if choice, ok := delta[0].(map[string]interface{}); ok {
									if content, ok := choice["delta"].(map[string]interface{}); ok {
										if text, ok := content["content"].(string); ok {
											fmt.Print(text)
										}
									}
								}
							}
						}
					}
				}
				fmt.Println()
			} else {
				var result map[string]interface{}
				if err := json.Unmarshal(resp.Body, &result); err != nil {
					fmt.Println(string(resp.Body))
					return nil
				}
				if choices, ok := result["choices"].([]interface{}); ok && len(choices) > 0 {
					if choice, ok := choices[0].(map[string]interface{}); ok {
						if msg, ok := choice["message"].(map[string]interface{}); ok {
							if content, ok := msg["content"].(string); ok {
								fmt.Println(content)
							}
						}
					}
				}
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&message, "message", "", "Message to send")
	cmd.Flags().StringVar(&model, "model", "", "AI model to use")
	cmd.Flags().StringVar(&file, "file", "", "File to include in context")
	cmd.Flags().BoolVar(&stream, "stream", true, "Stream response tokens")

	return cmd
}

func newAIImageCmd() *cobra.Command {
	var prompt string
	var provider string
	var model string
	var output string

	cmd := &cobra.Command{
		Use:   "image",
		Short: "Generate images with AI",
		Long:  "Generate images using AI with various providers.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if prompt == "" {
				return fmt.Errorf("--prompt is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]interface{}{
				"mode":     "image",
				"prompt":   prompt,
				"provider": provider,
				"model":    model,
			}

			resp, err := c.POST("/api/replit/ai/media", body)
			if err != nil {
				return err
			}

			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			if url, ok := result["url"].(string); ok {
				if output != "" {
					data, err := c.GET(url)
					if err != nil {
						return fmt.Errorf("downloading image: %w", err)
					}
					if err := os.WriteFile(output, data.Body, 0644); err != nil {
						return fmt.Errorf("writing file: %w", err)
					}
					fmt.Printf("Image saved to %s\n", output)
				} else {
					fmt.Println(url)
				}
			} else {
				fmt.Println(string(resp.Body))
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&prompt, "prompt", "", "Image generation prompt")
	cmd.Flags().StringVar(&provider, "provider", "openai", "AI provider")
	cmd.Flags().StringVar(&model, "model", "", "Model to use")
	cmd.Flags().StringVar(&output, "output", "", "Output file path")

	return cmd
}

func newAIVideoCmd() *cobra.Command {
	var prompt string
	var provider string
	var model string
	var output string

	cmd := &cobra.Command{
		Use:   "video",
		Short: "Generate videos with AI",
		Long:  "Generate videos using AI with various providers.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if prompt == "" {
				return fmt.Errorf("--prompt is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]interface{}{
				"mode":     "video",
				"prompt":   prompt,
				"provider": provider,
				"model":    model,
			}

			resp, err := c.POST("/api/replit/ai/media", body)
			if err != nil {
				return err
			}

			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			if url, ok := result["url"].(string); ok {
				fmt.Println(url)
			} else if taskID, ok := result["taskId"].(string); ok {
				fmt.Printf("Video generation started. Task ID: %s\n", taskID)

				for i := 0; i < 60; i++ {
					time.Sleep(2 * time.Second)
					statusResp, err := c.GET("/api/replit/ai/media/" + taskID)
					if err != nil {
						continue
					}

					var status map[string]interface{}
					if json.Unmarshal(statusResp.Body, &status) == nil {
						if s, ok := status["status"].(string); ok {
							if s == "completed" {
								if url, ok := status["url"].(string); ok {
									fmt.Println(url)
									return nil
								}
							} else if s == "failed" {
								return fmt.Errorf("video generation failed")
							}
						}
					}
				}
				return fmt.Errorf("timeout waiting for video generation")
			} else {
				fmt.Println(string(resp.Body))
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&prompt, "prompt", "", "Video generation prompt")
	cmd.Flags().StringVar(&provider, "provider", "", "AI provider")
	cmd.Flags().StringVar(&model, "model", "", "Model to use")
	cmd.Flags().StringVar(&output, "output", "", "Output file path")

	return cmd
}

func newAI3DCmd() *cobra.Command {
	var prompt string
	var provider string
	var output string

	cmd := &cobra.Command{
		Use:   "3d",
		Short: "Generate 3D models with AI",
		Long:  "Generate 3D models using AI with various providers.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if prompt == "" {
				return fmt.Errorf("--prompt is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]interface{}{
				"prompt":   prompt,
				"provider": provider,
			}

			resp, err := c.POST("/api/replit/ai/3d", body)
			if err != nil {
				return err
			}

			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			if taskID, ok := result["taskId"].(string); ok {
				fmt.Printf("3D generation started. Task ID: %s\n", taskID)

				for i := 0; i < 60; i++ {
					time.Sleep(2 * time.Second)
					statusResp, err := c.GET("/api/replit/ai/3d/" + taskID)
					if err != nil {
						continue
					}

					var status map[string]interface{}
					if json.Unmarshal(statusResp.Body, &status) == nil {
						if s, ok := status["status"].(string); ok {
							if s == "completed" {
								if url, ok := status["url"].(string); ok {
									if output != "" {
										data, err := c.GET(url)
										if err != nil {
											return fmt.Errorf("downloading model: %w", err)
										}
										if err := os.WriteFile(output, data.Body, 0644); err != nil {
											return fmt.Errorf("writing file: %w", err)
										}
										fmt.Printf("3D model saved to %s\n", output)
									} else {
										fmt.Println(url)
									}
									return nil
								}
							} else if s == "failed" {
								return fmt.Errorf("3D generation failed")
							}
						}
					}
				}
				return fmt.Errorf("timeout waiting for 3D generation")
			} else if url, ok := result["url"].(string); ok {
				fmt.Println(url)
			} else {
				fmt.Println(string(resp.Body))
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&prompt, "prompt", "", "3D generation prompt")
	cmd.Flags().StringVar(&provider, "provider", "", "AI provider")
	cmd.Flags().StringVar(&output, "output", "", "Output file path (GLB format)")

	return cmd
}

func newAICommandCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "command [prompt]",
		Short: "Generate a command from natural language",
		Long:  "Convert natural language instructions into shell commands.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]string{
				"prompt": args[0],
			}

			resp, err := c.POST("/api/replit/ai/generate-command", body)
			if err != nil {
				return err
			}

			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			if command, ok := result["command"].(string); ok {
				fmt.Println(command)
			} else {
				fmt.Println(string(resp.Body))
			}

			return nil
		},
	}
}

func newAIIdentifyCmd() *cobra.Command {
	var name string
	var platform string
	var urlStr string

	cmd := &cobra.Command{
		Use:   "identify",
		Short: "Identify a hardware part",
		Long:  "Identify hardware parts using AI.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if name == "" {
				return fmt.Errorf("--name is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]interface{}{
				"name":     name,
				"platform": platform,
				"url":      urlStr,
			}

			resp, err := c.POST("/api/replit/ai/identify-part", body)
			if err != nil {
				return err
			}

			fmt.Println(string(resp.Body))
			return nil
		},
	}

	cmd.Flags().StringVar(&name, "name", "", "Part name")
	cmd.Flags().StringVar(&platform, "platform", "", "Platform")
	cmd.Flags().StringVar(&urlStr, "url", "", "URL to part information")

	return cmd
}

func newAIProvidersCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "providers",
		Short: "Manage AI provider API keys",
		Long:  "Add, remove, and list AI provider API keys.",
	}

	cmd.AddCommand(newProvidersListCmd())
	cmd.AddCommand(newProvidersAddCmd())
	cmd.AddCommand(newProvidersRemoveCmd())
	cmd.AddCommand(newProvidersModelsCmd())

	return cmd
}

func newProvidersListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List AI providers",
		Long:  "List all configured AI providers and their status.",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			resp, err := c.GET("/api/replit/ai/keys")
			if err != nil {
				return err
			}

			var providers []map[string]interface{}
			if err := json.Unmarshal(resp.Body, &providers); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			fmt.Printf("%-20s %-12s %-40s\n", "PROVIDER", "STATUS", "BASE URL")
			fmt.Println(strings.Repeat("-", 72))

			for _, p := range providers {
				provider := fmt.Sprintf("%v", p["provider"])
				status := fmt.Sprintf("%v", p["status"])
				baseURL := fmt.Sprintf("%v", p["baseUrl"])
				fmt.Printf("%-20s %-12s %-40s\n", provider, status, baseURL)
			}

			return nil
		},
	}
}

func newProvidersAddCmd() *cobra.Command {
	var provider string
	var apiKey string
	var baseURL string

	cmd := &cobra.Command{
		Use:   "add",
		Short: "Add an AI provider API key",
		Long:  "Configure an AI provider API key.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if provider == "" {
				return fmt.Errorf("--provider is required")
			}
			if apiKey == "" {
				return fmt.Errorf("--api-key is required")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]interface{}{
				"provider": provider,
				"apiKey":   apiKey,
				"baseUrl":  baseURL,
			}

			_, err = c.PATCH("/api/replit/ai/keys", body)
			if err != nil {
				return err
			}

			fmt.Printf("Provider %s added successfully\n", provider)
			return nil
		},
	}

	cmd.Flags().StringVar(&provider, "provider", "", "Provider name")
	cmd.Flags().StringVar(&apiKey, "api-key", "", "API key")
	cmd.Flags().StringVar(&baseURL, "base-url", "", "Base URL")

	return cmd
}

func newProvidersRemoveCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "remove [provider]",
		Short: "Remove an AI provider",
		Long:  "Remove an AI provider API key.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			provider := args[0]
			_, err = c.DELETE("/api/replit/ai/keys?provider=" + url.QueryEscape(provider))
			if err != nil {
				return err
			}

			fmt.Printf("Provider %s removed successfully\n", provider)
			return nil
		},
	}
}

func newProvidersModelsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "models [provider]",
		Short: "List models for a provider",
		Long:  "List available models for a specific AI provider.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			provider := args[0]

			models := map[string][]string{
				"openai":    {"gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo", "dall-e-3"},
				"anthropic": {"claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-2"},
				"google":    {"gemini-pro", "gemini-pro-vision", "palm-2"},
				"replicate": {"stable-diffusion-xl", "llama-2-70b", "mixtral-8x7b"},
			}

			if providerModels, ok := models[provider]; ok {
				fmt.Printf("Models for %s:\n", provider)
				for _, m := range providerModels {
					fmt.Printf("  - %s\n", m)
				}
			} else {
				return fmt.Errorf("unknown provider: %s", provider)
			}

			return nil
		},
	}
}

func newAIMCPCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mcp",
		Short: "Manage MCP servers",
		Long:  "Add, remove, and list Model Context Protocol (MCP) servers.",
	}

	cmd.AddCommand(newMCPListCmd())
	cmd.AddCommand(newMCPAddCmd())
	cmd.AddCommand(newMCPRemoveCmd())

	return cmd
}

func newMCPListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List MCP servers",
		Long:  "List all configured MCP servers.",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			resp, err := c.GET("/api/replit/ai/mcp-servers")
			if err != nil {
				return err
			}

			var servers []map[string]interface{}
			if err := json.Unmarshal(resp.Body, &servers); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			fmt.Printf("%-20s %-40s %-30s\n", "ID", "NAME", "URL")
			fmt.Println(strings.Repeat("-", 90))

			for _, s := range servers {
				id := fmt.Sprintf("%v", s["id"])
				name := fmt.Sprintf("%v", s["name"])
				url := fmt.Sprintf("%v", s["url"])
				fmt.Printf("%-20s %-40s %-30s\n", id, name, url)
			}

			return nil
		},
	}
}

func newMCPAddCmd() *cobra.Command {
	var name string
	var urlStr string
	var apiKey string
	var description string

	cmd := &cobra.Command{
		Use:   "add",
		Short: "Add an MCP server",
		Long:  "Add a new Model Context Protocol server.",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]interface{}{
				"name":        name,
				"url":         urlStr,
				"apiKey":      apiKey,
				"description": description,
			}

			_, err = c.POST("/api/replit/ai/mcp-servers", body)
			if err != nil {
				return err
			}

			fmt.Printf("MCP server %s added successfully\n", name)
			return nil
		},
	}

	cmd.Flags().StringVar(&name, "name", "", "Server name")
	cmd.Flags().StringVar(&urlStr, "url", "", "Server URL")
	cmd.Flags().StringVar(&apiKey, "api-key", "", "API key")
	cmd.Flags().StringVar(&description, "description", "", "Server description")

	return cmd
}

func newMCPRemoveCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "remove [id]",
		Short: "Remove an MCP server",
		Long:  "Remove a Model Context Protocol server.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			serverID := args[0]
			_, err = c.DELETE("/api/replit/ai/mcp-servers/" + serverID)
			if err != nil {
				return err
			}

			fmt.Printf("MCP server %s removed successfully\n", serverID)
			return nil
		},
	}
}

func newAISkillsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "skills",
		Short: "Manage agent skills",
		Long:  "Add, remove, and list agent skills.",
	}

	cmd.AddCommand(newSkillsListCmd())
	cmd.AddCommand(newSkillsAddCmd())
	cmd.AddCommand(newSkillsRemoveCmd())
	cmd.AddCommand(newSkillsLibraryCmd())

	return cmd
}

func newSkillsListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List skills",
		Long:  "List all configured agent skills.",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			resp, err := c.GET("/api/replit/ai/skills")
			if err != nil {
				return err
			}

			var skills []map[string]interface{}
			if err := json.Unmarshal(resp.Body, &skills); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			fmt.Printf("%-20s %-40s %-40s\n", "ID", "NAME", "DESCRIPTION")
			fmt.Println(strings.Repeat("-", 100))

			for _, s := range skills {
				id := fmt.Sprintf("%v", s["id"])
				name := fmt.Sprintf("%v", s["name"])
				description := fmt.Sprintf("%v", s["description"])
				fmt.Printf("%-20s %-40s %-40s\n", id, name, description)
			}

			return nil
		},
	}
}

func newSkillsAddCmd() *cobra.Command {
	var name string
	var instruction string
	var description string
	var icon string

	cmd := &cobra.Command{
		Use:   "add",
		Short: "Add a skill",
		Long:  "Add a new agent skill.",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			body := map[string]interface{}{
				"name":        name,
				"instruction": instruction,
				"description": description,
				"icon":        icon,
			}

			_, err = c.POST("/api/replit/ai/skills", body)
			if err != nil {
				return err
			}

			fmt.Printf("Skill %s added successfully\n", name)
			return nil
		},
	}

	cmd.Flags().StringVar(&name, "name", "", "Skill name")
	cmd.Flags().StringVar(&instruction, "instruction", "", "Skill instruction")
	cmd.Flags().StringVar(&description, "description", "", "Skill description")
	cmd.Flags().StringVar(&icon, "icon", "", "Skill icon")

	return cmd
}

func newSkillsRemoveCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "remove [id]",
		Short: "Remove a skill",
		Long:  "Remove an agent skill.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			skillID := args[0]
			_, err = c.DELETE("/api/replit/ai/skills/" + skillID)
			if err != nil {
				return err
			}

			fmt.Printf("Skill %s removed successfully\n", skillID)
			return nil
		},
	}
}

func newSkillsLibraryCmd() *cobra.Command {
	var search string
	var category string
	var top int

	cmd := &cobra.Command{
		Use:   "library",
		Short: "Browse skill library",
		Long:  "Browse and search the skill library.",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := client.NewClient()
			if err != nil {
				return err
			}

			path := "/api/replit/ai/skills/library"
			params := []string{}
			if search != "" {
				params = append(params, "search="+search)
			}
			if category != "" {
				params = append(params, "category="+category)
			}
			if top > 0 {
				params = append(params, fmt.Sprintf("top=%d", top))
			}
			if len(params) > 0 {
				path += "?" + strings.Join(params, "&")
			}

			resp, err := c.GET(path)
			if err != nil {
				return err
			}

			var result interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}

			data, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(data))
			return nil
		},
	}

	cmd.Flags().StringVar(&search, "search", "", "Search query")
	cmd.Flags().StringVar(&category, "category", "", "Filter by category")
	cmd.Flags().IntVar(&top, "top", 0, "Number of top results")

	return cmd
}

func newIDEGitCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "git",
		Short: "Git operations",
		Long:  "Git operations for workspace management. Requires --workspace flag.",
	}

	cmd.AddCommand(newGitStatusCmd())
	cmd.AddCommand(newGitInitCmd())
	cmd.AddCommand(newGitAddCmd())
	cmd.AddCommand(newGitCommitCmd())
	cmd.AddCommand(newGitLogCmd())
	cmd.AddCommand(newGitDiffCmd())
	cmd.AddCommand(newGitBranchCmd())
	cmd.AddCommand(newGitCheckoutCmd())
	cmd.AddCommand(newGitRemoteCmd())

	return cmd
}

func shellEscape(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

func gitExecCmd(workspace, gitCmd string) error {
	c, err := client.NewClient()
	if err != nil {
		return err
	}
	body := map[string]interface{}{
		"command":    gitCmd,
		"timeout_ms": 30000,
	}
	resp, err := c.POST("/api/replit/container/"+workspace+"/exec", body)
	if err != nil {
		return err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(resp.Body, &result); err != nil {
		if len(resp.Body) > 0 {
			return fmt.Errorf("unexpected response: %s", string(resp.Body))
		}
		return fmt.Errorf("empty response from server")
	}
	if output, ok := result["output"].(string); ok {
		fmt.Print(output)
	}
	if stderr, ok := result["stderr"].(string); ok && stderr != "" {
		fmt.Fprint(os.Stderr, stderr)
	}
	return nil
}

func newGitStatusCmd() *cobra.Command {
	var workspace string
	cmd := &cobra.Command{
		Use:   "status",
		Short: "Show working tree status",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" { return fmt.Errorf("--workspace is required") }
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return gitExecCmd(workspace, "git status")
		},
	}
	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	return cmd
}

func newGitInitCmd() *cobra.Command {
	var workspace string
	cmd := &cobra.Command{
		Use:   "init",
		Short: "Initialize a new git repository",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" { return fmt.Errorf("--workspace is required") }
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return gitExecCmd(workspace, "git init")
		},
	}
	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	return cmd
}

func newGitAddCmd() *cobra.Command {
	var workspace string
	var all bool
	cmd := &cobra.Command{
		Use:   "add [files...]",
		Short: "Add files to the staging area",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" { return fmt.Errorf("--workspace is required") }
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			gitCmd := "git add"
			if all || len(args) == 0 {
				gitCmd += " ."
			} else {
				for _, a := range args {
					gitCmd += " " + shellEscape(a)
				}
			}
			return gitExecCmd(workspace, gitCmd)
		},
	}
	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	cmd.Flags().BoolVarP(&all, "all", "A", false, "Stage all files")
	return cmd
}

func newGitCommitCmd() *cobra.Command {
	var workspace string
	var message string
	cmd := &cobra.Command{
		Use:   "commit",
		Short: "Create a new commit",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" { return fmt.Errorf("--workspace is required") }
			if message == "" { return fmt.Errorf("--message is required") }
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return gitExecCmd(workspace, "git commit -m "+shellEscape(message))
		},
	}
	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	cmd.Flags().StringVarP(&message, "message", "m", "", "Commit message (required)")
	return cmd
}

func newGitLogCmd() *cobra.Command {
	var workspace string
	var limit int
	cmd := &cobra.Command{
		Use:   "log",
		Short: "Show commit history",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" { return fmt.Errorf("--workspace is required") }
			if limit < 1 { limit = 10 }
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return gitExecCmd(workspace, fmt.Sprintf("git log --oneline -%d", limit))
		},
	}
	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	cmd.Flags().IntVarP(&limit, "limit", "n", 10, "Number of commits to show")
	return cmd
}

func newGitDiffCmd() *cobra.Command {
	var workspace string
	var staged bool
	cmd := &cobra.Command{
		Use:   "diff",
		Short: "Show file changes",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" { return fmt.Errorf("--workspace is required") }
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			gitCmd := "git diff"
			if staged {
				gitCmd += " --cached"
			}
			return gitExecCmd(workspace, gitCmd)
		},
	}
	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	cmd.Flags().BoolVar(&staged, "staged", false, "Show staged changes")
	return cmd
}

func newGitBranchCmd() *cobra.Command {
	var workspace string
	var create string
	cmd := &cobra.Command{
		Use:   "branch [name]",
		Short: "List or create branches",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" { return fmt.Errorf("--workspace is required") }
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if create != "" {
				return gitExecCmd(workspace, "git branch "+shellEscape(create))
			}
			if len(args) > 0 {
				return gitExecCmd(workspace, "git branch "+shellEscape(args[0]))
			}
			return gitExecCmd(workspace, "git branch")
		},
	}
	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	cmd.Flags().StringVar(&create, "create", "", "Create a new branch with this name")
	return cmd
}

func newGitCheckoutCmd() *cobra.Command {
	var workspace string
	cmd := &cobra.Command{
		Use:   "checkout [branch]",
		Short: "Switch to a branch",
		Args:  cobra.ExactArgs(1),
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" { return fmt.Errorf("--workspace is required") }
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return gitExecCmd(workspace, "git checkout "+shellEscape(args[0]))
		},
	}
	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	return cmd
}

func newGitRemoteCmd() *cobra.Command {
	var workspace string
	cmd := &cobra.Command{
		Use:   "remote",
		Short: "Manage remote repositories",
	}
	addCmd := &cobra.Command{
		Use:   "add [name] [url]",
		Short: "Add a remote",
		Args:  cobra.ExactArgs(2),
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" { return fmt.Errorf("--workspace is required") }
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return gitExecCmd(workspace, "git remote add "+shellEscape(args[0])+" "+shellEscape(args[1]))
		},
	}
	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List remotes",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if workspace == "" { return fmt.Errorf("--workspace is required") }
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return gitExecCmd(workspace, "git remote -v")
		},
	}
	addCmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	listCmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	cmd.AddCommand(addCmd, listCmd)
	cmd.Flags().StringVar(&workspace, "workspace", "", "Workspace ID (required)")
	return cmd
}

func newIDELspCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "lsp",
		Short: "Language server features",
		Long:  "Language server protocol features: diagnostics, completions, hover, definition, references, formatting.",
	}

	cmd.AddCommand(newLspDiagnosticsCmd())
	cmd.AddCommand(newLspCompleteCmd())
	cmd.AddCommand(newLspHoverCmd())
	cmd.AddCommand(newLspDefinitionCmd())
	cmd.AddCommand(newLspReferencesCmd())
	cmd.AddCommand(newLspFormatCmd())

	return cmd
}

func detectLanguage(filePath string) string {
	ext := filePath
	if i := strings.LastIndex(filePath, "."); i >= 0 {
		ext = filePath[i+1:]
	}
	switch ext {
	case "py":
		return "python"
	case "css", "scss", "less":
		return "css"
	case "html", "htm":
		return "html"
	case "json", "jsonc":
		return "json"
	case "md", "mdx":
		return "markdown"
	case "xml", "xsl", "xslt", "svg":
		return "xml"
	case "sql":
		return "sql"
	case "yaml", "yml":
		return "yaml"
	case "sh", "bash":
		return "bash"
	case "ts", "mts", "cts", "tsx":
		return "typescript"
	case "js", "mjs", "cjs", "jsx":
		return "javascript"
	default:
		return ext
	}
}

func lspRequestBody(language, filePath, content string, line, col *int) (map[string]interface{}, string) {
	if language == "" {
		language = detectLanguage(filePath)
	}
	body := map[string]interface{}{
		"language": language,
		"content":  content,
	}
	if line != nil && col != nil {
		body["line"] = *line
		body["col"] = *col
	}
	return body, language
}

func newLspDiagnosticsCmd() *cobra.Command {
	var file, language string
	cmd := &cobra.Command{
		Use:   "diagnostics --file <path>",
		Short: "Get diagnostics (errors/warnings) for a file",
		RunE: func(cmd *cobra.Command, args []string) error {
			if file == "" { return fmt.Errorf("--file is required") }
			data, err := os.ReadFile(file)
			if err != nil { return fmt.Errorf("reading file: %w", err) }
			body, _ := lspRequestBody(language, file, string(data), nil, nil)
			c, err := client.NewClient()
			if err != nil { return err }
			resp, err := c.POST("/api/lsp/diagnostics", body)
			if err != nil { return err }
			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}
			diags, _ := result["diagnostics"].([]interface{})
			if len(diags) == 0 {
				output.PrintSuccess("No diagnostics found")
				return nil
			}
			for _, d := range diags {
				diag, _ := d.(map[string]interface{})
				msg, _ := diag["message"].(string)
				severity, _ := diag["severity"].(float64)
				sev := "INFO"
				switch severity {
				case 1: sev = output.Red("ERROR")
				case 2: sev = output.Yellow("WARN")
				case 3: sev = output.Cyan("INFO")
				case 4: sev = output.Cyan("Hint")
				}
				range_ := diag["range"].(map[string]interface{})
				start := range_["start"].(map[string]interface{})
				line, _ := start["line"].(float64)
				char, _ := start["character"].(float64)
				fmt.Printf("  %s [%d:%d] %s\n", sev, int(line)+1, int(char)+1, msg)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&file, "file", "", "File path (required)")
	cmd.Flags().StringVar(&language, "language", "", "Language override (auto-detected from extension)")
	return cmd
}

func newLspCompleteCmd() *cobra.Command {
	var file, language string
	var line, col int
	cmd := &cobra.Command{
		Use:   "complete --file <path> --line <n> --col <n>",
		Short: "Get code completions at a position",
		RunE: func(cmd *cobra.Command, args []string) error {
			if file == "" { return fmt.Errorf("--file is required") }
			data, err := os.ReadFile(file)
			if err != nil { return fmt.Errorf("reading file: %w", err) }
			body, _ := lspRequestBody(language, file, string(data), &line, &col)
			c, err := client.NewClient()
			if err != nil { return err }
			resp, err := c.POST("/api/lsp/completions", body)
			if err != nil { return err }
			var result interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}
			switch r := result.(type) {
			case map[string]interface{}:
				items, _ := r["items"].([]interface{})
				for _, item := range items {
					it, _ := item.(map[string]interface{})
					label, _ := it["label"].(string)
					detail, _ := it["detail"].(string)
					if detail != "" {
						fmt.Printf("  %s  %s\n", label, output.Cyan(detail))
					} else {
						fmt.Printf("  %s\n", label)
					}
				}
			case []interface{}:
				for _, item := range r {
					it, _ := item.(map[string]interface{})
					label, _ := it["label"].(string)
					fmt.Printf("  %s\n", label)
				}
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&file, "file", "", "File path (required)")
	cmd.Flags().StringVar(&language, "language", "", "Language override")
	cmd.Flags().IntVar(&line, "line", 0, "Line number (0-indexed)")
	cmd.Flags().IntVar(&col, "col", 0, "Column number (0-indexed)")
	return cmd
}

func newLspHoverCmd() *cobra.Command {
	var file, language string
	var line, col int
	cmd := &cobra.Command{
		Use:   "hover --file <path> --line <n> --col <n>",
		Short: "Show hover information at a position",
		RunE: func(cmd *cobra.Command, args []string) error {
			if file == "" { return fmt.Errorf("--file is required") }
			data, err := os.ReadFile(file)
			if err != nil { return fmt.Errorf("reading file: %w", err) }
			body, _ := lspRequestBody(language, file, string(data), &line, &col)
			c, err := client.NewClient()
			if err != nil { return err }
			resp, err := c.POST("/api/lsp/hover", body)
			if err != nil { return err }
			var result map[string]interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}
			if result == nil {
				output.PrintInfo("No hover information")
				return nil
			}
			contents := result["contents"]
			if contents == nil {
				output.PrintInfo("No hover information")
				return nil
			}
			switch c := contents.(type) {
			case string:
				fmt.Println(c)
			case map[string]interface{}:
				fmt.Println(c["value"])
			case []interface{}:
				for _, item := range c {
					if m, ok := item.(map[string]interface{}); ok {
						if v, ok := m["value"].(string); ok {
							fmt.Println(v)
						}
					} else if s, ok := item.(string); ok {
						fmt.Println(s)
					}
				}
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&file, "file", "", "File path (required)")
	cmd.Flags().StringVar(&language, "language", "", "Language override")
	cmd.Flags().IntVar(&line, "line", 0, "Line number (0-indexed)")
	cmd.Flags().IntVar(&col, "col", 0, "Column number (0-indexed)")
	return cmd
}

func newLspDefinitionCmd() *cobra.Command {
	var file, language string
	var line, col int
	cmd := &cobra.Command{
		Use:   "definition --file <path> --line <n> --col <n>",
		Short: "Go to definition at a position",
		RunE: func(cmd *cobra.Command, args []string) error {
			if file == "" { return fmt.Errorf("--file is required") }
			data, err := os.ReadFile(file)
			if err != nil { return fmt.Errorf("reading file: %w", err) }
			body, _ := lspRequestBody(language, file, string(data), &line, &col)
			c, err := client.NewClient()
			if err != nil { return err }
			resp, err := c.POST("/api/lsp/definition", body)
			if err != nil { return err }
			var result interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}
			printLocation := func(loc map[string]interface{}) {
				uri, _ := loc["uri"].(string)
				range_ := loc["range"].(map[string]interface{})
				start := range_["start"].(map[string]interface{})
				l, _ := start["line"].(float64)
				c, _ := start["character"].(float64)
				fmt.Printf("  %s:%d:%d\n", strings.TrimPrefix(uri, "file://"), int(l)+1, int(c)+1)
			}
			switch r := result.(type) {
			case map[string]interface{}:
				printLocation(r)
			case []interface{}:
				for _, loc := range r {
					if m, ok := loc.(map[string]interface{}); ok {
						printLocation(m)
					}
				}
			case nil:
				output.PrintInfo("No definition found")
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&file, "file", "", "File path (required)")
	cmd.Flags().StringVar(&language, "language", "", "Language override")
	cmd.Flags().IntVar(&line, "line", 0, "Line number (0-indexed)")
	cmd.Flags().IntVar(&col, "col", 0, "Column number (0-indexed)")
	return cmd
}

func newLspReferencesCmd() *cobra.Command {
	var file, language string
	var line, col int
	cmd := &cobra.Command{
		Use:   "references --file <path> --line <n> --col <n>",
		Short: "Find all references at a position",
		RunE: func(cmd *cobra.Command, args []string) error {
			if file == "" { return fmt.Errorf("--file is required") }
			data, err := os.ReadFile(file)
			if err != nil { return fmt.Errorf("reading file: %w", err) }
			body, _ := lspRequestBody(language, file, string(data), &line, &col)
			c, err := client.NewClient()
			if err != nil { return err }
			resp, err := c.POST("/api/lsp/references", body)
			if err != nil { return err }
			var result []interface{}
			if err := json.Unmarshal(resp.Body, &result); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}
			if len(result) == 0 {
				output.PrintInfo("No references found")
				return nil
			}
			for _, ref := range result {
				loc, _ := ref.(map[string]interface{})
				uri, _ := loc["uri"].(string)
				range_ := loc["range"].(map[string]interface{})
				start := range_["start"].(map[string]interface{})
				l, _ := start["line"].(float64)
				c, _ := start["character"].(float64)
				fmt.Printf("  %s:%d:%d\n", strings.TrimPrefix(uri, "file://"), int(l)+1, int(c)+1)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&file, "file", "", "File path (required)")
	cmd.Flags().StringVar(&language, "language", "", "Language override")
	cmd.Flags().IntVar(&line, "line", 0, "Line number (0-indexed)")
	cmd.Flags().IntVar(&col, "col", 0, "Column number (0-indexed)")
	return cmd
}

func newLspFormatCmd() *cobra.Command {
	var file, language string
	cmd := &cobra.Command{
		Use:   "format --file <path>",
		Short: "Format a file using the language server",
		RunE: func(cmd *cobra.Command, args []string) error {
			if file == "" { return fmt.Errorf("--file is required") }
			data, err := os.ReadFile(file)
			if err != nil { return fmt.Errorf("reading file: %w", err) }
			fileContent := string(data)
			body, _ := lspRequestBody(language, file, fileContent, nil, nil)
			c, err := client.NewClient()
			if err != nil { return err }
			resp, err := c.POST("/api/lsp/formatting", body)
			if err != nil { return err }
			var edits []interface{}
			if err := json.Unmarshal(resp.Body, &edits); err != nil {
				fmt.Println(string(resp.Body))
				return nil
			}
			if len(edits) == 0 {
				output.PrintInfo("No formatting changes")
				return nil
			}
			type textEdit struct {
				startLine, startChar, endLine, endChar int
				newText string
			}
			var parsedEdits []textEdit
			for _, e := range edits {
				edit, _ := e.(map[string]interface{})
				newText, _ := edit["newText"].(string)
				range_ := edit["range"].(map[string]interface{})
				start := range_["start"].(map[string]interface{})
				end := range_["end"].(map[string]interface{})
				startLine, _ := start["line"].(float64)
				startChar, _ := start["character"].(float64)
				endLine, _ := end["line"].(float64)
				endChar, _ := end["character"].(float64)
				parsedEdits = append(parsedEdits, textEdit{
					startLine: int(startLine), startChar: int(startChar),
					endLine: int(endLine), endChar: int(endChar),
					newText: newText,
				})
			}
			sort.Slice(parsedEdits, func(i, j int) bool {
				if parsedEdits[i].startLine != parsedEdits[j].startLine {
					return parsedEdits[i].startLine > parsedEdits[j].startLine
				}
				return parsedEdits[i].startChar > parsedEdits[j].startChar
			})
			lines := strings.Split(fileContent, "\n")
			for _, ed := range parsedEdits {
				if ed.startLine >= len(lines) { continue }
				startIdx := ed.startLine
				endIdx := ed.endLine
				if startIdx == endIdx {
					line := lines[startIdx]
					if ed.startChar > len(line) { ed.startChar = len(line) }
					if ed.endChar > len(line) { ed.endChar = len(line) }
					lines[startIdx] = line[:ed.startChar] + ed.newText + line[ed.endChar:]
				} else {
					if ed.startChar > len(lines[startIdx]) { ed.startChar = len(lines[startIdx]) }
					if endIdx < len(lines) && ed.endChar > len(lines[endIdx]) { ed.endChar = len(lines[endIdx]) }
					var endLine string
					if endIdx < len(lines) { endLine = lines[endIdx][ed.endChar:] }
					lines[startIdx] = lines[startIdx][:ed.startChar] + ed.newText + endLine
					lines = append(lines[:startIdx+1], lines[endIdx+1:]...)
				}
			}
			if err := os.WriteFile(file, []byte(strings.Join(lines, "\n")), 0644); err != nil {
				return fmt.Errorf("writing file: %w", err)
			}
			fmt.Printf("  %d formatting edits applied\n", len(edits))
			return nil
		},
	}
	cmd.Flags().StringVar(&file, "file", "", "File path (required)")
	cmd.Flags().StringVar(&language, "language", "", "Language override")
	return cmd
}

func newIDEScanCmd() *cobra.Command {
	var file string
	var severity string

	cmd := &cobra.Command{
		Use:   "scan",
		Short: "Scan project for vulnerabilities",
		Long:  "Scan project dependencies for known vulnerabilities.",
		RunE: func(cmd *cobra.Command, args []string) error {
			var vulnerablePackages = map[string]string{
				"lodash":           "Prototype Pollution - versions < 4.17.21",
				"minimist":         "Prototype Pollution - versions < 1.2.6",
				"node-fetch":       "Information Exposure - versions < 2.6.7",
				"axios":            "Server-Side Request Forgery - versions < 0.21.1",
				"express":          "Open Redirect - versions < 4.19.2",
				"jsonwebtoken":     "Insecure Default Algorithm - versions < 9.0.0",
				"ws":               "ReDoS - versions < 7.4.6",
				"semver":           "ReDoS - versions < 7.5.2",
				"tough-cookie":     "Prototype Pollution - versions < 4.1.3",
				"xml2js":           "Prototype Pollution - versions < 0.5.0",
				"request":          "Deprecated - use alternatives",
				"moment":           "Deprecated - use alternatives",
				"colors":           "Supply Chain Attack - versions == 1.4.1",
				"faker":            "Supply Chain Attack - versions == 6.6.6",
				"ua-parser-js":     "Supply Chain Attack - versions == 0.7.33",
				"cross-fetch":      "Information Exposure - versions < 3.1.5",
				"shell-quote":      "Command Injection - versions < 1.7.3",
				"follow-redirects": "Information Exposure - versions < 1.15.0",
				"path-to-regexp":   "ReDoS - versions < 6.2.0",
				"qs":               "Prototype Pollution - versions < 6.5.3",
				"flask":            "Security Update - versions < 2.0",
				"requests":         "Certificate Verification Bypass - versions < 2.20",
				"django":           "Multiple vulnerabilities - versions < 3.2",
				"jinja2":           "Sandbox Escape - versions < 3.1",
				"pyyaml":           "Arbitrary Code Execution - versions < 6.0",
				"cryptography":     "Security Update - versions < 3.4",
				"urllib3":          "CRLF Injection - versions < 1.26.5",
				"werkzeug":         "Debugger PIN Bypass - versions < 2.0",
				"pillow":           "Buffer Overflow - versions < 9.0",
				"sqlalchemy":       "SQL Injection - versions < 1.4",
			}

			var dependencies map[string]string

			if file != "" {
				data, err := os.ReadFile(file)
				if err != nil {
					return fmt.Errorf("reading file: %w", err)
				}

				var pkg map[string]interface{}
				if err := json.Unmarshal(data, &pkg); err != nil {
					return fmt.Errorf("parsing package.json: %w", err)
				}

				dependencies = make(map[string]string)
				if deps, ok := pkg["dependencies"].(map[string]interface{}); ok {
					for name, version := range deps {
						dependencies[name] = fmt.Sprintf("%v", version)
					}
				}
				if devDeps, ok := pkg["devDependencies"].(map[string]interface{}); ok {
					for name, version := range devDeps {
						dependencies[name] = fmt.Sprintf("%v", version)
					}
				}
			} else {
				if _, err := os.Stat("package.json"); err == nil {
					data, err := os.ReadFile("package.json")
					if err == nil {
						var pkg map[string]interface{}
						if json.Unmarshal(data, &pkg) == nil {
							dependencies = make(map[string]string)
							if deps, ok := pkg["dependencies"].(map[string]interface{}); ok {
								for name, version := range deps {
									dependencies[name] = fmt.Sprintf("%v", version)
								}
							}
							if devDeps, ok := pkg["devDependencies"].(map[string]interface{}); ok {
								for name, version := range devDeps {
									dependencies[name] = fmt.Sprintf("%v", version)
								}
							}
						}
					}
				} else if _, err := os.Stat("requirements.txt"); err == nil {
					data, err := os.ReadFile("requirements.txt")
					if err == nil {
						dependencies = make(map[string]string)
						scanner := bufio.NewScanner(strings.NewReader(string(data)))
						for scanner.Scan() {
							line := strings.TrimSpace(scanner.Text())
							if line == "" || strings.HasPrefix(line, "#") {
								continue
							}
							parts := strings.SplitN(line, ">=", 2)
							if len(parts) == 1 {
								parts = strings.SplitN(line, "==", 2)
							}
							if len(parts) == 1 {
								parts = strings.SplitN(line, "<=", 2)
							}
							if len(parts) == 1 {
								parts = strings.SplitN(line, "~=", 2)
							}
							if len(parts) == 2 {
								dependencies[parts[0]] = parts[1]
							} else {
								dependencies[line] = "*"
							}
						}
					}
				}
			}

			if len(dependencies) == 0 {
				fmt.Println("No dependencies found. Place a package.json or requirements.txt in the current directory.")
				return nil
			}

			fmt.Printf("Scanning %d dependencies...\n\n", len(dependencies))

			found := false
			for name, version := range dependencies {
				if vuln, ok := vulnerablePackages[name]; ok {
					if severity != "" && !strings.Contains(strings.ToLower(vuln), strings.ToLower(severity)) {
						continue
					}
					fmt.Printf("VULNERABLE: %s@%s\n", name, version)
					fmt.Printf("  Issue: %s\n\n", vuln)
					found = true
				}
			}

			if !found {
				fmt.Println("No known vulnerabilities found.")
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&file, "file", "", "Package file to scan")
	cmd.Flags().StringVar(&severity, "severity", "", "Filter by severity")

	return cmd
}
