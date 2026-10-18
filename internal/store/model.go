package store

import "rocket-tracker/internal/domain"

// Aliases preserve the store API while domain owns the shared match model.
type (
	Match      = domain.Match
	MeStats    = domain.MeStats
	Player     = domain.Player
	Movement   = domain.Movement
	Hits       = domain.Hits
	HitPoint   = domain.HitPoint
	Vec        = domain.Vec
	Demolition = domain.Demolition
	Goal       = domain.Goal
	Event      = domain.Event
)

// EventKind maps a statfeed event name to an Event kind ("" when not one).
func EventKind(name string) string { return domain.EventKind(name) }

// ProfileKey identifies the in-game account a match was played on.
func ProfileKey(m *Match) string {
	return domain.ProfileKey(m)
}

// SameProfile keeps the matches of m's profile (m's own history).
func SameProfile(ms []*Match, m *Match) []*Match {
	return domain.SameProfile(ms, m)
}
