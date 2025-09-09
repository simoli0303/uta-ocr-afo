import { chromium } from 'playwright';
import { readFileSync } from 'fs';

// Utility function to wait for element with retry logic
async function waitForElementSafely(page, locator, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const timeout = options.timeout || 10000;
    const retryDelay = options.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔍 Waiting for element (attempt ${attempt}/${maxRetries})...`);
            await locator.waitFor({ 
                state: 'visible', 
                timeout: timeout 
            });
            console.log('✅ Element found and visible');
            return true;
        } catch (error) {
            if (attempt === maxRetries) {
                console.error(`❌ Element not found after ${maxRetries} attempts:`, error.message);
                throw error;
            }
            console.log(`⏳ Attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
            await page.waitForTimeout(retryDelay);
        }
    }
}

// Utility function to perform action with retry logic
async function performActionSafely(action, maxRetries = 3, retryDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🎯 Performing action (attempt ${attempt}/${maxRetries})...`);
            await action();
            console.log('✅ Action completed successfully');
            return true;
        } catch (error) {
            if (attempt === maxRetries) {
                console.error(`❌ Action failed after ${maxRetries} attempts:`, error.message);
                throw error;
            }
            console.log(`⏳ Action attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

// Utility function to wait for page to be fully loaded
async function waitForPageReady(page, options = {}) {
    const timeout = options.timeout || 30000;

    try {
        // Wait for network to be idle
        await page.waitForLoadState('networkidle', { timeout });

        // Wait for DOM to be ready
        await page.waitForLoadState('domcontentloaded', { timeout });

        // Additional check for any loading indicators
        try {
            await page.waitForSelector('[data-loading="true"]', { 
                state: 'hidden', 
                timeout: 5000 
            });
        } catch (e) {
            // Loading indicator might not exist, that's ok
        }

        console.log('✅ Page is fully loaded and ready');
        return true;
    } catch (error) {
        console.error('⚠️ Page loading timeout, but continuing...', error.message);
        return false;
    }
}

async function readCSVData() {
    try {
        const csvData = readFileSync('videos.csv', 'utf-8');
        const lines = csvData.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].split(/\t|,/); // Split by tabs OR commas
        const results = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(/\t|,/); // Split by tabs OR commas
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            results.push(row);
        }
        return results;
    } catch (error) {
        console.error('Error reading CSV:', error);
        return [];
    }
}

async function processVideo(page, video) {
    try {
        console.log(`\n=== Processing video: ${video.FileName} ===`);

        // Wait for page to be ready before starting
        await waitForPageReady(page);

        // Search for the video with proper waiting
        await waitForElementSafely(page, page.getByRole('textbox', { name: 'Search by Name or Address' }));

        await performActionSafely(async () => {
            await page.getByRole('textbox', { name: 'Search by Name or Address' }).click();
            await page.getByRole('textbox', { name: 'Search by Name or Address' }).fill(video.FileName);
        });

        // Wait for search results to load
        console.log('🔍 Waiting for search results...');
        await page.waitForLoadState('networkidle');

        // Wait for search results to actually appear - wait for name-wrapper to be visible
        try {
            await page.waitForSelector('.name-wrapper', { 
                state: 'visible', 
                timeout: 10000 
            });
        } catch (e) {
            // If name-wrapper not found, add a small delay to ensure results have loaded
            await page.waitForTimeout(2000);
        }

        // Check if video is already rejected or completed AFTER searching
        const status = await checkVideoStatus(page, video);
        if (status === 'rejected' || status === 'completed') {
            return; // Skip this video and move to next
        }

        console.log(`✅ Video ${video.FileName} is not rejected or completed. Processing...`);

        // Click Actions button with proper waiting
        await waitForElementSafely(page, page.getByRole('button', { name: 'Actions' }));
        await performActionSafely(async () => {
            await page.getByRole('button', { name: 'Actions' }).click();
        });

        // Click Review with proper waiting
        await waitForElementSafely(page, page.getByRole('menuitem', { name: 'Review' }));
        await performActionSafely(async () => {
            await page.getByRole('menuitem', { name: 'Review' }).click();
        });

        // Wait for review page to load completely
        console.log('⏳ Waiting for review page to load...');
        await waitForPageReady(page);

        // Wait for review form elements to be present
        await page.waitForSelector('#bownumberInput, .field', { 
            state: 'visible', 
            timeout: 15000 
        });

        // Check if bow number exists and process accordingly
        if (video.BOWNumber && video.BOWNumber.trim() !== '') {
            console.log(`✅ Bow number found: ${video.BOWNumber} - Processing APPROVE flow`);
            await approveVideo(page, video);
        } else {
            console.log(`❌ No bow number - Processing REJECT flow`);
            await rejectVideo(page, video);
        }

        // Small delay between videos (reduced from 2000ms)
        await page.waitForTimeout(2000);

    } catch (error) {
        console.error(`❌ Error processing video ${video.FileName}:`, error);
    }
}

