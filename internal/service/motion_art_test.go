package service

import (
	"testing"
)

func TestParseMotionAssetKind(t *testing.T) {
	for _, value := range []string{
		string(MotionAssetAppleSquare),
		string(MotionAssetApplePortrait),
		string(MotionAssetSpotifyCanvas),
	} {
		if _, err := ParseMotionAssetKind(value); err != nil {
			t.Fatalf("expected %q to be valid: %v", value, err)
		}
	}
	if _, err := ParseMotionAssetKind("other"); err == nil {
		t.Fatal("expected unsupported kind to fail")
	}
}

func TestParseFrameRate(t *testing.T) {
	if got := parseFrameRate("30000/1001"); got < 29.969 || got > 29.971 {
		t.Fatalf("expected 29.97 fps, got %f", got)
	}
	if got := parseFrameRate("24"); got != 24 {
		t.Fatalf("expected 24 fps, got %f", got)
	}
}
