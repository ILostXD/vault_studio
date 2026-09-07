package integrations

import (
	"bytes"
	"encoding/base64"
	"testing"
)

func TestCredentialsAreAuthenticatedAndAccountBound(t *testing.T) {
	b, err := NewSecretBox(base64.StdEncoding.EncodeToString(make([]byte, 32)))
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := b.Seal([]byte("private-token"), "user:1:toolost:sandbox")
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("private-token")) {
		t.Fatal("plaintext stored")
	}
	plain, err := b.Open(sealed, "user:1:toolost:sandbox")
	if err != nil || string(plain) != "private-token" {
		t.Fatal("round trip failed", err)
	}
	if _, err = b.Open(sealed, "user:2:toolost:sandbox"); err == nil {
		t.Fatal("cross-account credential accepted")
	}
	sealed[len(sealed)-1] ^= 1
	if _, err = b.Open(sealed, "user:1:toolost:sandbox"); err == nil {
		t.Fatal("modified ciphertext accepted")
	}
	if _, err = NewSecretBox("short"); err == nil {
		t.Fatal("invalid key accepted")
	}
}
