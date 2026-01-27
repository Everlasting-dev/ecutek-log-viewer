// Templates & presets system for saving/loading plot configurations

/**
 * Template data structure
 * @typedef {Object} Template
 * @property {string} id - Unique template ID
 * @property {string} name - Template name
 * @property {Array<string>} parameters - List of parameter names to plot
 * @property {Object} config - Plot configuration (colors, axis settings, etc.)
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

let templates = [];
let templateIdCounter = 0;

/**
 * Initialize templates system
 */
export async function initTemplates(){
  await loadTemplates();
}

/**
 * Create a template from current plot configuration
 * @param {string} name - Template name
 * @param {Array<string>} parameters - Parameter names to include
 * @param {Object} config - Additional configuration
 * @returns {Template} Created template
 */
export async function createTemplate(name, parameters, config = {}){
  const template = {
    id: `template_${templateIdCounter++}`,
    name,
    parameters: [...parameters],
    config: {
      ...config,
      createdAt: Date.now()
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  templates.push(template);
  await saveTemplates();
  
  return template;
}

/**
 * Get template by ID
 * @param {string} id - Template ID
 * @returns {Template|null}
 */
export function getTemplate(id){
  return templates.find(t => t.id === id) || null;
}

/**
 * Get all templates
 * @returns {Array<Template>}
 */
export function getAllTemplates(){
  return [...templates];
}

/**
 * Update template
 * @param {string} id - Template ID
 * @param {Object} updates - Updates to apply
 */
export async function updateTemplate(id, updates){
  const template = templates.find(t => t.id === id);
  if (!template) return null;
  
  Object.assign(template, updates, { updatedAt: Date.now() });
  await saveTemplates();
  
  return template;
}

/**
 * Delete template
 * @param {string} id - Template ID
 */
export async function deleteTemplate(id){
  templates = templates.filter(t => t.id !== id);
  await saveTemplates();
}

/**
 * Apply template to current view
 * @param {string} id - Template ID
 * @param {Object} logData - Current log data
 * @returns {Object} Configuration to apply
 */
export function applyTemplate(id, logData){
  const template = getTemplate(id);
  if (!template) return null;
  
  // Filter parameters to only those available in current log
  const availableParams = template.parameters.filter(param => 
    logData.headers && logData.headers.includes(param)
  );
  
  return {
    parameters: availableParams,
    config: template.config
  };
}

/**
 * Export templates as JSON
 * @returns {string} JSON string
 */
export function exportTemplates(){
  return JSON.stringify(templates, null, 2);
}

/**
 * Import templates from JSON
 * @param {string} json - JSON string
 */
export async function importTemplates(json){
  try {
    const imported = JSON.parse(json);
    if (Array.isArray(imported)){
      templates = imported;
      templateIdCounter = Math.max(...templates.map(t => {
        const match = t.id?.match(/template_(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }), 0) + 1;
      await saveTemplates();
    }
  } catch (error) {
    console.error('Failed to import templates:', error);
    throw error;
  }
}

/**
 * Create preset templates for common analysis scenarios
 */
export async function createPresets(){
  const presets = [
    {
      name: 'Boost & AFR Analysis',
      parameters: ['Boost', 'AFR', 'Throttle Position', 'RPM'],
      config: {
        description: 'Standard boost and air-fuel ratio analysis',
        colors: ['#2aa6ff', '#ffaa2a', '#7bdc7b', '#ff5aa2']
      }
    },
    {
      name: 'Ignition Timing',
      parameters: ['Ignition Timing', 'RPM', 'Load', 'Knock'],
      config: {
        description: 'Ignition timing analysis with knock detection',
        colors: ['#ffaa2a', '#2aa6ff', '#7bdc7b', '#ff3b30']
      }
    },
    {
      name: 'Fuel System',
      parameters: ['Fuel Pressure', 'Injector Duty Cycle', 'AFR', 'RPM'],
      config: {
        description: 'Fuel system performance analysis',
        colors: ['#00ff66', '#ff5aa2', '#ffaa2a', '#2aa6ff']
      }
    },
    {
      name: 'Temperature Monitoring',
      parameters: ['Coolant Temp', 'Oil Temp', 'Intake Temp', 'RPM'],
      config: {
        description: 'Engine temperature monitoring',
        colors: ['#ff3b30', '#ffaa2a', '#ff5aa2', '#2aa6ff']
      }
    }
  ];
  
  // Only create if they don't exist
  const existingNames = new Set(templates.map(t => t.name));
  for (const preset of presets){
    if (!existingNames.has(preset.name)){
      await createTemplate(preset.name, preset.parameters, preset.config);
    }
  }
}

/**
 * Save templates to IndexedDB
 */
async function saveTemplates(){
  try {
    const { setSetting } = await import('./storage.js');
    await setSetting('templates', templates);
  } catch (error) {
    console.warn('Failed to save templates:', error);
    localStorage.setItem('templates', JSON.stringify(templates));
  }
}

/**
 * Load templates from IndexedDB
 */
async function loadTemplates(){
  try {
    const { getSetting } = await import('./storage.js');
    const saved = await getSetting('templates', []);
    if (Array.isArray(saved) && saved.length > 0){
      templates = saved;
      // Extract max ID
      const ids = templates.map(t => {
        const match = t.id?.match(/template_(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      templateIdCounter = Math.max(...ids, 0) + 1;
    }
  } catch (error) {
    console.warn('Failed to load templates:', error);
    const saved = localStorage.getItem('templates');
    if (saved){
      try {
        templates = JSON.parse(saved);
        const ids = templates.map(t => {
          const match = t.id?.match(/template_(\d+)/);
          return match ? parseInt(match[1]) : 0;
        });
        templateIdCounter = Math.max(...ids, 0) + 1;
      } catch (e) {
        console.warn('Failed to parse templates from localStorage:', e);
      }
    }
  }
}
