package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	ServerURL      string `mapstructure:"server_url" json:"server_url"`
	SupabaseURL    string `mapstructure:"supabase_url" json:"supabase_url"`
	SupabaseAnonKey string `mapstructure:"supabase_anon_key" json:"supabase_anon_key"`
	Auth           Auth   `mapstructure:"auth" json:"auth"`
}

type Auth struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
}

var (
	configDir string
	mu        sync.RWMutex
)

func init() {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	configDir = filepath.Join(home, ".cc")
}

func configPath() string {
	return filepath.Join(configDir, "config.json")
}

func ensureDir() error {
	return os.MkdirAll(configDir, 0o755)
}

func Load() (*Config, error) {
	mu.RLock()
	defer mu.RUnlock()

	cfg := &Config{
		ServerURL: "http://localhost:3001",
	}

	viper.SetConfigFile(configPath())
	viper.SetConfigType("json")
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			if !os.IsNotExist(err) {
				return nil, fmt.Errorf("reading config: %w", err)
			}
		}
	}

	viper.SetDefault("server_url", "http://localhost:3001")

	if err := viper.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("unmarshaling config: %w", err)
	}

	return cfg, nil
}

func Save(cfg *Config) error {
	mu.Lock()
	defer mu.Unlock()

	if err := ensureDir(); err != nil {
		return fmt.Errorf("creating config dir: %w", err)
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling config: %w", err)
	}

	if err := os.WriteFile(configPath(), data, 0o600); err != nil {
		return fmt.Errorf("writing config: %w", err)
	}

	return nil
}

func GetToken() (string, error) {
	// Check CC_TOKEN env var first (auto-auth inside IDE terminal)
	if token := os.Getenv("CC_TOKEN"); token != "" {
		return token, nil
	}
	// Also check SUPABASE_TOKEN as a fallback
	if token := os.Getenv("SUPABASE_TOKEN"); token != "" {
		return token, nil
	}

	cfg, err := Load()
	if err != nil {
		return "", err
	}

	if cfg.Auth.AccessToken == "" {
		return "", fmt.Errorf("not authenticated")
	}

	if cfg.Auth.ExpiresAt > 0 && time.Now().Unix() > cfg.Auth.ExpiresAt {
		return "", fmt.Errorf("token expired")
	}

	return cfg.Auth.AccessToken, nil
}

func SetToken(accessToken, refreshToken string, expiresAt time.Duration) error {
	cfg, err := Load()
	if err != nil {
		cfg = &Config{
			ServerURL: "http://localhost:3001",
		}
	}

	cfg.Auth.AccessToken = accessToken
	cfg.Auth.RefreshToken = refreshToken
	if expiresAt > 0 {
		cfg.Auth.ExpiresAt = time.Now().Add(expiresAt).Unix()
	}

	return Save(cfg)
}

func ClearToken() error {
	cfg, err := Load()
	if err != nil {
		return err
	}

	cfg.Auth = Auth{}
	return Save(cfg)
}
