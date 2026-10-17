package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestTrainings(t *testing.T) {
	ctx := context.Background()
	s, err := Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	sc, other := s.User(LocalUser), s.User(7)
	t0 := time.Date(2026, 10, 1, 20, 0, 0, 0, time.UTC)

	for _, bad := range []Training{
		{StartedAt: t0, EndedAt: t0.Add(-time.Minute), Source: "game"},
		{StartedAt: t0, EndedAt: t0.Add(13 * time.Hour), Source: "game"},
		{StartedAt: t0, EndedAt: t0.Add(time.Minute), Source: "bot"},
		{StartedAt: t0, EndedAt: t0.Add(time.Minute), Source: "timer", Focus: "juggling"},
	} {
		if err := sc.AddTraining(ctx, &bad, ""); err == nil {
			t.Errorf("accepted %+v", bad)
		}
	}

	// The timer's record, then the game's record of the same warm-up: one training.
	timer := &Training{StartedAt: t0, EndedAt: t0.Add(15 * time.Minute), Source: "timer", Focus: "Shooting"}
	game := &Training{StartedAt: t0.Add(time.Minute), EndedAt: t0.Add(16 * time.Minute), Source: "game", Profile: "Epic|Me|0", Arena: "Stadium_P", Touches: 120, AvgHitSpeed: 2000, MaxHitSpeed: 4000}
	if err := sc.AddTraining(ctx, timer, ""); err != nil {
		t.Fatal(err)
	}
	if err := sc.AddTraining(ctx, game, "k1"); err != nil {
		t.Fatal(err)
	}
	// The same upload again (agent retry) changes nothing.
	again := *game
	again.ID = 0
	if err := sc.AddTraining(ctx, &again, "k1"); err != nil {
		t.Fatal(err)
	}
	later := &Training{StartedAt: t0.Add(3 * time.Hour), EndedAt: t0.Add(3*time.Hour + 5*time.Minute), Source: "game"}
	if err := sc.AddTraining(ctx, later, "k2"); err != nil {
		t.Fatal(err)
	}
	if err := other.AddTraining(ctx, &Training{StartedAt: t0, EndedAt: t0.Add(time.Minute), Source: "game"}, "k1"); err != nil {
		t.Fatal(err)
	}
	ts, err := sc.Trainings(ctx)
	if err != nil || len(ts) != 2 {
		t.Fatalf("%+v %v", ts, err)
	}
	w := ts[0]
	if w.ID != timer.ID || !w.StartedAt.Equal(t0) || !w.EndedAt.Equal(t0.Add(16*time.Minute)) || w.Source != "game" || w.Focus != "shooting" ||
		w.Profile != "epic|me|0" || w.Touches != 120 || w.MaxHitSpeed != 4000 {
		t.Fatalf("merged %+v", w)
	}

	if _, err := sc.SetTrainingFocus(ctx, later.ID, "kickoff"); err != nil {
		t.Fatal(err)
	}
	if _, err := sc.SetTrainingFocus(ctx, later.ID, "nope"); err == nil {
		t.Fatal("unknown focus accepted")
	}
	if _, err := other.SetTrainingFocus(ctx, later.ID, "saves"); err != ErrNotFound {
		t.Fatalf("other user's training: %v", err)
	}
	if err := other.DeleteTraining(ctx, later.ID); err != ErrNotFound {
		t.Fatalf("other user's training: %v", err)
	}
	ts, _ = sc.Trainings(ctx)
	if ts[1].Focus != "kickoff" {
		t.Fatalf("focus %+v", ts[1])
	}
	if err := sc.DeleteTraining(ctx, later.ID); err != nil {
		t.Fatal(err)
	}
	// Removing the account removes its trainings.
	if _, err := sc.DeleteProfile(ctx, "epic|me|0"); err != nil {
		t.Fatal(err)
	}
	if ts, _ := sc.Trainings(ctx); len(ts) != 0 {
		t.Fatalf("left %+v", ts)
	}
}
