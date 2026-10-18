// Package web embeds only the dashboard's runtime assets.
package web

import "embed"

//go:embed index.html setup.html app.js setup.js i18n.js style.css vendor/chart.umd.min.js
var FS embed.FS
