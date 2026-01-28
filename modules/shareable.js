// Shareable links feature for cloud-uploaded logs with view configuration

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

// Supabase configuration (should match app.js)
const SUPABASE_URL = 'https://qliilnxaqerekgqoqqxr.supabase.co';
const SUPABASE_KEY = 'sb_publishable__OIhCNmF5NJuUHfNl63uwg_ocsuHmNh';

let supabase = null;

/**
 * Initialize Supabase client
 */
function initSupabase(){
  if (!supabase){
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

/**
 * Generate shareable link for uploaded log
 * @param {string} fileId - Uploaded file ID or name
 * @param {Object} viewConfig - View configuration (selected parameters, time range, etc.)
 * @returns {Promise<string>} Shareable URL
 */
export async function generateShareableLink(fileId, viewConfig = {}){
  initSupabase();
  
  // Store view configuration in database (create table if needed)
  // For now, use a simple approach: encode config in URL hash
  // In production, you'd want to store this in a database table
  const configStr = btoa(JSON.stringify({ fileId, ...viewConfig }));
  const baseUrl = window.location.origin;
  const shareableUrl = `${baseUrl}/share.html#${configStr}`;
  
  return shareableUrl;
}

/**
 * Load shared view configuration
 * @param {string} shareId - Share ID from URL
 * @returns {Promise<Object>} View configuration and file info
 */
export async function loadSharedView(shareId){
  initSupabase();
  
  const { data, error } = await supabase
    .from('log_views')
    .select('*, log_uploads(*)')
    .eq('id', shareId)
    .single();
  
  if (error){
    console.error('Failed to load shared view:', error);
    throw error;
  }
  
  return {
    viewConfig: data.view_config,
    fileInfo: data.log_uploads
  };
}

/**
 * Get public URL for uploaded file
 * @param {string} fileName - File name in storage
 * @returns {Promise<string>} Public URL
 */
export async function getPublicFileUrl(fileName){
  initSupabase();
  
  const { data } = await supabase
    .storage
    .from('log-uploads')
    .getPublicUrl(fileName);
  
  return data.publicUrl;
}

/**
 * Create shareable link from current view
 * @param {Object} logData - Current log data
 * @param {Array<string>} selectedParameters - Selected parameter names
 * @param {Object} timeRange - Time range {start, end}
 * @returns {Promise<string>} Shareable URL
 */
export async function createShareableLinkFromCurrentView(logData, selectedParameters = [], timeRange = null){
  if (!logData || !logData.uploadedFileId){
    throw new Error('Log must be uploaded to cloud first');
  }
  
  const viewConfig = {
    parameters: selectedParameters,
    timeRange,
    version: '1.5',
    createdAt: Date.now()
  };
  
  return generateShareableLink(logData.uploadedFileId, viewConfig);
}

/**
 * Copy shareable link to clipboard
 * @param {string} url - URL to copy
 */
export async function copyShareableLink(url){
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e) {
      document.body.removeChild(textarea);
      return false;
    }
  }
}
