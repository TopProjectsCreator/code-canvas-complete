package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

func NewCompletionsCmd() *cobra.Command {
	completionsCmd := &cobra.Command{
		Use:   "completions",
		Short: "Generate shell completions",
		Long:  "Generates shell completion scripts for bash, zsh, and fish.",
	}

	bashCmd := &cobra.Command{
		Use:   "bash",
		Short: "Generate Bash completions",
		RunE: func(cmd *cobra.Command, args []string) error {
			return rootCmd.GenBashCompletionV2(os.Stdout, true)
		},
	}

	zshCmd := &cobra.Command{
		Use:   "zsh",
		Short: "Generate Zsh completions",
		RunE: func(cmd *cobra.Command, args []string) error {
			return rootCmd.GenZshCompletion(os.Stdout)
		},
	}

	fishCmd := &cobra.Command{
		Use:   "fish",
		Short: "Generate Fish completions",
		RunE: func(cmd *cobra.Command, args []string) error {
			return rootCmd.GenFishCompletion(os.Stdout, true)
		},
	}

	completionsCmd.AddCommand(bashCmd)
	completionsCmd.AddCommand(zshCmd)
	completionsCmd.AddCommand(fishCmd)

	return completionsCmd
}
