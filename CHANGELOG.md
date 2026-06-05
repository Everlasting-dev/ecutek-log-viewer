# ApexLog Studio - Development Changelog

## Version History

### Apex Build 1.7.8 - ASCII Rotate Animation
**Date:** June 5, 2026
**Status:** Released

#### Fixes
- Replaced the icon-style Mega Plot rotate cue with a true ASCII phone outline.
- Animated the ASCII phone from portrait to landscape around its center point.
- Kept the permanent lightweight Mega Plot crop preview from 1.7.7.

### Apex Build 1.7.7 - Rotate Cue and Crop Preview
**Date:** June 5, 2026
**Status:** Released

#### Fixes
- Replaced the Mega Plot portrait ASCII block with a cleaner phone-and-arrows rotate cue inspired by common mobile rotate prompts.
- Made the Mega Plot crop preview permanent and visual, using a lightweight canvas sparkline instead of a duplicate Plotly chart.
- Added the current build number to the ApexLog Studio loading screen.

### Apex Build 1.7.6 - Rotate Prompt Readability
**Date:** June 5, 2026
**Status:** Released

#### Fixes
- Fixed the broken diagonal Mega Plot portrait prompt by removing rotation from the ASCII phone graphic.
- Kept animation on the rotate cue only so the instruction remains readable.

### Apex Build 1.7.5 - Mega Plot Rotate Prompt
**Date:** June 5, 2026
**Status:** Released

#### Fixes
- Refined the Mega Plot portrait-mode ASCII art into a cleaner phone-to-landscape cue.
- Shortened the portrait lock message so phone users understand the rotate requirement faster.

### Apex Build 1.7.4 - Mobile Bottom Bar Cleanup
**Date:** June 4, 2026
**Status:** Released

#### Fixes
- Removed duplicate Mini/Mega shortcuts from the lower phone action bar now that plot navigation is visible in the header.
- Let the floating action controls wrap and size more cleanly on narrow phone screens.
- Hardened the Top button by scrolling both the document root and window.
### Apex Build 1.7.3 - Mega Plot Access Only
**Date:** June 4, 2026
**Status:** Released

#### Fixes
- Restored the previous phone layout behavior for the Mega Plot after the 1.7.2 mobile reshaping made it harder to view.
- Kept the Mini/Mega phone header switcher as the minimal accessibility improvement.
- Kept the floating Mini and Mega shortcuts so phone users still have a clear way back and forth between plot views.
### Apex Build 1.7.2 - Mobile Plot Navigation
**Date:** June 4, 2026
**Status:** Released

#### Fixes
- Added a direct Mini/Mega plot switcher to the compact phone header so Mega Plot is reachable when the desktop navigation is hidden.
- Added floating Mini and Mega shortcuts on the plot pages for a clear phone back path after scrolling.
- Reworked Correlation Lab axis, enhancement, upload, and time-window controls into a single-column phone layout.
- Added vertical scroll gutters around plots so point inspection can stay precise without trapping the whole page.
- Matched the JavaScript mobile breakpoint with the CSS phone/landscape breakpoint for more consistent behavior.

### Apex Build 1.7.1 - Mega Plot Crop Stabilization
**Date:** June 4, 2026
**Status:** Released

#### Fixes
- Fixed Correlation Lab / Mega Plot time-window cropping where later log sections could autoscale from the wrong Y samples.
- Moved Y-axis autoscale to run after Plotly finishes rebuilding cropped traces, preventing stale ranges from over-zooming the chart.
- Added a minimum Y-axis span so very narrow cropped windows remain readable instead of expanding tiny fluctuations across the full plot height.
- Kept top time sliders and drag crop behavior aligned with the selected X window.

### Apex Build 1.7 – Performance & UX Overhaul
**Date:** January 27, 2026  
**Status:** ✅ Released

#### 🚀 Performance Foundation
- **Web Workers** – CSV parsing moved to background thread with progress reporting, preventing UI blocking
- **IndexedDB Migration** – Replaced sessionStorage with IndexedDB for larger capacity and persistent storage
- **Skeleton Screens** – Replaced full-screen loaders with skeleton placeholders for better perceived performance
- **Progress Indicators** – Real-time progress bars for CSV parsing operations
- **Debounce/Throttle** – Applied to slider updates and input handlers for smoother interactions

