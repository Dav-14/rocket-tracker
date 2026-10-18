// Package buildinfo holds the version shared by the desktop app and server.
package buildinfo

// Version is injected at build time with -ldflags
// "-X rocket-tracker/internal/buildinfo.Version=1.2.3".
// Plain builds remain development builds and do not check for automatic updates.
var Version = "dev"
