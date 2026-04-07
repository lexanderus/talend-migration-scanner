# Talend Migration Scanner

Free browser-based tool that scans a Talend Open Studio project ZIP
and reports the percentage of jobs that can automatically migrate to Visual Flow.

**[Try it →](https://talend-scanner.visualflow.io)**

## Features
- 🔒 No data leaves your browser — ZIP analyzed locally
- ⚡ Instant results — analysis in seconds
- 📊 AUTO / PARTIAL / MANUAL / SKIP classification
- 📄 PDF report download
- 🆓 Free & open source (MIT)

## How to use
1. Go to [talend-scanner.visualflow.io](https://talend-scanner.visualflow.io)
2. Drop your TOS project ZIP (File → Export → Export items)
3. View migration readiness report
4. Download PDF for stakeholders

## Supported versions
Talend Open Studio for Data Integration 6.x · 7.x · 8.x

## Sync with migrate_to_vf.py
`component-map-umd.js` and `component-map.js` must be kept in sync with
the production migration script. See the sync comment at the top of each file.

## Local development
```bash
npm install        # installs fast-xml-parser for tests only
npm test           # run unit tests
npm run serve      # start local server at http://localhost:8080
```

## License
MIT
