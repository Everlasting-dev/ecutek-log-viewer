# EcuTek Log Viewer

A modern, client-side web application for viewing and analyzing EcuTek CSV log files. Built with vanilla JavaScript, Plotly.js, and PapaParse for robust CSV parsing and interactive data visualization.

## 🚀 Features

- **Multi-Plot View** - Individual parameter visualization with mini plots
- **Mega Plot View** - Unified comparison interface with time slider
- **Log Scale Support** - True logarithmic scaling with multiplicative controls
- **File Upload** - Drag & drop + file picker support
- **Session Storage** - Persistent file caching between sessions
- **Mobile-First Design** - Responsive layout optimized for all devices
- **Metadata Display** - Vehicle, VIN, ECU Call IDs, and Programming Dongle info
- **Real-time Plotting** - Interactive charts with hover tooltips and annotations

## 📁 Project Structure

```
ecutek-log-viewer/
├── index.html          # Multi-plot interface (main page)
├── compare.html        # Mega plot interface (comparison page)
├── app.js             # Multi-plot logic and file handling
├── compare.js         # Mega plot logic and comparison features
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
python -m http.server 8000

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
3. **Upload EcuTek CSV files** using the file picker or drag & drop
4. **Switch between views** using the dropdown menu:
   - **Multi Plot**: Individual parameter visualization
   - **Mega Plot**: Unified comparison interface

## 📊 Usage

### File Upload
- **Supported formats**: `.csv`, `.txt`, `.log`
- **Drag & drop** files directly onto the upload area
- **File picker** - Click "Choose Log File" to browse
- **Session persistence** - Files are cached in browser storage

### Multi-Plot View (`index.html`)
- **Individual parameter plots** with mini charts
- **Hover tooltips** showing raw sensor values
- **Time-based X-axis** with automatic detection
- **Parameter filtering** - skips invalid/empty data columns

### Mega Plot View (`compare.html`)
- **Unified comparison interface** for multiple parameters
- **Time slider** for range selection
- **Log scale controls** with multiplicative scaling
- **Series info box** with min/max values
- **Click-to-snap** functionality for precise time selection

### Log Scale Features
- **True logarithmic scaling** with base-10 decades
- **Multiplicative controls** - Up (×1.2589) and Down (÷1.2589)
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
- Multi-plot view logic
- File upload handling
- Session storage management
- Plot generation and rendering

#### `compare.js`
- Mega plot view logic
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
- **Interactive plots** - Zoom, pan, hover, and click interactions
- **Color coding** - Consistent parameter colors across views
- **Annotations** - Peak detection and value highlighting
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

**Performance issues:**
- Large files (>10MB) may load slowly
- Use Mega Plot view for better performance with many parameters
- Consider splitting very large log files

### Browser Console Errors
- Check for CORS issues when running locally
- Ensure all JavaScript files are loading correctly
- Verify Plotly.js and PapaParse CDN links are accessible

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

**Made by AK Everlasting Dev · v1.0.1**

