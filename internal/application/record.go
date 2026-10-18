package application

import (
	"context"
	"rocket-tracker/internal/domain"
)

// LocalRecords commits a record and its delivery intent atomically. A nil
// destination means local-only; an unverified destination must remain held.
type LocalRecords interface {
	RecordResult(context.Context, *domain.Match, *domain.Destination) error
	RecordTraining(context.Context, *domain.Training, *domain.Destination) error
}

type Recorder struct {
	Records       LocalRecords
	Destination   func() (*domain.Destination, error)
	AfterResult   func(*domain.Match)
	AfterTraining func(*domain.Training)
}

func (r Recorder) destination() (*domain.Destination, error) {
	if r.Destination == nil {
		return nil, nil
	}
	return r.Destination()
}
func (r Recorder) RecordResult(ctx context.Context, m *domain.Match) error {
	d, err := r.destination()
	if err != nil {
		return err
	}
	if err = r.Records.RecordResult(ctx, m, d); err != nil {
		return err
	}
	if r.AfterResult != nil {
		r.AfterResult(m)
	}
	return nil
}
func (r Recorder) RecordTraining(ctx context.Context, t *domain.Training) error {
	d, err := r.destination()
	if err != nil {
		return err
	}
	if err = r.Records.RecordTraining(ctx, t, d); err != nil {
		return err
	}
	if r.AfterTraining != nil {
		r.AfterTraining(t)
	}
	return nil
}
