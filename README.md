# Video Portal Automation with Playwright

This program automates video portal interactions by reading video names from CSV/XLSX files and using Playwright to perform automated actions.

## Features

- ✅ Read video names from CSV or XLSX files
- ✅ Automated browser navigation using Playwright
- ✅ Configurable selectors for different portals
- ✅ Customizable timing and actions
- ✅ Support for multiple button clicks and interactions
- ✅ Error handling and logging

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Test CSV Reading
```bash
node test.js
```

### 3. Customize Configuration
Edit `config.js` to match your portal's structure.

### 4. Run Automation
```bash
node index.js
```

## Configuration

### Portal URL
Edit `config.js` and change the `portalUrl`:
```javascript
portalUrl: 'https://your-actual-portal.com'
```

### Selectors
Customize the CSS selectors in `config.js` to match your portal:

```javascript
selectors: {
    // Search input field
    searchInput: 'input[name="search"], .search-box, #search',
    
    // Search button
    searchButton: 'button[type="submit"], .search-btn',
    
    // Search results
    searchResults: '.video-item, .result-card, .search-result',
    
    // Play button
    playButton: '.play-btn, button[aria-label*="play"]',
    
    // Other buttons to click
    otherButtons: [
        '.like-button',
        '.favorite-btn',
        '.share-btn'
    ]
}
```

### Timing
Adjust timing settings as needed:
```javascript
timing: {
    waitAfterSearch: 2000,      // Wait after search
    waitAfterClick: 2000,       // Wait after clicking result
    waitAfterPlay: 3000,        // Wait after clicking play
    waitBetweenVideos: 2000,    // Wait between videos
    pageLoadTimeout: 10000,     // Element timeout
    actionTimeout: 5000          // Action timeout
}
```

## CSV Format

Your CSV should have a column with video names. The script looks for these column names in order:
- `video_name`
- `title` 
- `name`
- `video_title`

Example CSV:
```csv
video_name,title,description
Video 1,First Video,Description here
Video 2,Second Video,Another description
```

## How to Use

### 1. Prepare Your CSV
Create a CSV file with your video names (see example above).

### 2. Customize Selectors
Open the portal in your browser and use Developer Tools (F12) to find the correct CSS selectors for:
- Search input field
- Search button
- Video result items
- Play button
- Any other buttons you want to click

### 3. Update Configuration
Edit `config.js` with your portal URL and selectors.

### 4. Run the Automation
```bash
node index.js
```

## Example Portal Configurations

### YouTube-like Portal
```javascript
youtube: {
    searchInput: 'input[name="search_query"]',
    searchButton: 'button[aria-label="Search"]',
    searchResults: 'ytd-video-renderer',
    playButton: 'button[aria-label*="Play"]',
    likeButton: 'button[aria-label*="like"]'
}
```

### Vimeo-like Portal
```javascript
vimeo: {
    searchInput: 'input[type="search"]',
    searchButton: 'button[type="submit"]',
    searchResults: '.video-item',
    playButton: '.play-button',
    likeButton: '.like-button'
}
```

## Troubleshooting

### Common Issues

1. **Selectors not found**: Use browser DevTools to verify CSS selectors
2. **Timing issues**: Increase wait times in the config
3. **Portal changes**: Update selectors if the portal structure changes

### Debug Mode
Set `headless: false` in config to see the browser in action.

### Manual Testing
Use `test.js` to verify CSV reading works before running full automation.

## File Structure

```
NP AUTO/
├── index.js          # Main automation script
├── config.js         # Configuration file
├── test.js           # Test script
├── videos.csv        # Sample CSV file
├── package.json      # Dependencies
└── README.md         # This file
```

## Customization Examples

### Add Custom Actions
```javascript
// In performActions method, add your custom logic:
await this.page.click('.custom-button');
await this.page.fill('.comment-box', 'Great video!');
```

### Handle Different Portal Types
```javascript
// Create different configs for different portals
const youtubeConfig = { ...config, ...portalSpecificConfig.youtube };
const automation = new VideoPortalAutomation(youtubeConfig);
```

## Support

If you need help customizing the automation for your specific portal:
1. Share the portal URL
2. Show me the HTML structure (use DevTools)
3. Describe what actions you want to automate

The agent can help you customize the selectors and actions for your specific use case!
