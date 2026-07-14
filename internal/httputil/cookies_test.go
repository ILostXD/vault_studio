package httputil

import (
	"net/http/httptest"
	"testing"
	"time"

	"bungleware/vault/internal/auth"
)

func TestSetAuthCookiesWithPersistence(t *testing.T) {
	config := auth.Config{
		JWTExpiration:     15 * time.Minute,
		RefreshExpiration: 30 * 24 * time.Hour,
		CookieSameSite:    "lax",
	}

	for _, test := range []struct {
		name       string
		persistent bool
	}{
		{name: "persistent", persistent: true},
		{name: "session", persistent: false},
	} {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			SetAuthCookiesWithPersistence(
				recorder,
				"access",
				"refresh",
				"csrf",
				config,
				test.persistent,
			)

			cookies := recorder.Result().Cookies()
			if len(cookies) != 3 {
				t.Fatalf("expected 3 cookies, got %d", len(cookies))
			}

			for _, cookie := range cookies {
				hasExpiry := !cookie.Expires.IsZero()
				if hasExpiry != test.persistent {
					t.Errorf(
						"cookie %q expiry mismatch: persistent=%t expires=%v",
						cookie.Name,
						test.persistent,
						cookie.Expires,
					)
				}
			}
		})
	}
}
