package service

import (
	"fmt"
	"image"
	"image/color"
	"testing"
)

func TestDominantAccent(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 64, 64))
	for y := 0; y < 64; y++ {
		for x := 0; x < 64; x++ {
			// Mostly saturated red with a small green patch: red must win, same result every call.
			if x < 8 && y < 8 {
				img.Set(x, y, color.NRGBA{0, 220, 0, 255})
			} else {
				img.Set(x, y, color.NRGBA{230, 20, 20, 255})
			}
		}
	}
	first, ok := DominantAccent(img)
	var r, g, b int
	if _, err := fmt.Sscanf(first, "#%02x%02x%02x", &r, &g, &b); err != nil || !ok || r < 200 || g > 80 || b > 80 {
		t.Fatalf("expected a bright red accent, got %q ok=%v", first, ok)
	}
	if again, _ := DominantAccent(img); again != first {
		t.Fatalf("not deterministic: %q vs %q", first, again)
	}
	grey := image.NewNRGBA(image.Rect(0, 0, 8, 8))
	for i := range grey.Pix {
		grey.Pix[i] = 128
	}
	if _, ok := DominantAccent(grey); ok {
		t.Fatal("greyscale image should have no accent")
	}
}