async function checkVideoStatus(page, video) {
    try {
        // Check for REJECTED status - use isVisible() for immediate check
        const rejectedLocator = page.locator("//span[normalize-space()='REJECTED']").first();
        if (await rejectedLocator.isVisible()) {
            console.log(`⏭️ Video ${video.FileName} is already REJECTED. Skipping to next video.`);
            return 'rejected';
        }

        // Check for COMPLETED status - use isVisible() for immediate check
        const completedLocator = page.locator("//span[normalize-space()='COMPLETED']").first();
        if (await completedLocator.isVisible()) {
            console.log(`⏭️ Video ${video.FileName} is already COMPLETED. Skipping to next video.`);
            return 'completed';
        }

        return 'processing';
    } catch (error) {
        console.log('⚠️ Could not determine video status, continuing with processing...');
        return 'processing';
    }
}

async function approveVideo(page, video) {
    try {
        // Check if bow number field already has a value
        const bowNumberField = page.getByRole('textbox', { name: 'Bow Number Detected Bow' });
        await bowNumberField.click();
        await bowNumberField.fill(video.BOWNumber);
        console.log(`✅ Bow number entered: ${video.BOWNumber}`);

        // Click Approve button
        await page.getByRole('button', { name: 'Approve' }).click();
        console.log('✅ Approve button clicked');

        // Wait for approval to process - use network idle instead of fixed timeout
        await page.waitForLoadState('networkidle', { timeout: 10000 });

        // Close dialog - use specific locator for approve flow
        await page.locator("//mat-icon[@id='reset_search_icon']").click();
        console.log('✅ Video approved successfully and dialog closed');

    } catch (error) {
        console.error('❌ Error in approve flow:', error);
    }
}
async function rejectVideo(page, video) {
    try {
        // Click Reject button
        await page.getByRole('button', { name: 'Reject' }).click();
        console.log('✅ Reject button clicked');

        // Click on reason dropdown
        await page.getByRole('combobox', { name: 'Select Reason Code' }).locator('span').click();

        // Select rejection reason based on comment
        let reasonCode = 'Bow number not visible'; // Default

        if (video.Comment) {
            switch (video.Comment.toLowerCase()) {
                case 'blur':
                    reasonCode = 'Bow number not visible';
                    break;
                case 'no boat':
                    reasonCode = 'NO BOAT';
                    break;
                case 'no number':
                    reasonCode = 'Bow number not printed';
                    break;
                case 'wrong direction':
                    reasonCode = 'INVALID DIRECTION';
                    break;
                default:
                    reasonCode = 'Bow number not visible';
            }
        }

        // Click the reason option
        await page.getByRole('option', { name: reasonCode }).click();
        console.log(`✅ Rejection reason selected: ${reasonCode}`);

        // Fill in reason text
        await page.getByRole('textbox', { name: 'Reason' }).click();
        await page.getByRole('textbox', { name: 'Reason' }).fill(video.Comment.toLowerCase());
        console.log(`✅ Rejection reason entered: ${video.Comment.toLowerCase()}`);

        // Click Save
        await page.getByRole('button', { name: 'Save' }).click();
        console.log('✅ Video rejected successfully');

        // Close dialog
        await page.getByText('close').click();
        console.log('✅ Dialog closed');

    } catch (error) {
        console.error('❌ Error in reject flow:', error);
    }
}

