package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	cfgFile    string
	outputFmt  string
	quietMode  bool
	verboseMode bool
	serverURL  string
	tokenFlag  string
)

var rootCmd = &cobra.Command{
	Use:     "cc",
	Short:   "Code Canvas CLI",
	Long:    "Code Canvas CLI - Manage your Code Canvas workspace from the terminal",
	Version: "0.1.0",
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVar(&serverURL, "server", "", "Server URL")
	rootCmd.PersistentFlags().StringVar(&tokenFlag, "token", "", "Authentication token")
	rootCmd.PersistentFlags().StringVarP(&outputFmt, "output", "o", "table", "Output format (table, json, yaml)")
	rootCmd.PersistentFlags().BoolVarP(&quietMode, "quiet", "q", false, "Suppress non-error output")
	rootCmd.PersistentFlags().BoolVarP(&verboseMode, "verbose", "v", false, "Enable verbose output")

	viper.BindPFlag("server_url", rootCmd.PersistentFlags().Lookup("server"))
	viper.BindPFlag("token", rootCmd.PersistentFlags().Lookup("token"))

	rootCmd.AddCommand(NewAuthCmd())
	rootCmd.AddCommand(NewRedactorCmd())
	rootCmd.AddCommand(NewThreadsCmd())
	rootCmd.AddCommand(NewIDECmd())
	rootCmd.AddCommand(NewCompletionsCmd())
}

func initConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("json")

	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error getting home dir:", err)
		os.Exit(1)
	}

	viper.AddConfigPath(home + "/.cc")
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			fmt.Fprintln(os.Stderr, "Error reading config:", err)
		}
	}
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
