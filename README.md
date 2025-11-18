# EcuTek Log Viewer

**Current build:** `preAlpha 1.3.10`

A modern, client-side web application for viewing and analyzing EcuTek CSV log files. Built with vanilla JavaScript, Plotly.js, and PapaParse for robust CSV parsing and interactive data visualization.

## 🚀 Features

- **Signal Matrix (index.html)** – individual parameter plots with inline readouts
- **Correlation Lab (compare.html)** – unified comparison interface with dual-log overlay
- **Auto Scale + Power Scaling** – normalize wildly different signals before fine-grained exponent tweaks
- **Smoothing & Highlights** – moving averages plus threshold-based event markers
- **Change Log & Hints modals** – in-app documentation for every release
- **Session Storage** – Persistent file caching between sessions
- **Metadata Display** – Vehicle, VIN, ECU Call IDs, and Programming Dongle info
- **Real-time Plotting** – Click-to-select with readouts; unified RAW readout in analysis

## 🆕 What’s new in preAlpha 1.3.10

- Dual-log overlay now supports smoothing windows and threshold-based event highlights.
- Auto Scale button normalizes enabled traces to a shared amplitude before exponent tweaks.
- Time-window sliders respect both start and end bounds without unexpected zooms.
- In-app Change Log and Hints modals document every release and provide quick tips.

## 📁 Project Structure

```
ecutek-log-viewer/
├── index.html          # Time Plot interface (main page)
├── compare.html        # Analysis interface (comparison page)
├── app.js             # Time Plot logic and file handling
├── compare.js         # Analysis logic and comparison features
├── parser.js          # CSV parsing utilities and data processing
├── style.css          # Styling and responsive design
├── main.js            # Additional utilities (if present)
├── README.md          # Project documentation
├── CHANGELOG.md       # Development changelog
├── CODEOWNERS         # Repository ownership rules
├── cursorrules.json   # Cursor IDE configuration
└── restore-point-v1.0.0/  # Backup of v1.0.0 release
```

## 🛠️ Setup & Installation

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No server-side dependencies required (client-side only)

### Local Development Server

#### Option 1: Python HTTP Server
```bash
# Python 3

# Python 2
python -m SimpleHTTPServer 8000
```

#### Option 2: Node.js HTTP Server
```bash
# Install http-server globally
npm install -g http-server

# Run server
http-server -p 8000
```

#### Option 3: Live Server (VS Code Extension)
1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Running the Application

1. **Start your local server** using one of the methods above
2. **Open your browser** and navigate to:
   - `http://localhost:8000` (for Python/Node.js servers)
   - `http://127.0.0.1:5500` (for Live Server)
3. **Upload EcuTek CSV files** using the file picker
4. **Switch between views** using the dropdown (or mobile links in the taskbar):
   - **Time Plot**: Individual parameter visualization
   - **Analysis**: Unified comparison interface

## 📊 Usage

### File Upload
- **Supported formats**: `.csv`, `.txt`, `.log`
- **File picker** - Click "Choose Log File" to browse
- **Session persistence** - Files are cached in browser storage

### Time Plot View (`index.html`)
- **Individual parameter plots** with mini charts
- **Click-to-select**: highlight node and show RAW value below plot
- **No in-plot hover**, no scrollZoom; X-axis = Time; skips Time-vs-Time
- **Parameter filtering** - skips invalid/empty data columns

### Analysis View (`compare.html`)
- **Unified comparison interface** for multiple parameters
- **Dual-log overlays** – load a comparison CSV/TXT for dashed reference traces
- **Smoothing & event highlights** – moving-average windows and threshold markers
- **Cursor snapping** and click-to-snap; unified readout with RAW values
- **Auto Scale + exponent controls** – quick normalization followed by precise tweaks
- **Auto Y rescale within current X window; X range preserved**
- **Presets**: preloads Engine Speed, Fuel Pressure, Fuel Trim Short Term, MAP

### Scaling & Normalization
- **True logarithmic scaling** with base-10 decades
- **Auto Scale** – aligns each enabled trace to a shared amplitude target
- **Modifier shortcuts / fine controls** for desktop (Shift/Alt) and buttons for mobile
- **Dynamic annotations** showing peak values
- **Enhanced tooltips** with raw and scaled values

## 🔧 Technical Details

### Dependencies
- **Plotly.js** (v2.35.2) - Interactive charting library
- **PapaParse** (v5.4.1) - CSV parsing library
- **Vanilla JavaScript** - No framework dependencies

### Key Components

#### `parser.js`
- CSV parsing with metadata extraction
- Time column detection
- Numeric data validation
- Vehicle metadata parsing (VIN, ECU Call IDs, etc.)

#### `app.js`
- Time Plot view logic
- File upload handling
- Session storage management
- Plot generation and rendering

#### `compare.js`
- Analysis view logic
- Time slider implementation
- Log scale controls
- Series comparison features

#### `style.css`
- Mobile-first responsive design
- Dark theme styling
- Interactive UI components
- Custom plot styling

### Browser Compatibility
- **Chrome** 80+
- **Firefox** 75+
- **Safari** 13+
- **Edge** 80+

## 🎯 Key Features

### Data Processing
- **Automatic time detection** - Finds Time/Timestamp columns
- **Metadata extraction** - Parses vehicle information from CSV headers
- **Data validation** - Filters out non-numeric columns
- **Performance optimization** - Uses scattergl for large datasets

### User Experience
- **Session persistence** - Files remain available after page refresh
- **Toast notifications** - User feedback for actions and errors
- **Responsive design** - Works on desktop, tablet, and mobile
- **Accessibility** - Keyboard navigation and screen reader support

### Visualization
- **Interactive plots** - Click selection and cursor snapping
- **Color coding** - Consistent parameter colors across views
- **Readouts** - Time Plot shows value under each plot; Analysis shows unified RAW values box
- **Time synchronization** - Coordinated time ranges across plots

## 🐛 Troubleshooting

### Common Issues

**File won't upload:**
- Check file format (must be .csv, .txt, or .log)
- Ensure file contains valid CSV data with a Time column
- Try refreshing the page and uploading again

**Plots not displaying:**
- Verify CSV has numeric data columns
- Check browser console for error messages
- Ensure local server is running correctly
 - Confirm a Time column exists (X-axis is Time)

**Performance issues:**
- Large files (>10MB) may load slowly
- Use Mega Plot view for better performance with many parameters
- Consider splitting very large log files

### Browser Console Errors
- Check for CORS issues when running locally
- Ensure all JavaScript files are loading correctly
- Verify Plotly.js and PapaParse CDN links are accessible

### Loading Screen
- Displayed only on initial page load/refresh. Switching between Time Plot and Analysis suppresses the startup loading screen.

## 📈 Development

### Adding New Features
1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test thoroughly** with various CSV formats
5. **Submit a pull request**

### Code Style
- **Vanilla JavaScript** - No framework dependencies
- **ES6 modules** - Use import/export syntax
- **Mobile-first** - Responsive design approach
- **Performance-focused** - Optimize for large datasets

## 📄 License

This project is open source. See the repository for license details.

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines and ensure your code follows the project's coding standards.

## 📞 Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Review the CHANGELOG.md for recent updates
3. Open an issue on the repository

---

**Made by AK Everlasting Dev · v1.3.1**

