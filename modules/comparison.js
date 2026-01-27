// Advanced comparison mode with side-by-side views and diff visualization

/**
 * Calculate differences between two data series
 * @param {Array} seriesA - First series data
 * @param {Array} seriesB - Second series data
 * @param {Array} timeA - Time array for series A
 * @param {Array} timeB - Time array for series B
 * @returns {Object} Difference data with aligned time series
 */
export function calculateDiff(seriesA, seriesB, timeA, timeB){
  if (!seriesA || !seriesB || !timeA || !timeB) return null;
  
  // Align time series (interpolate to common time points)
  const minTime = Math.max(timeA[0], timeB[0]);
  const maxTime = Math.min(timeA[timeA.length - 1], timeB[timeB.length - 1]);
  
  if (minTime >= maxTime) return null;
  
  // Create common time array (use finer resolution)
  const commonTime = [];
  const step = Math.min(
    (timeA[timeA.length - 1] - timeA[0]) / timeA.length,
    (timeB[timeB.length - 1] - timeB[0]) / timeB.length
  ) * 0.5; // Use half step for better resolution
  
  for (let t = minTime; t <= maxTime; t += step){
    commonTime.push(t);
  }
  
  // Interpolate both series to common time points
  const alignedA = interpolateToTime(seriesA, timeA, commonTime);
  const alignedB = interpolateToTime(seriesB, timeB, commonTime);
  
  // Calculate differences
  const diff = alignedA.map((valA, i) => {
    const valB = alignedB[i];
    if (!Number.isFinite(valA) || !Number.isFinite(valB)){
      return null;
    }
    return valA - valB;
  });
  
  const percentDiff = alignedA.map((valA, i) => {
    const valB = alignedB[i];
    if (!Number.isFinite(valA) || !Number.isFinite(valB) || valB === 0){
      return null;
    }
    return ((valA - valB) / valB) * 100;
  });
  
  return {
    time: commonTime,
    seriesA: alignedA,
    seriesB: alignedB,
    diff,
    percentDiff,
    maxDiff: Math.max(...diff.filter(Number.isFinite)),
    minDiff: Math.min(...diff.filter(Number.isFinite)),
    avgDiff: diff.filter(Number.isFinite).reduce((a, b) => a + b, 0) / diff.filter(Number.isFinite).length
  };
}

/**
 * Interpolate series to target time points
 * @param {Array} series - Data series
 * @param {Array} time - Original time array
 * @param {Array} targetTime - Target time points
 * @returns {Array} Interpolated values
 */
function interpolateToTime(series, time, targetTime){
  return targetTime.map(t => {
    // Find surrounding points
    let idx = 0;
    for (let i = 0; i < time.length - 1; i++){
      if (time[i] <= t && time[i + 1] >= t){
        idx = i;
        break;
      }
      if (time[i] > t){
        idx = i;
        break;
      }
    }
    
    if (idx >= time.length - 1){
      return series[series.length - 1];
    }
    
    // Linear interpolation
    const t0 = time[idx];
    const t1 = time[idx + 1];
    const v0 = series[idx];
    const v1 = series[idx + 1];
    
    if (!Number.isFinite(v0) || !Number.isFinite(v1)){
      return Number.isFinite(v0) ? v0 : (Number.isFinite(v1) ? v1 : null);
    }
    
    if (t1 === t0) return v0;
    
    const ratio = (t - t0) / (t1 - t0);
    return v0 + (v1 - v0) * ratio;
  });
}

/**
 * Create side-by-side comparison view
 * @param {Object} logA - First log data
 * @param {Object} logB - Second log data
 * @param {string} parameter - Parameter name to compare
 * @returns {Object} Comparison data for rendering
 */
export function createSideBySideComparison(logA, logB, parameter){
  if (!logA || !logB || !parameter) return null;
  
  const idxA = logA.headers.indexOf(parameter);
  const idxB = logB.headers.indexOf(parameter);
  
  if (idxA === -1 || idxB === -1) return null;
  
  const timeA = logA.cols[logA.timeIdx] || [];
  const timeB = logB.cols[logB.timeIdx] || [];
  const seriesA = logA.cols[idxA] || [];
  const seriesB = logB.cols[idxB] || [];
  
  return {
    parameter,
    logA: {
      name: logA.name || 'Log A',
      time: timeA,
      series: seriesA,
      color: '#2aa6ff'
    },
    logB: {
      name: logB.name || 'Log B',
      time: timeB,
      series: seriesB,
      color: '#ffaa2a'
    },
    diff: calculateDiff(seriesA, seriesB, timeA, timeB)
  };
}

/**
 * Find all common parameters between two logs
 * @param {Object} logA - First log
 * @param {Object} logB - Second log
 * @returns {Array} Array of common parameter names
 */
export function findCommonParameters(logA, logB){
  if (!logA || !logB || !logA.headers || !logB.headers) return [];
  
  const setB = new Set(logB.headers);
  return logA.headers.filter(header => setB.has(header));
}

/**
 * Generate comparison statistics
 * @param {Object} diffData - Difference data from calculateDiff
 * @returns {Object} Statistics object
 */
export function generateComparisonStats(diffData){
  if (!diffData || !diffData.diff) return null;
  
  const validDiffs = diffData.diff.filter(Number.isFinite);
  const validPercentDiffs = diffData.percentDiff.filter(Number.isFinite);
  
  if (validDiffs.length === 0) return null;
  
  validDiffs.sort((a, b) => a - b);
  validPercentDiffs.sort((a, b) => a - b);
  
  return {
    count: validDiffs.length,
    maxDiff: Math.max(...validDiffs),
    minDiff: Math.min(...validDiffs),
    avgDiff: validDiffs.reduce((a, b) => a + b, 0) / validDiffs.length,
    maxPercentDiff: Math.max(...validPercentDiffs),
    minPercentDiff: Math.min(...validPercentDiffs),
    avgPercentDiff: validPercentDiffs.reduce((a, b) => a + b, 0) / validPercentDiffs.length,
    medianDiff: validDiffs[Math.floor(validDiffs.length / 2)],
    stdDev: calculateStdDev(validDiffs)
  };
}

function calculateStdDev(values){
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}
