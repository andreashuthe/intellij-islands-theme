# Changelog

All notable changes to this extension are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/).

Add new entries under **Unreleased** — the release workflow turns that section into the new version
and uses it as the GitHub release notes.

## [Unreleased]

## [1.0.1] - 2026-11-11

## [1.0.0] - 2026-11-11

### Added
- **Islands Dark** and **Islands Light**, generated from IntelliJ IDEA's Islands editor schemes and UI themes.
- Syntax colors resolved like IntelliJ does (own value → fallback key → parent scheme), for Java, Kotlin, XML/HTML,
  JSON, YAML, properties, Markdown and generic TextMate scopes of other languages.
- Semantic token colors for the JetBrains language server (Java and Kotlin by IntelliJ IDEA): fields, static/final
  fields, type parameters, annotations, Kotlin function declarations, package-level functions, mutable `var`s,
  deprecated members.
- IntelliJ UI colors incl. VS Code's modern (floating) layout, file status, diff and console colors.
- Language specific colors like the JetBrains IDEs for Python (PyCharm), TypeScript/JavaScript, HTML, CSS (WebStorm),
  Go (GoLand) and Rust (RustRover), approximated for PHP and C/C++ – TextMate scopes and semantic tokens of
  Pylance, VS Code's TS server, rust-analyzer, gopls and clangd.
