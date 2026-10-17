// Package config handles config.json in the data directory.
package config

import (
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Config is the user configuration (JSON shape of GET/PUT /api/config).
type Config struct {
	PlayerNames   []string `json:"player_names"`
	PlayerIDs     []string `json:"player_ids"`
	DefaultTag    string   `json:"default_tag"`
	RLInstallDir  string   `json:"rl_install_dir"`
	DashboardPort int      `json:"dashboard_port"`
	RLPort        int      `json:"rl_port"`
	Goal          Goal     `json:"goal"`
	// TiltStreak: consecutive losses in a session that suggest a break
	// (desktop notification); 0 = no tilt alerts.
	TiltStreak int `json:"tilt_streak"`
	// BreakEvery: a notification suggests a break of BreakMinutes after every
	// BreakEvery matches of a session (Pomodoro-like); 0 = never.
	BreakEvery   int `json:"break_every"`
	BreakMinutes int `json:"break_minutes"`
	// Warmup is the warm-up plan of the training page.
	Warmup Warmup `json:"warmup"`
	// DiscordWebhook (server mode): the player's own Discord webhook, where
	// their highlights, session recaps and the weekly leaderboard are posted
	// ("" = nothing is posted). Never shown to the other players.
	DiscordWebhook string `json:"discord_webhook"`
}

// ValidDiscordWebhook reports whether u is a Discord webhook URL (the server
// only ever posts to Discord, never to an address a player typed).
func ValidDiscordWebhook(u string) bool {
	p, err := url.Parse(u)
	if err != nil || p.Scheme != "https" || p.User != nil || p.Port() != "" {
		return false
	}
	switch strings.ToLower(p.Hostname()) {
	case "discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com":
	default:
		return false
	}
	return strings.HasPrefix(p.Path, "/api/webhooks/") && len(p.Path) > len("/api/webhooks/")
}

// Warmup is a warm-up plan: blocks played in order before the matches. No
// blocks = the dashboard builds them from the player's stats.
type Warmup struct {
	Minutes int           `json:"minutes"` // length of an automatic plan
	Blocks  []WarmupBlock `json:"blocks"`
}

// WarmupBlock is one mechanic trained for some minutes (focus: see
// store.Focuses).
type WarmupBlock struct {
	Focus   string `json:"focus"`
	Minutes int    `json:"minutes"`
}

// MaxWarmupBlocks bounds a warm-up plan.
const MaxWarmupBlocks = 8

// Goal is the daily games objective shown in the calendar view.
// Empty season dates are resolved by the dashboard (start = first matching game
// or today, end = start + 99 days).
type Goal struct {
	Mode        string `json:"mode"`         // "1v1".."4v4" or "all"
	Daily       int    `json:"daily"`        // games per day
	SeasonStart string `json:"season_start"` // YYYY-MM-DD or ""
	SeasonEnd   string `json:"season_end"`   // YYYY-MM-DD or ""
}

const dateLayout = "2006-01-02"

// Defaults returns the default configuration.
func Defaults() Config {
	return Config{PlayerNames: []string{}, PlayerIDs: []string{}, DefaultTag: "ranked", DashboardPort: 8765, RLPort: 49123,
		Goal: Goal{Mode: "1v1", Daily: 10}, TiltStreak: 3, BreakMinutes: 5, Warmup: Warmup{Minutes: 15, Blocks: []WarmupBlock{}}}
}

// Normalize fixes invalid / missing values.
func (c *Config) Normalize() {
	d := Defaults()
	c.PlayerNames = cleanList(c.PlayerNames)
	c.PlayerIDs = cleanList(c.PlayerIDs)
	c.DefaultTag = strings.ToLower(strings.TrimSpace(c.DefaultTag))
	switch c.DefaultTag {
	case "ranked", "casual", "tournament", "private", "other":
	default:
		c.DefaultTag = d.DefaultTag
	}
	c.RLInstallDir = strings.TrimSpace(c.RLInstallDir)
	if c.DashboardPort <= 0 || c.DashboardPort > 65535 {
		c.DashboardPort = d.DashboardPort
	}
	if c.RLPort <= 0 || c.RLPort > 65535 {
		c.RLPort = d.RLPort
	}
	c.Goal.Mode = strings.ToLower(strings.TrimSpace(c.Goal.Mode))
	switch c.Goal.Mode {
	case "1v1", "2v2", "3v3", "4v4", "all":
	default:
		c.Goal.Mode = d.Goal.Mode
	}
	c.DiscordWebhook = strings.TrimSpace(c.DiscordWebhook)
	if c.DiscordWebhook != "" && !ValidDiscordWebhook(c.DiscordWebhook) {
		c.DiscordWebhook = ""
	}
	if c.TiltStreak < 0 || c.TiltStreak > 10 {
		c.TiltStreak = d.TiltStreak
	}
	if c.BreakEvery < 0 || c.BreakEvery > 20 {
		c.BreakEvery = d.BreakEvery
	}
	if c.BreakMinutes <= 0 || c.BreakMinutes > 30 {
		c.BreakMinutes = d.BreakMinutes
	}
	if c.Warmup.Minutes < 5 || c.Warmup.Minutes > 60 {
		c.Warmup.Minutes = d.Warmup.Minutes
	}
	blocks := []WarmupBlock{}
	for _, b := range c.Warmup.Blocks {
		b.Focus = strings.ToLower(strings.TrimSpace(b.Focus))
		if b.Focus == "" || len(b.Focus) > 20 || b.Minutes <= 0 || b.Minutes > 60 || len(blocks) == MaxWarmupBlocks {
			continue
		}
		blocks = append(blocks, b)
	}
	c.Warmup.Blocks = blocks
	if c.Goal.Daily <= 0 || c.Goal.Daily > 200 {
		c.Goal.Daily = d.Goal.Daily
	}
	c.Goal.SeasonStart = cleanDate(c.Goal.SeasonStart)
	c.Goal.SeasonEnd = cleanDate(c.Goal.SeasonEnd)
	if c.Goal.SeasonStart != "" && c.Goal.SeasonEnd != "" && c.Goal.SeasonEnd < c.Goal.SeasonStart {
		c.Goal.SeasonEnd = ""
	}
}

// cleanDate keeps a valid YYYY-MM-DD date, else returns "".
func cleanDate(s string) string {
	s = strings.TrimSpace(s)
	if _, err := time.Parse(dateLayout, s); err != nil {
		return ""
	}
	return s
}

func cleanList(in []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, s := range in {
		s = strings.TrimSpace(s)
		k := strings.ToLower(s)
		if s == "" || seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, s)
	}
	return out
}

