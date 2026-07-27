package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/codecanvas/cli/internal/client"
	"github.com/codecanvas/cli/internal/output"
	"github.com/spf13/cobra"
)

var redactorPatterns = []struct {
	name  string
	regex *regexp.Regexp
}{
	{"EMAIL", regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)},
	{"PHONE", regexp.MustCompile(`\+?[\d\s\-\(\)]{7,15}`)},
	{"SSN", regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`)},
	{"CREDIT_CARD", regexp.MustCompile(`\b(?:\d[ -]*?){13,16}\b`)},
	{"API_KEY_OPENAI", regexp.MustCompile(`\bsk-proj-[A-Za-z0-9_-]{20,}\b`)},
	{"API_KEY_OPENAI_LEGACY", regexp.MustCompile(`\bsk-[A-Za-z0-9]{20,}\b`)},
	{"API_KEY_ANTHROPIC", regexp.MustCompile(`\bsk-ant-[A-Za-z0-9_-]{20,}\b`)},
	{"API_KEY_GOOGLE", regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{35}\b`)},
	{"API_KEY_AWS", regexp.MustCompile(`\b(?:AKIA|ASIA)[0-9A-Z]{16}\b`)},
	{"API_KEY_GITHUB", regexp.MustCompile(`\bgh[pousr]_[A-Za-z0-9]{30,}\b`)},
	{"API_KEY_STRIPE", regexp.MustCompile(`\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b`)},
	{"API_KEY_GROQ", regexp.MustCompile(`\bgsk_[A-Za-z0-9]{20,}\b`)},
	{"API_KEY_PERPLEXITY", regexp.MustCompile(`\bpplx-[A-Za-z0-9]{20,}\b`)},
	{"API_KEY_REPLICATE", regexp.MustCompile(`\br8_[A-Za-z0-9]{30,}\b`)},
	{"API_KEY_OPENROUTER", regexp.MustCompile(`\bsk-or-[A-Za-z0-9-]{20,}\b`)},
	{"PRIVATE_KEY", regexp.MustCompile(`-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----`)},
	{"IP_ADDRESS", regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`)},
	{"JWT", regexp.MustCompile(`eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+`)},
}

func redactText(text string) (string, map[string]string) {
	counter := make(map[string]int)
	redactions := make(map[string]string)
	result := text

	for _, p := range redactorPatterns {
		result = p.regex.ReplaceAllStringFunc(result, func(match string) string {
			key := fmt.Sprintf("[%s_%d]", p.name, counter[p.name]+1)
			counter[p.name]++
			redactions[key] = match
			return key
		})
	}

	return result, redactions
}

func NewRedactorCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "redactor",
		Short: "Redactor API gateway tools for PII redaction and AI proxy management",
		Long: `The Redactor is an AI API gateway that detects and redacts sensitive data
(API keys, emails, credit cards, passwords, etc.) before sending requests
to AI providers, then rehydrates responses.

Use these commands to manage proxy keys, provider keys, redaction rules,
request logs, and model routers.`,
	}

	cmd.AddCommand(newProxyKeysCmd())
	cmd.AddCommand(newProviderKeysCmd())
	cmd.AddCommand(newRedactorRulesCmd())
	cmd.AddCommand(newRedactorLogsCmd())
	cmd.AddCommand(newRedactorRoutersCmd())
	cmd.AddCommand(newRedactorRedactCmd())

	return cmd
}

func newProxyKeysCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "proxy-keys",
		Short: "Manage proxy keys for external applications",
		Long: `Proxy keys (prefixed lvp_live_*) allow external apps to use the Redactor
proxy without exposing your real provider API keys. Each key can be
rate-limited, restricted to specific providers, and revoked at any time.`,
	}

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List all proxy keys",
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewFromFlags(cmd)
			data, err := c.Get("/api/oauth/redactor/proxy-keys")
			if err != nil {
				return fmt.Errorf("failed to list proxy keys: %w", err)
			}
			var keys []map[string]interface{}
			if err := json.Unmarshal(data, &keys); err != nil {
				return err
			}
			output.PrintTable(
				[]string{"ID", "NAME", "PREFIX", "STATUS", "RATE LIMIT", "CREATED"},
				proxyKeysToRows(keys),
			)
			return nil
		},
	}

	createCmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new proxy key",
		RunE: func(cmd *cobra.Command, args []string) error {
			name, _ := cmd.Flags().GetString("name")
			providers, _ := cmd.Flags().GetString("providers")
			rateLimit, _ := cmd.Flags().GetInt("rate-limit")
			monthlyCap, _ := cmd.Flags().GetFloat64("monthly-cap")
			expiresAt, _ := cmd.Flags().GetString("expires-at")

			if name == "" {
				return fmt.Errorf("--name is required")
			}

			body := map[string]interface{}{"name": name}
			if providers != "" {
				body["allowed_providers"] = strings.Split(providers, ",")
			}
			if rateLimit > 0 {
				body["rate_limit_rpm"] = rateLimit
			}
			if monthlyCap > 0 {
				body["monthly_cap_usd"] = monthlyCap
			}
			if expiresAt != "" {
				body["expires_at"] = expiresAt
			}

			c := client.NewFromFlags(cmd)
			data, err := c.Post("/api/oauth/redactor/proxy-keys", body)
			if err != nil {
				return fmt.Errorf("failed to create proxy key: %w", err)
			}

			var result map[string]interface{}
			json.Unmarshal(data, &result)

			output.PrintSuccess("Proxy key created successfully!")
			fmt.Println()
			if key, ok := result["key"].(string); ok {
				output.PrintWarning("Store this key securely — it will not be shown again:")
				fmt.Printf("  %s\n\n", key)
			}
			output.PrintTable(
				[]string{"ID", "NAME", "PREFIX"},
				[][]string{
					{fmt.Sprint(result["id"]), fmt.Sprint(result["name"]), fmt.Sprint(result["prefix"])},
				},
			)
			return nil
		},
	}
	createCmd.Flags().String("name", "", "Key name (required)")
	createCmd.Flags().String("providers", "", "Comma-separated allowed providers")
	createCmd.Flags().Int("rate-limit", 0, "Max requests per minute")
	createCmd.Flags().Float64("monthly-cap", 0, "Monthly spend cap in USD")
	createCmd.Flags().String("expires-at", "", "Expiration time (RFC3339)")

	revokeCmd := &cobra.Command{
		Use:   "revoke [key-id]",
		Short: "Revoke a proxy key",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewFromFlags(cmd)
			_, err := c.Post("/api/oauth/redactor/proxy-keys/"+args[0]+"/revoke", nil)
			if err != nil {
				return fmt.Errorf("failed to revoke proxy key: %w", err)
			}
			output.PrintSuccess("Proxy key revoked successfully")
			return nil
		},
	}

	cmd.AddCommand(listCmd, createCmd, revokeCmd)
	return cmd
}

func proxyKeysToRows(keys []map[string]interface{}) [][]string {
	rows := make([][]string, len(keys))
	now := time.Now()
	for i, k := range keys {
		status := "active"
		if k["revoked_at"] != nil {
			status = "revoked"
		}
		if exp, ok := k["expires_at"].(string); ok && exp != "" {
			if t, err := time.Parse(time.RFC3339, exp); err == nil && t.Before(now) {
				status = "expired"
			}
		}
		rateLimit := "unlimited"
		if v, ok := k["rate_limit_rpm"].(float64); ok && v > 0 {
			rateLimit = fmt.Sprintf("%.0f rpm", v)
		}
		rows[i] = []string{
			fmt.Sprint(k["id"]),
			fmt.Sprint(k["name"]),
			fmt.Sprint(k["key_prefix"]),
			status,
			rateLimit,
			fmt.Sprint(k["created_at"]),
		}
	}
	return rows
}

func newProviderKeysCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "provider-keys",
		Short: "Manage upstream AI provider API keys",
		Long: `Store encrypted API keys for AI providers (OpenAI, Anthropic, Gemini, etc.)
that the Redactor proxy uses to forward requests.`,
	}

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List all provider keys",
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			data, err := c.Query("redactor_provider_keys", "id,provider,label,base_url,created_at", nil, "created_at", 100)
			if err != nil {
				return fmt.Errorf("failed to list provider keys: %w", err)
			}
			rows := make([][]string, len(data))
			for i, r := range data {
				baseURL := fmt.Sprint(r["base_url"])
				if baseURL == "<nil>" {
					baseURL = ""
				}
				rows[i] = []string{
					fmt.Sprint(r["id"]),
					fmt.Sprint(r["provider"]),
					fmt.Sprint(r["label"]),
					baseURL,
					fmt.Sprint(r["created_at"]),
				}
			}
			output.PrintTable([]string{"ID", "PROVIDER", "LABEL", "BASE URL", "CREATED"}, rows)
			return nil
		},
	}

	addCmd := &cobra.Command{
		Use:   "add",
		Short: "Add or update a provider key",
		RunE: func(cmd *cobra.Command, args []string) error {
			provider, _ := cmd.Flags().GetString("provider")
			label, _ := cmd.Flags().GetString("label")
			apiKey, _ := cmd.Flags().GetString("api-key")
			baseURL, _ := cmd.Flags().GetString("base-url")

			if provider == "" || label == "" || apiKey == "" {
				return fmt.Errorf("--provider, --label, and --api-key are required")
			}

			c := client.NewSupabaseFromFlags(cmd)
			data := map[string]interface{}{
				"provider": provider,
				"label":    label,
				"api_key":  apiKey,
			}
			if baseURL != "" {
				data["base_url"] = baseURL
			}
			_, err := c.Insert("redactor_provider_keys", data)
			if err != nil {
				return fmt.Errorf("failed to add provider key: %w", err)
			}
			output.PrintSuccess("Provider key added successfully")
			return nil
		},
	}
	addCmd.Flags().String("provider", "", "Provider name (required)")
	addCmd.Flags().String("label", "", "Label (required)")
	addCmd.Flags().String("api-key", "", "API key value (required)")
	addCmd.Flags().String("base-url", "", "Custom API base URL")

	deleteCmd := &cobra.Command{
		Use:   "delete [key-id]",
		Short: "Delete a provider key",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			if err := c.Delete("redactor_provider_keys", args[0]); err != nil {
				return fmt.Errorf("failed to delete provider key: %w", err)
			}
			output.PrintSuccess("Provider key deleted")
			return nil
		},
	}

	cmd.AddCommand(listCmd, addCmd, deleteCmd)
	return cmd
}

func newRedactorRulesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "rules",
		Short: "Manage custom redaction rules",
		Long: `Custom rules define regex patterns that the Redactor detects and replaces.
Use these to redact company-specific data like internal IDs or custom
credential formats.`,
	}

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List all custom rules",
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			data, err := c.Query("redactor_redaction_rules", "*", nil, "created_at", 100)
			if err != nil {
				return fmt.Errorf("failed to list rules: %w", err)
			}
			rows := make([][]string, len(data))
			for i, r := range data {
				enabled := "yes"
				if v, ok := r["enabled"].(bool); ok && !v {
					enabled = "no"
				}
				rows[i] = []string{
					fmt.Sprint(r["id"]),
					fmt.Sprint(r["pattern"]),
					fmt.Sprint(r["label"]),
					enabled,
					fmt.Sprint(r["created_at"]),
				}
			}
			output.PrintTable([]string{"ID", "PATTERN", "LABEL", "ENABLED", "CREATED"}, rows)
			return nil
		},
	}

	addCmd := &cobra.Command{
		Use:   "add",
		Short: "Add a new redaction rule",
		RunE: func(cmd *cobra.Command, args []string) error {
			pattern, _ := cmd.Flags().GetString("pattern")
			label, _ := cmd.Flags().GetString("label")
			if pattern == "" || label == "" {
				return fmt.Errorf("--pattern and --label are required")
			}
			if _, err := regexp.Compile(pattern); err != nil {
				return fmt.Errorf("invalid regex pattern: %w", err)
			}
			c := client.NewSupabaseFromFlags(cmd)
			_, err := c.Insert("redactor_redaction_rules", map[string]interface{}{
				"pattern": pattern,
				"label":   label,
				"enabled": true,
			})
			if err != nil {
				return fmt.Errorf("failed to add rule: %w", err)
			}
			output.PrintSuccess("Rule added successfully")
			return nil
		},
	}
	addCmd.Flags().String("pattern", "", "Regex pattern (required)")
	addCmd.Flags().String("label", "", "Label (required)")

	deleteCmd := &cobra.Command{
		Use:   "delete [rule-id]",
		Short: "Delete a rule",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			if err := c.Delete("redactor_redaction_rules", args[0]); err != nil {
				return fmt.Errorf("failed to delete rule: %w", err)
			}
			output.PrintSuccess("Rule deleted")
			return nil
		},
	}

	cmd.AddCommand(listCmd, addCmd, deleteCmd)
	return cmd
}

func newRedactorLogsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "logs",
		Short: "View request logs and usage statistics",
	}

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List recent request logs",
		RunE: func(cmd *cobra.Command, args []string) error {
			provider, _ := cmd.Flags().GetString("provider")
			model, _ := cmd.Flags().GetString("model")
			limit, _ := cmd.Flags().GetInt("limit")

			c := client.NewSupabaseFromFlags(cmd)
			var filters []string
			if provider != "" {
				filters = append(filters, "provider=eq."+provider)
			}
			if model != "" {
				filters = append(filters, "model=ilike.*"+model+"*")
			}
			data, err := c.Query("redactor_request_logs", "*", filters, "created_at", limit)
			if err != nil {
				return fmt.Errorf("failed to list logs: %w", err)
			}
			rows := make([][]string, len(data))
			for i, r := range data {
				rows[i] = []string{
					fmt.Sprint(r["created_at"]),
					fmt.Sprint(r["provider"]),
					fmt.Sprint(r["model"]),
					fmt.Sprintf("%v", r["status"]),
					fmt.Sprintf("%v", r["input_tokens"]),
					fmt.Sprintf("%v", r["output_tokens"]),
					fmt.Sprint(r["cost_usd"]),
				}
			}
			output.PrintTable([]string{"TIME", "PROVIDER", "MODEL", "STATUS", "IN", "OUT", "COST"}, rows)
			return nil
		},
	}
	listCmd.Flags().String("provider", "", "Filter by provider")
	listCmd.Flags().String("model", "", "Filter by model")
	listCmd.Flags().Int("limit", 25, "Number of logs")

	statsCmd := &cobra.Command{
		Use:   "stats",
		Short: "Show monthly usage statistics",
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			now := time.Now()
			start := fmt.Sprintf("%d-%02d-01T00:00:00Z", now.Year(), now.Month())
			data, err := c.Query("redactor_request_logs", "*", []string{"created_at=gte." + start}, "", 10000)
			if err != nil {
				return fmt.Errorf("failed to get stats: %w", err)
			}
			totalRequests := len(data)
			var totalTokens int
			var totalCost float64
			for _, r := range data {
				if v, ok := r["input_tokens"].(float64); ok {
					totalTokens += int(v)
				}
				if v, ok := r["output_tokens"].(float64); ok {
					totalTokens += int(v)
				}
				if v, ok := r["cost_usd"].(float64); ok {
					totalCost += v
				}
			}
			output.PrintTable(
				[]string{"METRIC", "VALUE"},
				[][]string{
					{"Total Requests", fmt.Sprintf("%d", totalRequests)},
					{"Total Tokens", fmt.Sprintf("%d", totalTokens)},
					{"Total Cost USD", fmt.Sprintf("$%.4f", totalCost)},
				},
			)
			return nil
		},
	}

	cmd.AddCommand(listCmd, statsCmd)
	return cmd
}

func newRedactorRoutersCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "routers",
		Short: "Manage model routers with automatic fallback",
		Long: `Model routers define an ordered list of providers/models. If the first
choice fails, the Redactor automatically tries the next step.`,
	}

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List all routers",
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			data, err := c.Query("redactor_model_routers", "*", nil, "created_at", 100)
			if err != nil {
				return fmt.Errorf("failed to list routers: %w", err)
			}
			rows := make([][]string, len(data))
			for i, r := range data {
				rows[i] = []string{
					fmt.Sprint(r["id"]),
					fmt.Sprint(r["name"]),
					fmt.Sprint(r["fallback_on"]),
					fmt.Sprint(r["created_at"]),
				}
			}
			output.PrintTable([]string{"ID", "NAME", "FALLBACK", "CREATED"}, rows)
			return nil
		},
	}

	createCmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new router",
		RunE: func(cmd *cobra.Command, args []string) error {
			name, _ := cmd.Flags().GetString("name")
			fallbackOn, _ := cmd.Flags().GetString("fallback-on")
			if name == "" {
				return fmt.Errorf("--name is required")
			}
			if fallbackOn == "" {
				fallbackOn = "all"
			}
			c := client.NewSupabaseFromFlags(cmd)
			_, err := c.Insert("redactor_model_routers", map[string]interface{}{
				"name":         name,
				"fallback_on":  fallbackOn,
			})
			if err != nil {
				return fmt.Errorf("failed to create router: %w", err)
			}
			output.PrintSuccess("Router created successfully")
			return nil
		},
	}
	createCmd.Flags().String("name", "", "Router name (required)")
	createCmd.Flags().String("fallback-on", "all", "Fallback trigger: all, status-code")

	deleteCmd := &cobra.Command{
		Use:   "delete [router-id]",
		Short: "Delete a router",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewSupabaseFromFlags(cmd)
			if err := c.Delete("redactor_model_routers", args[0]); err != nil {
				return fmt.Errorf("failed to delete router: %w", err)
			}
			output.PrintSuccess("Router deleted")
			return nil
		},
	}

	cmd.AddCommand(listCmd, createCmd, deleteCmd)
	return cmd
}

func newRedactorRedactCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "redact",
		Short: "Redact PII from text through the Redactor",
		Long: `Sends text through the Redactor which detects and replaces sensitive
data (API keys, emails, credit cards, passwords, etc.) with numbered
tokens like [EMAIL_1], [SECRET_2].`,
	}

	textCmd := &cobra.Command{
		Use:   "text [text]",
		Short: "Redact PII from a text string",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			var text string
			file, _ := cmd.Flags().GetString("file")
			if file != "" {
				data, err := os.ReadFile(file)
				if err != nil {
					return fmt.Errorf("failed to read file: %w", err)
				}
				text = string(data)
			} else if len(args) > 0 {
				text = args[0]
			} else {
				return fmt.Errorf("provide text as argument or use --file")
			}

			showMap, _ := cmd.Flags().GetBool("show-map")
			redacted, redactions := redactText(text)

			fmt.Println(redacted)
			if showMap && len(redactions) > 0 {
				fmt.Println()
				output.PrintWarning("Token mapping:")
				for token, original := range redactions {
					fmt.Printf("  %s = %s\n", token, original)
				}
			}
			return nil
		},
	}
	textCmd.Flags().String("file", "", "Read text from file")
	textCmd.Flags().Bool("show-map", false, "Show token-to-original mapping")

	pipeCmd := &cobra.Command{
		Use:   "pipe",
		Short: "Read from stdin, redact, write to stdout",
		RunE: func(cmd *cobra.Command, args []string) error {
			showMap, _ := cmd.Flags().GetBool("show-map")
			data, err := io.ReadAll(os.Stdin)
			if err != nil {
				return fmt.Errorf("reading stdin: %w", err)
			}
			redacted, redactions := redactText(string(data))
			fmt.Print(redacted)
			if showMap && len(redactions) > 0 {
				fmt.Fprintln(os.Stderr, "\nToken mapping:")
				for token, original := range redactions {
					fmt.Fprintf(os.Stderr, "  %s = %s\n", token, original)
				}
			}
			return nil
		},
	}
	pipeCmd.Flags().Bool("show-map", false, "Show token-to-original mapping on stderr")

	cmd.AddCommand(textCmd, pipeCmd)
	return cmd
}
