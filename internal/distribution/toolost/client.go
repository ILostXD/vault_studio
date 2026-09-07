package toolost

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	ProductionAPI = "https://api.toolost.com/v1"
	SandboxAPI    = "https://api-sandbox.toolost.com/v1"
	AuthorizeURL  = "https://toolost.com/oauth/authorize"
	TokenURL      = "https://toolost.com/oauth/token"
)

type Client struct {
	HTTP                                                        *http.Client
	APIBase, TokenEndpoint, ClientID, ClientSecret, RedirectURI string
}

type Token struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	TokenType    string    `json:"token_type"`
	Scope        string    `json:"scope,omitempty"`
	ExpiresIn    int64     `json:"expires_in,omitempty"`
	ExpiresAt    time.Time `json:"expires_at,omitempty"`
}

type Participant struct {
	Name  string   `json:"name"`
	Roles []string `json:"role"`
}
type Writer struct {
	Name  string   `json:"name"`
	Roles []string `json:"role"`
}
type Credit struct {
	Name  string   `json:"name"`
	Roles []string `json:"role"`
}
type CreateDraftRequest struct {
	Type         string        `json:"type"`
	Title        string        `json:"title"`
	Participants []Participant `json:"participants"`
	Label        string        `json:"label,omitempty"`
}
type MetadataRequest struct {
	Title               string `json:"title,omitempty"`
	Label               string `json:"label,omitempty"`
	PrimaryGenre        string `json:"primaryGenre,omitempty"`
	SecondaryGenre      string `json:"secondaryGenre,omitempty"`
	Language            string `json:"language,omitempty"`
	ReleaseDate         string `json:"releaseDate,omitempty"`
	OriginalReleaseDate string `json:"originalReleaseDate,omitempty"`
	UPC                 string `json:"upc,omitempty"`
	CLine               string `json:"cLine,omitempty"`
	PLine               string `json:"pLine,omitempty"`
	CoverURL            string `json:"coverUrl,omitempty"`
}
type Language struct {
	Code string `json:"code"`
	Name string `json:"name"`
}
type Track struct {
	Title        string        `json:"title"`
	Language     string        `json:"language"`
	AudioFileKey string        `json:"audioFileKey"`
	Artists      []Participant `json:"artists"`
	Writers      []Writer      `json:"writers"`
	Credits      []Credit      `json:"credits,omitempty"`
	Explicit     *bool         `json:"explicit,omitempty"`
	ISRC         string        `json:"isrc,omitempty"`
	Lyrics       *Lyrics       `json:"lyrics,omitempty"`
}
type Lyrics struct {
	Content  string `json:"content"`
	Explicit bool   `json:"explicit"`
}
type UploadURLRequest struct {
	Kind        string `json:"kind"`
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
}
type UploadTarget struct {
	UploadURL string            `json:"uploadUrl"`
	FileKey   string            `json:"fileKey"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	ExpiresIn int64             `json:"expiresIn"`
}
type Release struct {
	ID     string `json:"id"`
	Title  string `json:"title,omitempty"`
	Status string `json:"status,omitempty"`
}

func (r *Release) UnmarshalJSON(data []byte) error {
	var raw struct {
		ID     json.RawMessage `json:"id"`
		Title  string          `json:"title"`
		Status string          `json:"status"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	r.Title, r.Status = raw.Title, raw.Status
	if len(raw.ID) == 0 {
		return nil
	}
	if raw.ID[0] == '"' {
		return json.Unmarshal(raw.ID, &r.ID)
	}
	r.ID = strings.TrimSpace(string(raw.ID))
	return nil
}

func (c *Client) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 60 * time.Second}
}

