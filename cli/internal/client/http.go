package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/codecanvas/cli/internal/config"
	"github.com/spf13/cobra"
)

type Response struct {
	StatusCode int
	Body       []byte
}

type HTTPClient struct {
	baseURL    string
	httpClient *http.Client
	token      string
}

func NewClient() (*HTTPClient, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}
	token, _ := config.GetToken()
	return &HTTPClient{
		baseURL:    cfg.ServerURL,
		httpClient: &http.Client{},
		token:      token,
	}, nil
}

func NewFromFlags(cmd *cobra.Command) *HTTPClient {
	server, _ := cmd.Flags().GetString("server")
	token, _ := cmd.Flags().GetString("token")

	cfg, _ := config.Load()
	if server == "" && cfg != nil {
		server = cfg.ServerURL
	}
	if server == "" {
		server = "http://localhost:3001"
	}
	if token == "" {
		token, _ = config.GetToken()
	}

	return &HTTPClient{
		baseURL:    server,
		httpClient: &http.Client{},
		token:      token,
	}
}

func (c *HTTPClient) SetToken(token string) {
	c.token = token
}

func (c *HTTPClient) buildURL(path string) string {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return path
	}
	return c.baseURL + path
}

func (c *HTTPClient) GET(path string) (*Response, error) {
	req, err := http.NewRequest("GET", c.buildURL(path), nil)
	if err != nil {
		return nil, err
	}
	return c.do(req)
}

func (c *HTTPClient) POST(path string, body interface{}) (*Response, error) {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(data)
	}
	req, err := http.NewRequest("POST", c.buildURL(path), bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.do(req)
}

func (c *HTTPClient) PATCH(path string, body interface{}) (*Response, error) {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(data)
	}
	req, err := http.NewRequest("PATCH", c.buildURL(path), bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.do(req)
}

func (c *HTTPClient) PUT(path string, body interface{}) (*Response, error) {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(data)
	}
	req, err := http.NewRequest("PUT", c.buildURL(path), bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.do(req)
}

func (c *HTTPClient) DELETE(path string) (*Response, error) {
	req, err := http.NewRequest("DELETE", c.buildURL(path), nil)
	if err != nil {
		return nil, err
	}
	return c.do(req)
}

func (c *HTTPClient) Get(path string) ([]byte, error) {
	resp, err := c.GET(path)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}

func (c *HTTPClient) Post(path string, body interface{}) ([]byte, error) {
	resp, err := c.POST(path, body)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}

func (c *HTTPClient) Put(path string, body interface{}) ([]byte, error) {
	resp, err := c.PUT(path, body)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}

func (c *HTTPClient) DeleteSimple(path string) error {
	_, err := c.DELETE(path)
	return err
}

func (c *HTTPClient) do(req *http.Request) (*Response, error) {
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}

	return &Response{StatusCode: resp.StatusCode, Body: body}, nil
}
