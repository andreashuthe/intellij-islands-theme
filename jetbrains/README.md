# JetBrains sources

Unmodified copies from [JetBrains/intellij-community](https://github.com/JetBrains/intellij-community)
(Apache License 2.0, see `LICENSE-Apache-2.0.txt`), commit `87dbad7ad4a6bc365b38215aa41af942b4c00d41`.
`scripts/build.js` generates the VS Code themes from them.

| File | Source |
|---|---|
| `IslandSchemeDark.xml` | `platform/platform-resources/src/themes/islands/IslandSchemeDark.xml` (editor scheme "Islands Dark") |
| `expUI_lightScheme.xml` | `platform/platform-resources/src/themes/expUI/expUI_lightScheme.xml` (editor scheme "Light", used by Islands Light) |
| `DefaultColorSchemesManager.xml` | `platform/platform-resources/src/DefaultColorSchemesManager.xml` (bundled "Default" and "Darcula") |
| `ManyIslandsDark.theme.json`, `ManyIslandsLight.theme.json` | `platform/platform-resources/src/themes/islands/` (UI themes) |
| `expUI_*.theme.json` | `platform/platform-resources/src/themes/expUI/` (parent UI themes) |
| `Darcula_Kotlin.xml`, `Default_Kotlin.xml` | `plugins/kotlin/base/resources/resources/colorScheme/` |
| `Markdown*.xml`, `YAML*.xml`, `Xml*.xml` | `plugins/markdown/…`, `plugins/yaml/…`, `xml/xml-ui-common/…` (`colorSchemes/`) |
| `PythonDarcula.xml`, `PythonDefault.xml` | `python/python-code-insight/resources/colorSchemes/` |
| `RustDarcula.xml`, `RustDefault.xml` | [intellij-rust](https://github.com/intellij-rust/intellij-rust) `src/main/resources/org/rust/ide/colors/` (MIT, `LICENSE-intellij-rust-MIT.txt`, commit `c6657c02`) |
| `ide-additions.json` | color values the JavaScript/TypeScript plugin (WebStorm) and the Go plugin (GoLand) register for the Darcula/Default schemes – only the values, the plugins are not open source |

To update: copy newer versions of these files here, run `npm test`, check the screenshots (`npm run screenshots`).
