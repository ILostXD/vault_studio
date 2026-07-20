package sharing

import (
	"database/sql"
	"strings"
	"testing"
)

func TestValidateCommentInput(t *testing.T) {
	duration := sql.NullFloat64{Float64: 60, Valid: true}
	tests := []struct {
		name   string
		author string
		text   string
		time   float64
		ok     bool
	}{
		{"valid", "Alex", "Bring the vocal up", 12.5, true},
		{"missing author", "", "Note", 1, false},
		{"missing text", "Alex", "", 1, false},
		{"negative timestamp", "Alex", "Note", -1, false},
		{"past duration", "Alex", "Note", 61, false},
		{"oversized text", "Alex", strings.Repeat("x", 2001), 1, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateCommentInput(test.author, test.text, test.time, duration)
			if (err == nil) != test.ok {
				t.Fatalf("validateCommentInput() error = %v, want valid = %v", err, test.ok)
			}
		})
	}
}