async function loginToPortal() {
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500 // Reduced from 1000ms for better performance
    });

    const page = await browser.newPage();

    try {
        console.log('🚀 Starting video automation...');

        // Navigate to portal with proper waiting
        await page.goto('https://utdnr.fieldops.tylerapp.com/#/auth');
        await waitForPageReady(page);

        // Wait for login form to be ready
        const emailField = page.getByRole('textbox', { name: 'Email' });
        await waitForElementSafely(page, emailField);

        // Fill in username with proper waiting
        await performActionSafely(async () => {
            await page.locator('.mat-mdc-form-field-infix').first().click();
            await emailField.click();
            await emailField.fill('produtdnradmin@fieldops.tylerapp.com');
        });

        // Fill in password with proper waiting
        const passwordField = page.getByRole('textbox', { name: 'Password' });
        await waitForElementSafely(page, passwordField);
        await performActionSafely(async () => {
            await passwordField.click();
            await passwordField.fill('bYhwKwXSm@91eM29');
        });

        // Check Remember Me with proper waiting
        const rememberCheckbox = page.getByRole('checkbox', { name: 'Remember Me' });
        await waitForElementSafely(page, rememberCheckbox);
        await performActionSafely(async () => {
            await rememberCheckbox.check();
        });

        // Click Login with proper waiting
        const loginButton = page.getByRole('button', { name: 'Log In' });
        await waitForElementSafely(page, loginButton);
        await performActionSafely(async () => {
            await loginButton.click();
        });

        console.log('✅ Login successful. Navigating to Team Inspections...');

        // Wait for dashboard to load completely
        await waitForPageReady(page, { timeout: 30000 });

        // Wait for and click Navigation Menu
        const navMenuButton = page.getByRole('button', { name: 'Navigation Menu' });
        await waitForElementSafely(page, navMenuButton);
        await performActionSafely(async () => {
            await navMenuButton.click();
        });

        // Wait for and click Team Inspections
        const teamInspectionsLink = page.getByText('Team Inspections');
        await waitForElementSafely(page, teamInspectionsLink);
        await performActionSafely(async () => {
            await teamInspectionsLink.click();
        });

        console.log('✅ Navigated to Team Inspections. Reading CSV data...');

        // Wait for Team Inspections page to load completely
        await waitForPageReady(page, { timeout: 30000 });

        // Wait for search functionality to be ready using the correct selector
        try {
            const searchField = page.getByRole('textbox', { name: 'Search by Name or Address' });
            await waitForElementSafely(page, searchField, { timeout: 15000 });
        } catch (e) {
            console.log('⚠️ Search field not immediately visible, continuing...');
        }

        const videos = await readCSVData();

        if (videos.length === 0) {
            console.log('❌ No videos found in CSV. Please check the file.');
            return;
        }

        console.log(`📊 Found ${videos.length} videos to process. Starting automation...`);

        // Process all videos
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            console.log(`\n📹 Processing video ${i + 1}/${videos.length}: ${video.FileName}`);

            await processVideo(page, video);

            // Brief pause between videos for system stability
            if (i < videos.length - 1) {
                await page.waitForTimeout(1000);
            }
        }

        console.log('\n🎉 All videos processed successfully!');

        // Keep browser open for 6 seconds then close automatically
        console.log('Browser will stay open for 6 seconds for review, then close automatically.');
        await page.waitForTimeout(6000);

        console.log('Closing browser automatically...');
        await browser.close();
        console.log('✅ Automation completed and browser closed.');

    } catch (error) {
        console.error('❌ Error during automation:', error);

        await browser.close();
    }
}

// Run the automation
loginToPortal().catch(console.error);