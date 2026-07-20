package handlers

import (
	"strings"
	"testing"
)

func TestValidateNoteContent(t *testing.T) {
	tests := []struct {
		name    string
		content string
		format  string
		want    string
		wantErr bool
	}{
		{name: "defaults to plain", content: "lyrics", want: "plain"},
		{name: "accepts TipTap document", content: `{"type":"doc","content":[]}`, format: "tiptap_json", want: "tiptap_json"},
		{name: "rejects malformed JSON", content: `{`, format: "tiptap_json", wantErr: true},
		{name: "rejects wrong root", content: `{"type":"paragraph"}`, format: "tiptap_json", wantErr: true},
		{name: "rejects oversized note", content: strings.Repeat("x", maxNoteContentBytes+1), wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := validateNoteContent(test.content, test.format)
			if (err != nil) != test.wantErr {
				t.Fatalf("validateNoteContent() error = %v, wantErr %v", err, test.wantErr)
			}
			if got != test.want {
				t.Fatalf("validateNoteContent() = %q, want %q", got, test.want)
			}
		})
	}
}
