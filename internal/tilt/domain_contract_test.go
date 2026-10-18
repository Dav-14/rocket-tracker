package tilt_test

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"rocket-tracker/internal/domain"
	"rocket-tracker/internal/store"
	"rocket-tracker/internal/tilt"
)

// Bidirectional assignments require aliases, rather than convertible copies.
var (
	_ *domain.Match      = (*store.Match)(nil)
	_ *store.Match       = (*domain.Match)(nil)
	_ *domain.MeStats    = (*store.MeStats)(nil)
	_ *domain.Player     = (*store.Player)(nil)
	_ *domain.Movement   = (*store.Movement)(nil)
	_ *domain.Hits       = (*store.Hits)(nil)
	_ *domain.HitPoint   = (*store.HitPoint)(nil)
	_ *domain.Vec        = (*store.Vec)(nil)
	_ *domain.Demolition = (*store.Demolition)(nil)
	_ *domain.Goal       = (*store.Goal)(nil)
)

func TestStoreDomainTiltCompatibility(t *testing.T) {
	legacy := store.Match{Result: "loss", StartedAt: time.Date(2026, 10, 18, 13, 0, 0, 0, time.UTC),
		DurationS: 300, Me: store.MeStats{PrimaryID: " Epic|TEST|0 "},
		Hits:  &store.Hits{Count: 1, Points: []store.HitPoint{{X: -100, Post: 2400}}},
		Goals: []store.Goal{{Team: "them", Impact: &store.Vec{Y: -5120}}}}
	legacy.Normalize()
	b, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	var m domain.Match
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(legacy, m) {
		t.Fatal("store JSON changed in the domain model")
	}
	b, err = json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	var back store.Match
	if err := json.Unmarshal(b, &back); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(back, legacy) || store.ProfileKey(&back) != "epic|test|0" {
		t.Fatal("domain JSON or store profile delegation changed")
	}
	history := store.SameProfile([]*store.Match{&back}, &legacy)
	if len(history) != 1 || history[0] != &back {
		t.Fatal("store SameProfile delegation lost the original pointer")
	}
	now := m.StartedAt.Add(5 * time.Minute)
	if a := tilt.Check(history, 1, now); a == nil || a.Kind != "streak" || a.Losses != 1 {
		t.Fatalf("tilt cannot consume the store alias: %+v", a)
	}
	if a := tilt.Pause([]*domain.Match{&m}, 1, 5, now); a == nil || a.Kind != "pause" || a.Matches != 1 {
		t.Fatalf("tilt cannot consume the domain model: %+v", a)
	}
}
