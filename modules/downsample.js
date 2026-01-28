// Data downsampling utilities for performance optimization
// Implements LTTB (Largest-Triangle-Three-Buckets) algorithm

/**
 * Downsample data using LTTB algorithm
 * @param {Array} xData - X-axis data array
 * @param {Array} yData - Y-axis data array
 * @param {number} threshold - Target number of points
 * @returns {Object} Downsampled data with x and y arrays
 */
export function downsampleLTTB(xData, yData, threshold){
  if (!Array.isArray(xData) || !Array.isArray(yData) || xData.length !== yData.length){
    return { x: xData, y: yData };
  }
  
  const dataLength = xData.length;
  if (dataLength <= threshold || threshold <= 2){
    return { x: xData, y: yData };
  }
  
  // Filter out NaN/Infinity values and create clean data points
  const cleanData = [];
  for (let i = 0; i < dataLength; i++){
    const x = xData[i];
    const y = yData[i];
    if (Number.isFinite(x) && Number.isFinite(y)){
      cleanData.push({ x, y, index: i });
    }
  }
  
  if (cleanData.length <= threshold){
    return {
      x: cleanData.map(d => d.x),
      y: cleanData.map(d => d.y)
    };
  }
  
  const sampled = [];
  const bucketSize = (cleanData.length - 2) / (threshold - 2);
  let a = 0;
  let nextA = 0;
  
  sampled.push(cleanData[0]); // Always include first point
  
  for (let i = 0; i < threshold - 2; i++){
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, cleanData.length);
    
    const avgRangeStart = Math.floor((i + 0) * bucketSize) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, cleanData.length);
    
    let avgX = 0;
    let avgY = 0;
    let avgRangeLength = 0;
    
    for (let j = avgRangeStart; j < avgRangeEnd; j++){
      avgX += cleanData[j].x;
      avgY += cleanData[j].y;
      avgRangeLength++;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;
    
    let maxArea = -1;
    let maxAreaIndex = rangeStart;
    
    for (let j = rangeStart; j < rangeEnd; j++){
      const area = Math.abs(
        (cleanData[a].x - avgX) * (cleanData[j].y - cleanData[a].y) -
        (cleanData[a].x - cleanData[j].x) * (avgY - cleanData[a].y)
      );
      if (area > maxArea){
        maxArea = area;
        maxAreaIndex = j;
      }
    }
    
    sampled.push(cleanData[maxAreaIndex]);
    a = maxAreaIndex;
  }
  
  sampled.push(cleanData[cleanData.length - 1]); // Always include last point
  
  return {
    x: sampled.map(d => d.x),
    y: sampled.map(d => d.y)
  };
}

/**
 * Determine optimal sample size based on viewport and data size
 * @param {number} dataLength - Original data length
 * @param {number} viewportWidth - Viewport width in pixels
 * @param {number} maxPoints - Maximum points to render (default: 2000)
 * @returns {number} Optimal sample size
 */
export function calculateOptimalSampleSize(dataLength, viewportWidth = 1920, maxPoints = 2000){
  // Aim for ~2 pixels per point for smooth rendering
  const targetPoints = Math.min(viewportWidth / 2, maxPoints);
  return Math.min(targetPoints, dataLength);
}

/**
 * Check if data should be downsampled
 * @param {number} dataLength - Data array length
 * @param {number} threshold - Threshold for downsampling (default: 5000)
 * @returns {boolean}
 */
export function shouldDownsample(dataLength, threshold = 5000){
  return dataLength > threshold;
}
