# web/abyat/packs: أبيات poet packs

Each `<poetId>-<sha12>.json.gz` holds the part of one poet's ديوان that is not
in the app's bundled core library; `manifest.json` lists them for the latest
library build. Written by `apps/abyat/tool/build_library.dart` from
`data/poetry/library.json`; do not edit by hand.

- Format, app behaviour and publishing rules: `docs/specs/abyat-poet-packs.md`.
- Where the poems come from and how each poet was checked:
  `data/poetry/PROVENANCE.md` (Arabic Wikisource; Qafiyah «قافية»,
  qafiyah.com, for some poets Wikisource lacks; every attribution confirmed
  by a second source).
- Files are immutable (the name carries the content's SHA-256). On the live
  site, keep older files while app versions that list them are in use.