// Manager gives concurrent-safe access to the config file.
type Manager struct {
	path string
	mu   sync.RWMutex
	cfg  Config
}

// Load reads path (missing file => defaults, written back).
func Load(path string) (*Manager, error) {
	m := &Manager{path: path, cfg: Defaults()}
	b, err := os.ReadFile(path)
	switch {
	case errors.Is(err, os.ErrNotExist):
		m.cfg.Normalize()
		return m, m.saveLocked()
	case err != nil:
		return nil, err
	}
	c := Defaults()
	if err := json.Unmarshal(b, &c); err != nil {
		// Keep a copy of the broken file and continue with defaults.
		_ = os.WriteFile(path+".bad", b, 0o644)
		c = Defaults()
	}
	c.Normalize()
	m.cfg = c
	return m, nil
}

// Path returns the file path.
func (m *Manager) Path() string { return m.path }

// Get returns a copy of the config.
func (m *Manager) Get() Config {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c := m.cfg
	c.PlayerNames = append([]string{}, c.PlayerNames...)
	c.PlayerIDs = append([]string{}, c.PlayerIDs...)
	return c
}

// Set replaces and persists the config.
func (m *Manager) Set(c Config) (Config, error) {
	c.Normalize()
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cfg = c
	return c, m.saveLocked()
}

// AddAutoIdentity persists an auto-detected identity only when the config
// has no identity yet. Returns true when it was stored.
func (m *Manager) AddAutoIdentity(name, primaryID string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.cfg.PlayerIDs) > 0 || len(m.cfg.PlayerNames) > 0 {
		return false, nil
	}
	if primaryID != "" {
		m.cfg.PlayerIDs = []string{primaryID}
	}
	if name != "" {
		m.cfg.PlayerNames = []string{name}
	}
	return true, m.saveLocked()
}

func (m *Manager) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(m.path), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(m.cfg, "", "  ")
	if err != nil {
		return err
	}
	tmp := m.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, m.path)
}