func (c *Client) AuthorizationURL(state, challenge string, scopes []string) (string, error) {
	u, err := url.Parse(AuthorizeURL)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("response_type", "code")
	q.Set("client_id", c.ClientID)
	q.Set("redirect_uri", c.RedirectURI)
	q.Set("state", state)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")
	q.Set("scope", strings.Join(scopes, " "))
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func (c *Client) ExchangeCode(ctx context.Context, code, verifier string) (Token, error) {
	values := url.Values{"grant_type": {"authorization_code"}, "client_id": {c.ClientID}, "client_secret": {c.ClientSecret}, "redirect_uri": {c.RedirectURI}, "code": {code}, "code_verifier": {verifier}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.TokenEndpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return Token{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var token Token
	if err = c.do(req, "", &token); err != nil {
		return token, err
	}
	if token.AccessToken == "" {
		return token, errors.New("Too Lost token response omitted access_token")
	}
	if token.ExpiresIn > 0 {
		token.ExpiresAt = time.Now().UTC().Add(time.Duration(token.ExpiresIn) * time.Second)
	}
	return token, nil
}

func (c *Client) CreateDraft(ctx context.Context, accessToken string, input CreateDraftRequest) (Release, error) {
	var out Release
	err := c.apiJSON(ctx, http.MethodPost, "/releases", accessToken, input, &out)
	return out, err
}
func (c *Client) PatchMetadata(ctx context.Context, accessToken, releaseID string, input MetadataRequest) error {
	return c.apiJSON(ctx, http.MethodPatch, "/releases/"+url.PathEscape(releaseID)+"/metadata", accessToken, input, nil)
}
func (c *Client) RequestUploadURL(ctx context.Context, accessToken, releaseID string, input UploadURLRequest) (UploadTarget, error) {
	var out UploadTarget
	err := c.apiJSON(ctx, http.MethodPost, "/releases/"+url.PathEscape(releaseID)+"/tracks/upload-url", accessToken, input, &out)
	return out, err
}
func (c *Client) ReplaceTracks(ctx context.Context, accessToken, releaseID string, tracks []Track) error {
	return c.apiJSON(ctx, http.MethodPut, "/releases/"+url.PathEscape(releaseID)+"/tracks", accessToken, map[string]any{"tracks": tracks}, nil)
}
func (c *Client) GetRelease(ctx context.Context, accessToken, releaseID string) (Release, error) {
	var out Release
	err := c.apiJSON(ctx, http.MethodGet, "/releases/"+url.PathEscape(releaseID), accessToken, nil, &out)
	return out, err
}
func (c *Client) ListGenres(ctx context.Context, accessToken string) ([]string, error) {
	var out []string
	err := c.apiJSON(ctx, http.MethodGet, "/lookup/genres", accessToken, nil, &out)
	return out, err
}
func (c *Client) ListLanguages(ctx context.Context, accessToken string) ([]Language, error) {
	var out []Language
	err := c.apiJSON(ctx, http.MethodGet, "/lookup/languages", accessToken, nil, &out)
	return out, err
}

func (c *Client) Upload(ctx context.Context, target UploadTarget, reader io.Reader, size int64) error {
	u, err := url.Parse(target.UploadURL)
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return errors.New("invalid Too Lost upload URL")
	}
	method := target.Method
	if method == "" {
		method = http.MethodPut
	}
	if method != http.MethodPut {
		return fmt.Errorf("unsupported upload method %q", method)
	}
	req, err := http.NewRequestWithContext(ctx, method, target.UploadURL, reader)
	if err != nil {
		return err
	}
	req.ContentLength = size
	for k, v := range target.Headers {
		req.Header.Set(k, v)
	}
	if req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "audio/flac")
	}
	return c.do(req, "", nil)
}

func (c *Client) apiJSON(ctx context.Context, method, path, accessToken string, input, output any) error {
	base, err := url.Parse(strings.TrimRight(c.APIBase, "/") + "/")
	if err != nil {
		return err
	}
	rel, err := url.Parse(strings.TrimLeft(path, "/"))
	if err != nil {
		return err
	}
	endpoint := base.ResolveReference(rel)
	var body io.Reader
	if input != nil {
		data, marshalErr := json.Marshal(input)
		if marshalErr != nil {
			return marshalErr
		}
		body = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint.String(), body)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if input != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.do(req, accessToken, output)
}

func (c *Client) do(req *http.Request, accessToken string, output any) error {
	if accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &APIError{Status: resp.StatusCode, RetryAfter: resp.Header.Get("Retry-After"), Body: strings.TrimSpace(string(data))}
	}
	if output == nil || len(data) == 0 {
		return nil
	}
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if json.Unmarshal(data, &envelope) == nil && len(envelope.Data) > 0 && string(envelope.Data) != "null" {
		data = envelope.Data
	}
	if err = json.Unmarshal(data, output); err == nil {
		return nil
	}
	// Some API examples expose the release below data.release.
	var nested struct {
		Release json.RawMessage `json:"release"`
	}
	if json.Unmarshal(data, &nested) == nil && len(nested.Release) > 0 {
		return json.Unmarshal(nested.Release, output)
	}
	return err
}

type APIError struct {
	Status           int
	RetryAfter, Body string
}

func (e *APIError) Error() string {
	message := e.Body
	if message == "" {
		message = http.StatusText(e.Status)
	}
	return "Too Lost API " + strconv.Itoa(e.Status) + ": " + message
}
