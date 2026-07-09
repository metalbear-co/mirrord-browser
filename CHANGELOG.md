# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This project uses [*towncrier*](https://towncrier.readthedocs.io/) and the changes for the upcoming release can be found in <https://github.com/metalbear-co/mirrord-browser/tree/main/changelog.d/>.

<!-- towncrier release notes start -->

## [0.5.2](https://github.com/metalbear-co/mirrord-browser/tree/0.5.2) - 2026-07-09


### Fixed

- The mirrord icon in the popup now uses the light logo in both light and dark
  mode, so it stays legible instead of fading into a dark popup background.

## [0.5.1](https://github.com/metalbear-co/mirrord-browser/tree/0.5.1) - 2026-06-29


### Fixed

- The joined-session banner no longer flips to "Session ended" when the local
  `mirrord` session reconnects (stop → start). Liveness now tracks the session
  key rather than a specific session id, and a session that drops out shows an
  amber "Waiting for session" state for a grace period before it can be
  dismissed.

## [0.5.0](https://github.com/metalbear-co/mirrord-browser/tree/0.5.0) - 2026-06-18

Initial changelog entry. Releases before this point are tracked in the
[GitHub releases](https://github.com/metalbear-co/mirrord-browser/releases) page.
