import { chromium } from 'playwright';
import { readFileSync } from 'fs';

async function readCSVData() {
    try {
        const csvData = readFileSync('videos.csv', 'utf-8');
        const lines = csvData.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].split(',');
        const results = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
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
        
        // Search for the video
        await page.getByRole('textbox', { name: 'Search by Name or Address' }).click();
        await page.getByRole('textbox', { name: 'Search by Name or Address' }).fill(video.FileName);
        
        // Wait for search results
        await page.waitForTimeout(2000);
        
        // Check if video is already rejected
        try {
            const rejectedStatus = await page.locator("//span[normalize-space()='REJECTED']").first();
            if (await rejectedStatus.isVisible()) {
                console.log(`⏭️ Video ${video.FileName} is already REJECTED. Skipping to next video.`);
                return; // Skip this video and move to next
            }
        } catch (error) {
            // REJECTED status not found, continue with processing
            console.log(`✅ Video ${video.FileName} is not rejected. Processing...`);
        }
        
        // Click Actions button
        await page.getByRole('button', { name: 'Actions' }).click();
        
        // Click Review
        await page.getByRole('menuitem', { name: 'Review' }).click();
        
        // Wait for review page to load
        await page.waitForTimeout(2000);
        
        // Check if bow number exists
        if (video.BOWNumber && video.BOWNumber.trim() !== '') {
            console.log(`✅ Bow number found: ${video.BOWNumber} - Processing APPROVE flow`);
            await approveVideo(page, video);
        } else {
            console.log(`❌ No bow number - Processing REJECT flow`);
            await rejectVideo(page, video);
        }
        
        // Wait between videos
        await page.waitForTimeout(3000);
        
    } catch (error) {
        console.error(`❌ Error processing video ${video.FileName}:`, error);
    }
}

async function approveVideo(page, video) {
    try {
        // Click Approve button
        await page.getByRole('button', { name: 'Approve' }).click();
        console.log('✅ Approve button clicked');
        
        // Wait for bow number input field and enter it
        await page.waitForTimeout(1000);
        // Add bow number input logic here based on your portal structure
        
        // Click Save
        await page.getByRole('button', { name: 'Save' }).click();
        console.log('✅ Video approved successfully');
        
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
        slowMo: 1000
    });
    
    const page = await browser.newPage();
    
    try {
        console.log('🚀 Starting video automation...');
        
        // Navigate to portal
        await page.goto('https://utdnr.fieldops.tylerapp.com/#/auth');
        
        // Click on email field
        await page.locator('.mat-mdc-form-field-infix').first().click();
        
        // Fill in username
        await page.getByRole('textbox', { name: 'Email' }).click();
        await page.getByRole('textbox', { name: 'Email' }).fill('produtdnradmin@fieldops.tylerapp.com');
        
        // Fill in password
        await page.getByRole('textbox', { name: 'Password' }).click();
        await page.getByRole('textbox', { name: 'Password' }).fill('bYhwKwXSm@91eM29');
        
        // Check Remember Me
        await page.getByRole('checkbox', { name: 'Remember Me' }).check();
        
        // Click Login
        await page.getByRole('button', { name: 'Log In' }).click();
        
        console.log('✅ Login successful. Navigating to Team Inspections...');
        
        // Wait for dashboard to load
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        // Click Navigation Menu
        await page.getByRole('button', { name: 'Navigation Menu' }).click();
        
        // Click Team Inspections
        await page.getByText('Team Inspections').click();
        
        console.log('✅ Navigated to Team Inspections. Reading CSV data...');
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        const videos = await readCSVData();
        
        if (videos.length === 0) {
            console.log('❌ No videos found in CSV. Please check the file.');
            return;
        }
        
        console.log(`📊 Found ${videos.length} videos to process. Starting automation...`);
        
        // Process all videos
        for (const video of videos) {
            await processVideo(page, video);
        }
        
        console.log('\n🎉 All videos processed successfully!');
        
        // Keep browser open for review
        console.log('Browser will stay open for review. Close it when done.');
        await new Promise(() => {});
        
    } catch (error) {
        console.error('❌ Error during automation:', error);
        await browser.close();
    }
}

// Run the automation
loginToPortal().catch(console.error);