#### 📊 Plot Optimization
- **scattergl Support** – Automatic use of WebGL rendering for datasets >10,000 points
- **Data Downsampling** – LTTB (Largest-Triangle-Three-Buckets) algorithm for efficient rendering of large datasets
- **Lazy Rendering** – Intersection Observer API for rendering plots only when entering viewport
- **Performance Tuning** – Optimized rendering pipeline for faster initial load and smoother interactions

#### ⌨️ Core UX Improvements
- **Keyboard Shortcuts** – Ctrl/Cmd+O (open), Ctrl/Cmd+S (save), Esc (close modals), Arrow keys (navigate plots)
- **Enhanced File Handling** – Improved drag-and-drop with visual feedback, clickable dropzone, recent files menu with thumbnails
- **Export Options** – PNG/SVG export for individual plots, ZIP export for all plots, PDF report generation
- **Mobile Improvements** – Touch gestures (swipe navigation, long-press context menu), bottom sheet modals, adaptive UI

#### 🎯 Advanced Features
- **Annotations System** – Mark events at specific timestamps (knock, shift points, boost spikes, etc.) with notes and color coding
- **Templates & Presets** – Save plot configurations for quick reuse, includes default presets for common analysis scenarios
- **Shareable Links** – Generate shareable URLs for cloud-uploaded logs with view configuration
- **Quick Search** – Type to jump to plots by parameter name prefix (e.g., type "wh" to find "Wheel Speed")

#### 🐛 Fixes
- Fixed Templates & Presets and Annotations menu items not responding to clicks
- Improved dropdown menu handling with ID-based event handlers
- Enhanced error handling and user feedback throughout

#### 🔧 Technical
- Modular architecture with separate modules for utilities, storage, downsampling, shortcuts, export, mobile, annotations, templates, and shareable links
- Cache-bust query params bumped to 1.5.0 across HTML/JS/CSS
- Improved code organization and maintainability

### preAlpha 1.4 – Cloud archive + session logging
**Date:** December 2025  
**Status:** ✅ Released

#### ✨ Features
- **Archive modal upload** – Upload current log + remark to Supabase; entry lives under Tools ▸ Log Metadata & Archive.
- **Remark-first metadata** – Supabase rows store your remark first, then path/name/size/page/timestamp.
- **Session logging** – Client inserts IP, user agent, remark, file name, size, and page into Supabase (write-only anon).
- **Classic loader only** – Retro loader removed; unified ASCII loader.
- **Compare sliders restored** – Start/end sliders retained; toggle/reset row removed.
- **Cloud Save Note as filename** – Uploaded files are renamed to the content of the Cloud Save Note box for easy identification.
- **Auto-close archive modal** – Modal automatically closes after successful upload.
- **Help dropdown links** – Added Documentation link to GitHub repo and ECU Knowledge Base link to help dropdown.
- **Experimental label** – Comparison Log labeled as "(experimental)" to indicate it's not fully stable.

#### 🐛 Fixes
- Guards against cloud upload when no file is loaded; clearer errors when Supabase config is missing.
- Fixed compare page loading screen stuck issue – loading screen now starts hidden and has multiple safety checks.
- Removed blocking prompt() call that prevented CSV file uploads from working.
- Added null checks for file input elements to prevent errors when elements aren't found.
- Fixed index page Tools ▸ Log Metadata & Archive dropdown to properly open the modal.
- Fixed compare page Top button positioning to match index page behavior.

#### 🔧 Technical
- Cache-bust query params bumped to 1.4.0 across HTML/JS/CSS.
- Session log insert uses client IP fetch fallback and anon insert only.
- Loading screen initialization improved with error handling and safety timeouts.
- File upload handlers now include proper null checks and error handling.

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
- **CSV Parser** (`parser.js`) - Robust ECU log file parsing
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
apexlog-studio/
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
