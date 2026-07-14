package httputil

import (
	"net/http"
	"strings"
	"time"

	"bungleware/vault/internal/auth"
)

func SetAuthCookies(w http.ResponseWriter, accessToken, refreshToken, csrfToken string, config auth.Config) {
	SetAuthCookiesWithPersistence(w, accessToken, refreshToken, csrfToken, config, true)
}

func SetAuthCookiesWithPersistence(w http.ResponseWriter, accessToken, refreshToken, csrfToken string, config auth.Config, persistent bool) {
	accessCookie := buildCookie(auth.AccessTokenCookieName, accessToken, config, config.JWTExpiration, true, persistent)
	refreshCookie := buildCookie(auth.RefreshTokenCookieName, refreshToken, config, config.RefreshExpiration, true, persistent)
	csrfCookie := buildCookie(auth.CSRFCookieName, csrfToken, config, config.RefreshExpiration, false, persistent)

	http.SetCookie(w, accessCookie)
	http.SetCookie(w, refreshCookie)
	http.SetCookie(w, csrfCookie)
}

func ClearAuthCookies(w http.ResponseWriter, config auth.Config) {
	clearCookie := func(name string, httpOnly bool) {
		cookie := buildCookie(name, "", config, -1*time.Hour, httpOnly, true)
		cookie.MaxAge = -1
		http.SetCookie(w, cookie)
	}

	clearCookie(auth.AccessTokenCookieName, true)
	clearCookie(auth.RefreshTokenCookieName, true)
	clearCookie(auth.CSRFCookieName, false)
}

func buildCookie(name, value string, config auth.Config, ttl time.Duration, httpOnly, persistent bool) *http.Cookie {
	cookie := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		Domain:   config.CookieDomain,
		HttpOnly: httpOnly,
		Secure:   config.CookieSecure,
		SameSite: parseSameSite(config.CookieSameSite),
	}
	if persistent {
		cookie.Expires = time.Now().Add(ttl)
	}
	return cookie
}

func parseSameSite(value string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}
