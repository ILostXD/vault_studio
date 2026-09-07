package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewerVersion(t *testing.T) {
	tests := []struct {
		latest, current string
		want            bool
	}{
		{latest: "v1.1.0", current: "v1.0.10", want: true},
		{latest: "v1.0.10", current: "1.0.10", want: false},
		{latest: "v1.0.9", current: "v1.0.10", want: false},
		{latest: "v1.0.10", current: "dev", want: true},
		{latest: "invalid", current: "v1.0.10", want: false},
	}
	for _, test := range tests {
		if got := newerVersion(test.latest, test.current); got != test.want {
			t.Errorf("newerVersion(%q, %q) = %v, want %v", test.latest, test.current, got, test.want)
		}
	}
}

func TestTriggerUpdateAuthenticatesInternalRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer secret" {
			t.Errorf("Authorization = %q", got)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	handler := NewUpdateHandler(nil, "dev", UpdateConfig{Endpoint: server.URL, Token: "secret"})
	if err := handler.triggerUpdate(context.Background()); err != nil {
		t.Fatalf("triggerUpdate() error = %v", err)
	}
}
