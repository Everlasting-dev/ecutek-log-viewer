# EcuTek Log Viewer - Development Changelog

## Version History

### preAlpha 1.3.11 – GR6 Shift Lab & Log Archiver
**Date:** November 2025  
**Status:** 🚧 Pre-release

#### ✨ Features
- **Metadata Grid** – duration, sampling rate, RPM span, detected speed channel, GR6 shift deltas, and protection notes.
- **Archive Current Log** – one-click download of a timestamped CSV (drop into `logs/` and commit via `logvault/*` branch).
- **Line thickness sliders** – per-trace stroke control (primary + reference) to keep busy charts legible.
- **Shift Strategy Lab** – tuner-friendly gearing sandbox inspired by [blocklayer.com](https://www.blocklayer.com/rpm-gear) with drop-RPM notes and clutch/slip reminders.
- **Performance Benchmarks overhaul** – automatic speed-source detection, 0‑60 / 60‑130 / 100‑200 slices, peak G, and health overlays (boost, AFR, knock, torque cuts).
- **Wheel-slip & torque intervention detection** – metadata and performance cards now flag traction/torque limiting events automatically.
- **Correlation Lab trimmed** – only the essentials remain on-page; metadata, shift lab, and diagnostics moved under Tools with dedicated modals/tabs.

#### 🐛 Fixes
- Locked the X-axis to the Time Window sliders to eliminate random zooming while keeping Y auto-range active.
- Event highlight dropdown stays in sync with whatever Y axes are currently enabled.
- Cursor data box now uses semi-transparency so underlying traces remain visible.
- Fixed the splash/loading overlay hang and the global line-width initialization so Correlation Lab renders immediately after load.

#### 🔧 Technical
- Added `logs/` (tracked with `.gitkeep`) plus README workflow for branch-based log archival.
- `rescaleYToWindow` now respects the filtered time window and never toggles Plotly autorange.
- Performance modal no longer needs a signal dropdown; it derives the cleanest speed channel automatically.

### preAlpha 1.3.10 – Dual Log Enhancements & Auto Scale
**Date:** November 2025  
**Status:** 🚧 Pre-release

#### ✨ Features
- **Dual-log overlay upgrades** – smoothing windows plus threshold-based event highlights
- **Auto Scale** – normalizes each enabled trace before fine power-scaling adjustments
- **Change Log & Hints modals** – in-app documentation so users don’t need to leave the UI

#### 🐛 Fixes
- Fixed time-slider behavior so both start and end bounds stay in sync without unexpected zooming
- Highlight dropdown now lists only the traces currently enabled in the axis configuration

#### 🔧 Technical
- Shortened splash screen to 1.5s and limited it to startup/reload events
- Added groundwork for upcoming Comparison view and mobile slide-in controls

### v1.3.1 – Performance improvements and mobile UX enhancements
**Date:** October 2025  
**Status:** 🚀 Alpha Release

#### ✨ Features
- **Faster Startup**: Reduced loading screen time from 3.5s to 1.5s for improved user experience
- **iOS Navigation Fix**: Enhanced mobile navigation with safe-area-inset support for iOS devices
- **Portrait Mode Optimization**: Better navigation bar positioning to avoid status bar conflicts

#### 🐛 Fixes
- Fixed taskbar positioning conflicts with iOS status bar in portrait mode
- Improved mobile navigation accessibility and touch targets
- Enhanced ASCII animation timing to match faster loading screen

#### 🔧 Technical
- Added CSS safe-area-inset support for modern iOS devices
- Optimized loading screen timing across all main files (app.js, compare.js, about.js)
- Improved mobile-first responsive design

### v1.3.0 – Mobile optimizations and cursor improvements
**Date:** September 2025  
**Status:** ✅ Released

#### ✨ Features
- Portrait side drawer (swipe from left) with taskbar links
- Dotted blue cursor in Multi and Mega plots: tap-to-snap + drag-to-scroll

#### 🐛 Fixes
- Keep plots static while dragging cursor (no accidental pan)
- Clamp snapping within data range; improved touch handling on iOS
- Mini box shows RAW values via `customdata`

#### 📦 Misc
- Added restore point folder `restore-point-v1.3.0/`

### v1.0.1 (Current) - 🔧 Log Scale & Metadata Fixes
**Date:** [Current Date]  
**Status:** ✅ Complete

#### 🐛 Bug Fixes
- **Fixed CSV metadata parsing** - Vehicle, VIN, ECU Call IDs now display correctly
- **Improved CSV parser** - Separates metadata from numeric data in first 5 rows
- **Fixed time slider** - Proper rangeslider functionality restored

#### 🔧 Log Scale Implementation
- **True logarithmic scaling** - Multiplicative scaling with base-10 decades
- **Log step factor** - Each click multiplies/divides by 10^0.1 ≈ 1.2589
- **Proper scaling buttons** - Up (×factor) and Down (÷factor) controls
- **Enhanced tooltips** - Show raw values, scaled values, and time
- **Max/Min annotations** - Dynamic peak detection within time range
- **Series info box** - Floating annotation showing min/max values for all enabled series

#### 🎨 UI Improvements
- **Compact layout** - Reduced spacing for better single-page viewing
- **Removed log toggle** - Simplified to pure multiplicative scaling
- **Better hover information** - Raw and scaled values displayed
- **Color-coded annotations** - Max/Min labels match series colors
- **Clean legend** - Shows only parameter names without scaling suffixes
- **Series info panel** - Top-right floating box with min/max values and scaling info
- **Custom time slider** - External dual-range slider with gradient fill and smooth controls
- **Time range label** - Clear labeling for the time slider functionality
- **Removed built-in rangeslider** - Replaced with custom external slider for better control
- **Click-to-snap functionality** - Click on plot to show vertical cursor line and update series info
- **Disabled zoom/pan** - Removed zoom and pan controls for cleaner interaction
- **Back to Top button** - Floating button for quick navigation to top of page
- **Enhanced series info box** - Top-right floating box with min/max values for all enabled series
- **Metadata display** - Vehicle, VIN, ECU Call IDs, and Programming Dongle info on both pages
- **Smart trace rendering** - Uses scattergl for long series (>5000 points), scatter for short series
- **Clean metadata parsing** - Extracts metadata from first 5 CSV rows as key-value pairs

### v1.0.0 - 🎉 Initial Release
**Date:** [Previous Date]  
**Status:** ✅ Complete

#### 🎯 Major Features Implemented
- **Multi-Plot View** (`index.html`) - Individual parameter visualization
- **Mega Plot View** (`compare.html`) - Unified comparison interface
- **CSV Parser** (`parser.js`) - Robust EcuTek log file parsing
- **File Upload System** - Drag & drop + file picker support
- **Session Storage** - Persistent file caching between sessions
- **Responsive Design** - Mobile-first approach

#### 🔧 Core Functionality
- **Time-based X-axis** - Automatic time column detection
- **Parameter Filtering** - Skip invalid/empty data columns
- **Real-time Plotting** - Plotly.js integration with custom styling
- **File Metadata Display** - Vehicle, VIN, ECU Call IDs, Programming Dongle
- **View Switching** - Dropdown navigation between Multi/Mega plots
- **Toast Notifications** - User feedback system

#### 🎨 UI/UX Enhancements
- **Dark Theme** - Professional dark color scheme
- **Green Mini Plots** - Vibrant #00ff66 color for better visibility
- **File Description Panel** - Metadata display with grid layout
- **Unified Hover Tooltips** - Raw sensor values with color coding
- **Time Slider** - Prominent mini-chart above main graph in Mega Plot
- **Version Label** - v1.0.0 displayed in footer

#### 🔧 Technical Implementation
- **State Management** - Global `S` object in app.js, `ySlots` array in compare.js
- **Event Handling** - Comprehensive DOM event listeners
- **Error Handling** - Graceful error recovery and user feedback
- **Performance Optimization** - Efficient data processing and rendering
- **Cross-browser Compatibility** - Modern JavaScript with fallbacks

#### 📁 File Structure
```
ecutek-log-viewer/
├── index.html          # Multi-plot interface
├── compare.html        # Mega plot interface
├── app.js             # Multi-plot logic
├── compare.js         # Mega plot logic
├── parser.js          # CSV parsing utilities
├── style.css          # Styling and responsive design
├── README.md          # Project documentation
├── CHANGELOG.md       # This file
└── brainstorming.txt  # Feature ideas and roadmap
```

#### 🐛 Bug Fixes & Improvements
- **Merge Conflict Resolution** - Resolved 6 conflicts across app.js and compare.js
- **File Description Parsing** - Fixed CSV data extraction (was reading headers instead of values)
- **Plotly Performance** - Added guards to prevent crashes with empty data
- **Browser Caching** - Implemented cache-busting with query parameters
- **UI Consistency** - Unified features across both views
- **Event Loop Prevention** - Added syncing flags to prevent infinite relayout loops

#### 🔄 Version Control
- **Git Integration** - Full version control with meaningful commits
- **GitHub Actions** - Automated deployment to GitHub Pages
- **AI PR Review** - ChatGPT-powered code review workflow
- **Branch Protection** - Main branch protection with required reviews

---

## Development Timeline

### Phase 1: Foundation (Completed)
- [x] Basic CSV parsing and visualization
- [x] Multi-plot interface development
- [x] Responsive design implementation
- [x] File upload and session management

### Phase 2: Enhancement (Completed)
- [x] Mega plot comparison view
- [x] File metadata extraction and display
- [x] UI/UX improvements and color scheme
- [x] View switching and navigation

### Phase 3: Polish (Completed)
- [x] Bug fixes and performance optimization
- [x] Code refactoring and documentation
- [x] GitHub integration and deployment
- [x] Development workflow setup

---

## Technical Decisions

### Architecture
- **Vanilla JavaScript** - No framework dependencies for simplicity
- **Plotly.js** - Chosen for robust charting capabilities
- **Session Storage** - Client-side caching for better UX
- **Mobile-First** - Responsive design approach

### Code Style
- **ES6+ Features** - Modern JavaScript with arrow functions, destructuring
- **Functional Approach** - Pure functions where possible
- **Event-Driven** - Comprehensive event handling
- **Error-First** - Graceful error handling throughout

### Performance Considerations
- **Lazy Loading** - Data processed on-demand
- **Efficient Parsing** - Optimized CSV parsing algorithms
- **Memory Management** - Proper cleanup and garbage collection
- **Rendering Optimization** - Minimal DOM manipulation

---

## Known Issues & Limitations

### Current Limitations
- **Single File Upload** - Only one file at a time
- **No Data Export** - Charts cannot be saved as images
- **Limited Analysis** - Basic visualization only
- **No Offline Mode** - Requires internet for Plotly.js

### Browser Compatibility
- **Modern Browsers** - Chrome, Firefox, Safari, Edge
- **Mobile Support** - iOS Safari, Chrome Mobile
- **No IE Support** - Internet Explorer not supported

### Performance Notes
- **Large Files** - May slow down with very large CSV files
- **Memory Usage** - All data loaded into memory
- **Rendering** - Plotly.js can be resource-intensive

---

## Future Roadmap

### v1.1.0 (Next Release)
- [ ] Data export functionality (PNG/PDF)
- [ ] Zoom and pan controls
- [ ] Multiple file comparison
- [ ] Custom color schemes
- [ ] Keyboard shortcuts

### v1.2.0 (Medium Term)
- [ ] Statistical overlays (min/max/avg)
- [ ] Peak detection and highlighting
- [ ] Custom calculation fields
- [ ] Dark/light theme toggle
- [ ] Fullscreen mode

### v2.0.0 (Long Term)
- [ ] Machine learning features
- [ ] Cloud storage integration
- [ ] Mobile app companion
- [ ] Real-time data streaming
- [ ] Advanced analytics

---

## Development Notes

### Key Learnings
- **CSV Parsing** - Header vs data row distinction is crucial
- **Plotly.js** - Performance considerations with large datasets
- **Browser Caching** - Cache-busting essential for development
- **State Management** - Global state objects work well for this scale
- **Event Handling** - Proper cleanup prevents memory leaks

### Best Practices Established
- **Mobile-First Design** - Responsive from the start
- **Error Handling** - Graceful degradation
- **User Feedback** - Toast notifications for all actions
- **Code Organization** - Clear separation of concerns
- **Documentation** - Comprehensive changelog and comments

### Tools & Technologies
- **Editor:** Cursor AI
- **Version Control:** Git + GitHub
- **Deployment:** GitHub Pages
- **Charts:** Plotly.js
- **Styling:** CSS3 with Flexbox/Grid
- **Parsing:** Custom CSV parser

---

## Contributors

- **@ak-everlasting** - Primary developer and project maintainer
- **Cursor AI** - Development assistance and code review

---

## License

This project is proprietary software. All rights reserved.

---

*Last Updated: [Current Date]*
*Next Review: [Next Review Date]*
