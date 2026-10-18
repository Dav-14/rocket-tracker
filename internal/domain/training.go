package domain

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"
	"time"
)

// Training is time spent training instead of playing a match: detected in
// the game (freeplay, training packs, workshop maps: offline, alone on the
// field) or started with the dashboard's warm-up timer.
type Training struct {
	SpeedUnit SpeedUnit `json:"speed_unit,omitempty"`
	ID        int64     `json:"id"`
	StartedAt time.Time `json:"started_at"`
	EndedAt   time.Time `json:"ended_at"`
	Source    string    `json:"source"`  // "game" or "timer"
	Focus     string    `json:"focus"`   // the mechanic worked on (see Focuses); "" = not said
	Profile   string    `json:"profile"` // the account (ProfileKey of a match); "" = not known
	Arena     string    `json:"arena"`
	// Touches and their ball speeds (SpeedUnit), when detected in the game.
	Touches     int     `json:"touches"`
	AvgHitSpeed float64 `json:"avg_hit_speed"`
	MaxHitSpeed float64 `json:"max_hit_speed"`
}

// Focuses are the mechanics a training can be about.
var Focuses = []string{"freeplay", "kickoff", "shooting", "saves", "aerials", "power", "boost", "dribble", "recovery", "rotation"}

// Training rules.
const (
	MaxTraining = 12 * time.Hour
	// TrainingJoin: two trainings this close are one (the game's and the
	// timer's record of the same warm-up, or a pack after freeplay).
	TrainingJoin = 2 * time.Minute
)

// ErrInvalidTraining wraps the reasons a training is refused. Its text keeps
// the historical store error contract.
var ErrInvalidTraining = errors.New("store: invalid training")

// ValidFocus reports whether f can be a training's focus.
func ValidFocus(f string) bool {
	return f == "" || slices.Contains(Focuses, f)
}

// Normalize cleans the fields and checks them.
func (t *Training) Normalize() error {
	t.StartedAt = t.StartedAt.UTC().Truncate(time.Second)
	t.EndedAt = t.EndedAt.UTC().Truncate(time.Second)
	t.Focus = strings.ToLower(strings.TrimSpace(t.Focus))
	t.Profile = strings.ToLower(strings.TrimSpace(t.Profile))
	switch {
	case t.StartedAt.IsZero() || t.EndedAt.Before(t.StartedAt):
		return fmt.Errorf("%w: invalid times", ErrInvalidTraining)
	case t.EndedAt.Sub(t.StartedAt) > MaxTraining:
		return fmt.Errorf("%w: longer than %v", ErrInvalidTraining, MaxTraining)
	case t.Source != "game" && t.Source != "timer":
		return fmt.Errorf("%w: source must be game or timer", ErrInvalidTraining)
	case !ValidFocus(t.Focus):
		return fmt.Errorf("%w: unknown focus %q", ErrInvalidTraining, t.Focus)
	case len(t.Profile) > 200 || len(t.Arena) > 200:
		return fmt.Errorf("%w: field too long", ErrInvalidTraining)
	case !t.SpeedUnit.Valid():
		return fmt.Errorf("%w: unknown speed unit %q", ErrInvalidTraining, t.SpeedUnit)
	case math.IsNaN(t.AvgHitSpeed) || math.IsInf(t.AvgHitSpeed, 0) || math.IsNaN(t.MaxHitSpeed) || math.IsInf(t.MaxHitSpeed, 0):
		return fmt.Errorf("%w: non-finite speed", ErrInvalidTraining)
	case t.Touches < 0 || t.AvgHitSpeed < 0 || t.MaxHitSpeed < 0:
		return fmt.Errorf("%w: negative touches or speed", ErrInvalidTraining)
	}
	return nil
}

// Merge folds o (the same warm-up, recorded again or by the other source)
// into t. Inputs must have passed Normalize.
func (t *Training) Merge(o *Training) {
	if o.StartedAt.Before(t.StartedAt) {
		t.StartedAt = o.StartedAt
	}
	if o.EndedAt.After(t.EndedAt) {
		t.EndedAt = o.EndedAt
	}
	if o.Source == "game" {
		t.Source = "game"
	}
	if t.Focus == "" {
		t.Focus = o.Focus
	}
	if t.Profile == "" {
		t.Profile = o.Profile
	}
	if t.Arena == "" {
		t.Arena = o.Arena
	}
	// Timer records without touches carry no speed evidence. Otherwise keep
	// existing metrics when units differ rather than compare incompatible values.
	sameUnit := t.SpeedUnit == o.SpeedUnit ||
		(t.SpeedUnit == "" && o.SpeedUnit == SpeedUUPerSecond) ||
		(t.SpeedUnit == SpeedUUPerSecond && o.SpeedUnit == "")
	if t.Touches == 0 && t.AvgHitSpeed == 0 && t.MaxHitSpeed == 0 {
		t.SpeedUnit = o.SpeedUnit
		sameUnit = true
	}
	if o.Touches > t.Touches {
		t.Touches = o.Touches
		if sameUnit {
			t.AvgHitSpeed = o.AvgHitSpeed
		}
	}
	if sameUnit {
		t.MaxHitSpeed = max(t.MaxHitSpeed, o.MaxHitSpeed)
	}
}
