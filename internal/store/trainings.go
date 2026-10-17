package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"
)

// Training is time spent training instead of playing a match: detected in
// the game (freeplay, training packs, workshop maps: offline, alone on the
// field) or started with the dashboard's warm-up timer.
type Training struct {
	ID        int64     `json:"id"`
	StartedAt time.Time `json:"started_at"`
	EndedAt   time.Time `json:"ended_at"`
	Source    string    `json:"source"`  // "game" or "timer"
	Focus     string    `json:"focus"`   // the mechanic worked on (see Focuses); "" = not said
	Profile   string    `json:"profile"` // the account (ProfileKey of a match); "" = not known
	Arena     string    `json:"arena"`
	// Touches and their ball speeds (uu/s), when detected in the game.
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

// ErrInvalidTraining wraps the reasons a training is refused.
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
	case t.Touches < 0 || t.AvgHitSpeed < 0 || t.MaxHitSpeed < 0:
		return fmt.Errorf("%w: negative touches or speed", ErrInvalidTraining)
	}
	return nil
}

// merge folds o (the same warm-up, recorded again or by the other source)
// into t.
func (t *Training) merge(o *Training) {
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
	if o.Touches > t.Touches {
		t.Touches, t.AvgHitSpeed = o.Touches, o.AvgHitSpeed
	}
	t.MaxHitSpeed = max(t.MaxHitSpeed, o.MaxHitSpeed)
}

// TrainingImportKey identifies a training of a local database once imported
// on a server, like ImportKey for matches.
func TrainingImportKey(t *Training) string {
	return "import:training:" + strconv.FormatInt(t.StartedAt.Unix(), 10)
}

// Trainings lists the user's trainings, oldest first.
func (sc *Scope) Trainings(ctx context.Context) ([]Training, error) {
	rows, err := sc.s.db.QueryContext(ctx, `SELECT id, data FROM trainings WHERE user_id = ? ORDER BY started_at, id`, sc.uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Training{}
	for rows.Next() {
		var t Training
		var data string
		if err := rows.Scan(&t.ID, &data); err != nil {
			return nil, err
		}
		id := t.ID
		if err := json.Unmarshal([]byte(data), &t); err != nil {
			continue
		}
		t.ID = id
		out = append(out, t)
	}
	return out, rows.Err()
}

// AddTraining stores a training and sets t.ID. key (may be empty)
// identifies the sender's copy: the same key again replaces it. A training
// overlapping one already stored (within TrainingJoin) is merged into it.
func (sc *Scope) AddTraining(ctx context.Context, t *Training, key string) error {
	if err := t.Normalize(); err != nil {
		return err
	}
	if len(key) > 200 {
		return fmt.Errorf("%w: key too long", ErrInvalidTraining)
	}
	tx, err := sc.s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var (
		id   int64
		data string
	)
	err = tx.QueryRowContext(ctx, `SELECT id, data FROM trainings WHERE user_id = ? AND src_key = ? AND src_key != ''`, sc.uid, key).Scan(&id, &data)
	if errors.Is(err, sql.ErrNoRows) {
		err = tx.QueryRowContext(ctx, `SELECT id, data FROM trainings WHERE user_id = ? AND started_at <= ? AND ended_at >= ?
			ORDER BY started_at LIMIT 1`, sc.uid, t.EndedAt.Add(TrainingJoin).Format(tsLayout), t.StartedAt.Add(-TrainingJoin).Format(tsLayout)).Scan(&id, &data)
		if err == nil {
			var old Training
			if json.Unmarshal([]byte(data), &old) == nil {
				old.merge(t)
				*t = old
			}
		}
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	t.ID = id
	b, err := json.Marshal(t)
	if err != nil {
		return err
	}
	if id != 0 {
		_, err = tx.ExecContext(ctx, `UPDATE trainings SET started_at = ?, ended_at = ?, data = ? WHERE id = ?`,
			t.StartedAt.Format(tsLayout), t.EndedAt.Format(tsLayout), string(b), id)
	} else {
		var res sql.Result
		res, err = tx.ExecContext(ctx, `INSERT INTO trainings (user_id, src_key, started_at, ended_at, data) VALUES (?, ?, ?, ?, ?)`,
			sc.uid, key, t.StartedAt.Format(tsLayout), t.EndedAt.Format(tsLayout), string(b))
		if err == nil {
			t.ID, err = res.LastInsertId()
		}
	}
	if err != nil {
		return err
	}
	return tx.Commit()
}

// SetTrainingFocus changes the mechanic a training was about.
func (sc *Scope) SetTrainingFocus(ctx context.Context, id int64, focus string) (*Training, error) {
	focus = strings.ToLower(strings.TrimSpace(focus))
	if !ValidFocus(focus) {
		return nil, fmt.Errorf("%w: unknown focus %q", ErrInvalidTraining, focus)
	}
	var data string
	err := sc.s.db.QueryRowContext(ctx, `SELECT data FROM trainings WHERE id = ? AND user_id = ?`, id, sc.uid).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}
	var t Training
	if err := json.Unmarshal([]byte(data), &t); err != nil {
		return nil, err
	}
	t.ID, t.Focus = id, focus
	b, err := json.Marshal(t)
	if err != nil {
		return nil, err
	}
	_, err = sc.s.db.ExecContext(ctx, `UPDATE trainings SET data = ? WHERE id = ?`, string(b), id)
	return &t, err
}

// TrainingCount returns the number of the user's trainings.
func (sc *Scope) TrainingCount(ctx context.Context) (int, error) {
	var n int
	err := sc.s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM trainings WHERE user_id = ?`, sc.uid).Scan(&n)
	return n, err
}

// DeleteTraining removes one of the user's trainings.
func (sc *Scope) DeleteTraining(ctx context.Context, id int64) error {
	res, err := sc.s.db.ExecContext(ctx, `DELETE FROM trainings WHERE id = ? AND user_id = ?`, id, sc.uid)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}
