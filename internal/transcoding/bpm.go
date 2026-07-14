package transcoding

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type BPMRequest struct {
	FilePath string `json:"file_path"`
}

type BPMResponse struct {
	BPM      int    `json:"bpm"`
	FilePath string `json:"file_path"`
}

type KeyResponse struct {
	Key       string `json:"key"`
	Scale     string `json:"scale"`
	KeyString string `json:"key_string"`
	FilePath  string `json:"file_path"`
}

type AnalysisResponse struct {
	BPM       int    `json:"bpm"`
	Key       string `json:"key"`
	Scale     string `json:"scale"`
	KeyString string `json:"key_string"`
	FilePath  string `json:"file_path"`
}

type ErrorResponse struct {
	Detail string `json:"detail"`
}

const (
	defaultAudioAnalysisServiceURL = "http://127.0.0.1:8001"
	audioAnalysisServiceTimeout    = 2 * time.Minute
)

var ErrAudioAnalysisDisabled = errors.New("audio analysis is disabled")

func audioAnalysisServiceURL() string {
	serviceURL := strings.TrimSpace(os.Getenv("AUDIO_ANALYSIS_URL"))
	if serviceURL == "disabled" {
		return ""
	}
	if serviceURL == "" {
		return defaultAudioAnalysisServiceURL
	}
	return strings.TrimRight(serviceURL, "/")
}

func callAudioService[T any](ctx context.Context, endpoint string, filePath string, serviceName string) (T, error) {
	var result T
	serviceURL := audioAnalysisServiceURL()
	if serviceURL == "" {
		return result, ErrAudioAnalysisDisabled
	}

	absFilePath, err := filepath.Abs(filePath)
	if err != nil {
		return result, fmt.Errorf("failed to get absolute path: %w", err)
	}

	reqBody := BPMRequest{
		FilePath: absFilePath,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return result, fmt.Errorf("failed to marshal request: %w", err)
	}

	client := &http.Client{
		Timeout: audioAnalysisServiceTimeout,
	}

	ctx, cancel := context.WithTimeout(ctx, audioAnalysisServiceTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(
		ctx,
		"POST",
		serviceURL+endpoint,
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return result, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return result, fmt.Errorf("%s timed out after %v", serviceName, audioAnalysisServiceTimeout)
		}
		return result, fmt.Errorf("failed to connect to audio service: %w (is the service running?)", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return result, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp ErrorResponse
		if err := json.Unmarshal(body, &errResp); err == nil {
			return result, fmt.Errorf("audio service error (status %d): %s", resp.StatusCode, errResp.Detail)
		}
		return result, fmt.Errorf("audio service error (status %d): %s", resp.StatusCode, string(body))
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return result, fmt.Errorf("failed to parse response: %w", err)
	}

	return result, nil
}

func DetectBPM(ctx context.Context, filePath string) (int, error) {
	result, err := callAudioService[BPMResponse](ctx, "/detect-bpm", filePath, "BPM detection")
	if err != nil {
		return 0, err
	}

	if result.BPM < 20 || result.BPM > 300 {
		return 0, fmt.Errorf("detected BPM %d is outside valid range (20-300)", result.BPM)
	}

	return result.BPM, nil
}

func DetectKey(ctx context.Context, filePath string) (string, error) {
	result, err := callAudioService[KeyResponse](ctx, "/detect-key", filePath, "key detection")
	if err != nil {
		return "", err
	}

	return result.KeyString, nil
}

func AnalyzeAudio(ctx context.Context, filePath string) (bpm int, key string, err error) {
	result, err := callAudioService[AnalysisResponse](ctx, "/analyze", filePath, "audio analysis")
	if err != nil {
		return 0, "", err
	}

	if result.BPM < 20 || result.BPM > 300 {
		return 0, "", fmt.Errorf("detected BPM %d is outside valid range (20-300)", result.BPM)
	}

	return result.BPM, result.KeyString, nil
}
