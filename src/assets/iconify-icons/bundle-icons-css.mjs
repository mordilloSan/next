import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import necessary functions from Iconify Tools and Utils
import { cleanupSVG, importDirectory, isEmptyColor, parseColors, runSVGO } from '@iconify/tools';
import { getIcons, getIconsCSS, stringToIcon } from '@iconify/utils';

// Convert import.meta.url to __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define sources for your icons
const sources = {
  json: [
    // Dynamic import of Iconify JSON file
    (async () => (await import('@iconify/json/json/ri.json')).default)()
  ],
  svg: [
    // Uncomment and add SVG directory sources as needed
    // {
    //   dir: 'src/assets/iconify-icons/svg',
    //   monotone: false,
    //   prefix: 'custom'
    // }
  ]
};

// File to save the generated CSS bundle to
const target = join(__dirname, 'generated-icons.css');

(async function () {
  // Create directory for output if missing
  const dir = dirname(target);

  try {
    await fs.mkdir(dir, {
      recursive: true
    });
  } catch (err) {
    console.error('Error creating directory:', err);
  }

  const allIcons = [];

  // Bundle JSON files and collect icons
  if (sources.json) {
    for (let i = 0; i < sources.json.length; i++) {
      const jsonPromise = sources.json[i];
      const content = await jsonPromise; // Resolve the promise to get JSON content

      // Collect all icons from the JSON file
      allIcons.push(content);
    }
  }

  // Bundle custom SVG icons and collect icons
  if (sources.svg) {
    for (let i = 0; i < sources.svg.length; i++) {
      const source = sources.svg[i];

      // Import icons from directory
      const iconSet = await importDirectory(source.dir, {
        prefix: source.prefix
      });

      // Validate, clean up, and optimize icons
      await iconSet.forEach(async (name, type) => {
        if (type !== 'icon') return;

        const svg = iconSet.toSVG(name);
        if (!svg) {
          iconSet.remove(name);
          return;
        }

        try {
          await cleanupSVG(svg);
          if (source.monotone) {
            await parseColors(svg, {
              defaultColor: 'currentColor',
              callback: (attr, colorStr, color) => {
                return !color || isEmptyColor(color) ? colorStr : 'currentColor';
              }
            });
          }
          await runSVGO(svg);
        } catch (err) {
          console.error(`Error parsing ${name} from ${source.dir}:`, err);
          iconSet.remove(name);
          return;
        }

        iconSet.fromSVG(name, svg);
      });

      allIcons.push(iconSet.export());
    }
  }

  // Generate CSS from collected icons
  const cssContent = allIcons
    .map(iconSet => getIconsCSS(iconSet, Object.keys(iconSet.icons), { iconSelector: '.{prefix}-{name}' }))
    .join('\n');

  // Save the CSS to a file
  await fs.writeFile(target, cssContent, 'utf8');
  console.log(`Saved CSS to ${target}!`);
})().catch(err => {
  console.error(err);
});

/**
 * Function to sort icon names by prefix
 */
function organizeIconsList(icons) {
  const sorted = Object.create(null);

  icons.forEach(icon => {
    const item = stringToIcon(icon);
    if (!item) return;

    const prefix = item.prefix;
    const prefixList = sorted[prefix] ? sorted[prefix] : (sorted[prefix] = []);
    const name = item.name;

    if (!prefixList.includes(name)) prefixList.push(name);
  });

  return sorted;
}
