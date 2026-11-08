package service

import (
	"fmt"
	"image"
	"math"

	"github.com/disintegration/imaging"
)

// DominantAccent returns the most vivid colour of an image as #rrggbb, so every
// device shows the same accent for the same cover. ok is false for greyscale or
// near-black images.
func DominantAccent(img image.Image) (hex string, ok bool) {
	small := imaging.Resize(img, 32, 32, imaging.Box)
	var buckets [12]struct{ w, r, g, b float64 }
	for y := 0; y < 32; y++ {
		for x := 0; x < 32; x++ {
			c := small.NRGBAAt(x, y)
			r, g, b := float64(c.R), float64(c.G), float64(c.B)
			max := math.Max(r, math.Max(g, b))
			min := math.Min(r, math.Min(g, b))
			if max < 60 || max == min {
				continue
			}
			sat := (max - min) / max
			var h float64
			switch max {
			case r:
				h = math.Mod((g-b)/(max-min)+6, 6)
			case g:
				h = (b-r)/(max-min) + 2
			default:
				h = (r-g)/(max-min) + 4
			}
			bk := &buckets[int(h/6*12)%12]
			w := sat * sat * (max / 255)
			bk.w += w
			bk.r += r * w
			bk.g += g * w
			bk.b += b * w
		}
	}
	best := 0
	for i := range buckets {
		if buckets[i].w > buckets[best].w {
			best = i
		}
	}
	bk := buckets[best]
	if bk.w == 0 {
		return "", false
	}
	r, g, b := bk.r/bk.w, bk.g/bk.w, bk.b/bk.w
	// Keep it bright enough to read on dark backgrounds.
	if m := math.Max(r, math.Max(g, b)); m < 200 {
		k := 200 / m
		r, g, b = math.Min(255, r*k), math.Min(255, g*k), math.Min(255, b*k)
	}
	return fmt.Sprintf("#%02x%02x%02x", int(math.Round(r)), int(math.Round(g)), int(math.Round(b))), true
}
