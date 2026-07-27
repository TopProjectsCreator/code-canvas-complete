package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/codecanvas/cli/internal/client"
	"github.com/codecanvas/cli/internal/config"
	"github.com/codecanvas/cli/internal/output"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

func NewAuthCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Manage authentication with Code Canvas",
		Long:  `Manage your authentication credentials for Code Canvas. Use "auth login" to authenticate, "auth status" to check your current session, and "auth logout" to clear stored credentials.`,
	}

	cmd.AddCommand(newAuthLoginCmd())
	cmd.AddCommand(newAuthStatusCmd())
	cmd.AddCommand(newAuthLogoutCmd())

	return cmd
}

func newAuthLoginCmd() *cobra.Command {
	var token string
	var email string
	var noBrowser bool

	cmd := &cobra.Command{
		Use:   "login",
		Short: "Log in to Code Canvas",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("loading config: %w", err)
			}

			if token != "" {
				if err := config.SetToken(token, "", 0); err != nil {
					return fmt.Errorf("saving token: %w", err)
				}
				output.PrintSuccess("Successfully logged in with token.")
				return nil
			}

			if email != "" {
				fmt.Print("Password: ")
				password, err := term.ReadPassword(int(os.Stdin.Fd()))
				fmt.Println()
				if err != nil {
					return fmt.Errorf("reading password: %w", err)
				}

				c, err := client.NewClient()
				if err != nil {
					return fmt.Errorf("creating client: %w", err)
				}

				resp, err := c.Post("/api/oauth/token/refresh", map[string]string{
					"email":         email,
					"refresh_token": string(password),
				})
				if err != nil {
					return fmt.Errorf("authenticating: %w", err)
				}

				var authResp struct {
					AccessToken  string `json:"access_token"`
					RefreshToken string `json:"refresh_token"`
					ExpiresIn    int64  `json:"expires_in"`
				}
				if err := json.Unmarshal(resp, &authResp); err != nil {
					return fmt.Errorf("parsing response: %w", err)
				}

				if err := config.SetToken(authResp.AccessToken, authResp.RefreshToken, time.Duration(authResp.ExpiresIn)*time.Second); err != nil {
					return fmt.Errorf("saving token: %w", err)
				}

				output.PrintSuccess("Successfully logged in.")
				return nil
			}

			if noBrowser {
				output.PrintInfo(fmt.Sprintf("Open the following URL in your browser to log in:\n\n  %s/auth-bridge\n", cfg.ServerURL))
				return nil
			}

			output.PrintInfo(fmt.Sprintf("To log in, open the following URL in your browser:\n\n  %s/auth-bridge\n\n", cfg.ServerURL))
			output.PrintInfo("After authenticating, use 'cc auth login --token <token>' to complete login.")
			return nil
		},
	}

	cmd.Flags().StringVar(&token, "token", "", "API token for authentication")
	cmd.Flags().StringVar(&email, "email", "", "Email address for authentication")
	cmd.Flags().BoolVar(&noBrowser, "no-browser", false, "Print URL instead of opening browser")

	return cmd
}

func newAuthStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show current authentication status",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("loading config: %w", err)
			}

			token, err := config.GetToken()
			if err != nil {
				output.PrintWarning("Not logged in")
				return nil
			}

			prefix := token
			if len(prefix) > 12 {
				prefix = prefix[:12] + "..."
			}

			output.PrintInfo(fmt.Sprintf("Logged in\n  Token:   %s\n  Server:  %s", prefix, cfg.ServerURL))

			return nil
		},
	}
}

func newAuthLogoutCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Clear stored credentials",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := config.ClearToken(); err != nil {
				return fmt.Errorf("clearing token: %w", err)
			}

			output.PrintSuccess("Successfully logged out.")
			return nil
		},
	}
}
