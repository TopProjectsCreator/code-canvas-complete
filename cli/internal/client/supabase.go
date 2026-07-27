package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/codecanvas/cli/internal/config"
	"github.com/spf13/cobra"
)

type SupabaseClient struct {
	baseURL string
	apiKey  string
	token   string
	client  *http.Client
}

func NewSupabaseFromFlags(cmd *cobra.Command) *SupabaseClient {
	server, _ := cmd.Flags().GetString("server")
	token, _ := cmd.Flags().GetString("token")

	cfg, _ := config.Load()
	if server == "" && cfg != nil {
		server = cfg.SupabaseURL
	}
	if token == "" {
		token, _ = config.GetToken()
	}

	var apiKey string
	if cfg != nil {
		apiKey = cfg.SupabaseAnonKey
	}

	return &SupabaseClient{
		baseURL: server,
		apiKey:  apiKey,
		token:   token,
		client:  &http.Client{},
	}
}

func (c *SupabaseClient) Query(table, selectFields string, filters []string, orderBy string, limit int) ([]map[string]interface{}, error) {
	params := url.Values{}
	if selectFields != "" {
		params.Set("select", selectFields)
	}
	for _, f := range filters {
		parts := strings.SplitN(f, "=", 2)
		if len(parts) == 2 {
			params.Set(parts[0], parts[1])
		}
	}
	if orderBy != "" {
		params.Set("order", orderBy+".desc")
	}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}

	u := fmt.Sprintf("%s/rest/v1/%s?%s", c.baseURL, table, params.Encode())
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}

	body, err := c.do(req)
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parsing response: %w", err)
	}
	return result, nil
}

func (c *SupabaseClient) Insert(table string, data interface{}) (map[string]interface{}, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	u := fmt.Sprintf("%s/rest/v1/%s", c.baseURL, table)
	req, err := http.NewRequest("POST", u, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("parsing response: %w", err)
	}
	if len(result) > 0 {
		return result[0], nil
	}
	return nil, nil
}

func (c *SupabaseClient) Update(table, id string, data interface{}) error {
	body, err := json.Marshal(data)
	if err != nil {
		return err
	}

	u := fmt.Sprintf("%s/rest/v1/%s?id=eq.%s", c.baseURL, table, id)
	req, err := http.NewRequest("PATCH", u, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	_, err = c.do(req)
	return err
}

func (c *SupabaseClient) Delete(table, id string) error {
	u := fmt.Sprintf("%s/rest/v1/%s?id=eq.%s", c.baseURL, table, id)
	req, err := http.NewRequest("DELETE", u, nil)
	if err != nil {
		return err
	}
	_, err = c.do(req)
	return err
}

func (c *SupabaseClient) do(req *http.Request) ([]byte, error) {
	req.Header.Set("apikey", c.apiKey)
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	} else {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("supabase error (HTTP %d): %s", resp.StatusCode, string(body))
	}

	return body, nil
}
