package server

import (
	"context"
	"encoding/json"
	"testing"
)

// The dashboard reloads when data_rev changes: an in-place change (a tag
// here) must change it although the counts stay the same.
func TestStatusDataRev(t *testing.T) {
	ts, st := newTestServer(t)
	rev := func() float64 {
		t.Helper()
		_, body := do(t, "GET", ts.URL+"/api/status", "")
		var s map[string]any
		if err := json.Unmarshal([]byte(body), &s); err != nil {
			t.Fatal(err)
		}
		r, ok := s["data_rev"].(float64)
		if !ok || r == 0 {
			t.Fatalf("no data_rev in %s", body)
		}
		return r
	}
	before := rev()
	ms, _ := st.List(context.Background())
	if _, err := st.SetTag(context.Background(), ms[0].ID, "tournament"); err != nil {
		t.Fatal(err)
	}
	if rev() == before {
		t.Fatal("data_rev unchanged after a tag edit")
	}
}
