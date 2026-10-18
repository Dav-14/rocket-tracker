package domain

import "encoding/json"

// MarshalJSON preserves legacy numeric fields, but never publishes invented
// car averages when only demolition time was observed.
func (m Movement) MarshalJSON() ([]byte, error) {
	type plain Movement
	if m.CarSampleS == nil || *m.CarSampleS > 0 {
		return json.Marshal(plain(m))
	}
	return json.Marshal(struct {
		plain
		AvgSpeed      *float64 `json:"avg_speed"`
		SupersonicPct *float64 `json:"supersonic_pct"`
		GroundPct     *float64 `json:"ground_pct"`
		WallPct       *float64 `json:"wall_pct"`
		AirPct        *float64 `json:"air_pct"`
		AvgBoost      *float64 `json:"avg_boost"`
		ZeroBoostPct  *float64 `json:"zero_boost_pct"`
		FullBoostPct  *float64 `json:"full_boost_pct"`
		BoostingPct   *float64 `json:"boosting_pct"`
		PowerslidePct *float64 `json:"powerslide_pct"`
	}{plain: plain(m)})
}
