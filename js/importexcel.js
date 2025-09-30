// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB76JC1Rvi44Ke0F9vS5tiiZ4p8IeAh9mw",
    authDomain: "elavil-43c53.firebaseapp.com",
    databaseURL: "https://elavil-43c53-default-rtdb.firebaseio.com",
    projectId: "elavil-43c53",
    storageBucket: "elavil-43c53.firebasestorage.app",
    messagingSenderId: "899611486560",
    appId: "1:899611486560:web:3bd8de3b3720c9f4009605",
    measurementId: "G-ESX4H859XL"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const inventoryRef = database.ref('InventoryData');

// DOM Elements
const fileInput = document.getElementById('excel-file');
const fileNameDisplay = document.getElementById('file-name');
const processButton = document.getElementById('process-excel');
const importButton = document.getElementById('import-data');
const dataTableBody = document.getElementById('data-table-body');
const previewEmptyState = document.getElementById('preview-empty-state');
const previewTableContainer = document.getElementById('preview-table-container');
const rowCountDisplay = document.getElementById('row-count');
const resultsContainer = document.getElementById('results-container');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const sidebarItems = document.querySelectorAll('.sidebar-menu li');

// ID Generation Settings
const replaceSpacesCheckbox = document.getElementById('replace-spaces');
const lowercaseCheckbox = document.getElementById('lowercase');
const includePrefixCheckbox = document.getElementById('include-prefix');
const prefixText = document.getElementById('prefix-text');

// Processed Excel data
let excelData = [];

// QR Code Generation
let qrCodes = [];
let currentPage = 0;
const itemsPerPage = 18;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Set default prefix to today's date
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const datePrefix = `${day}${month}${year}`;
    prefixText.value = datePrefix;

    // Add event listeners
    fileInput.addEventListener('change', handleFileSelect);
    processButton.addEventListener('click', processExcelFile);
    importButton.addEventListener('click', importToDatabase);
    
    // Add event listeners to sidebar menu items
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            // Get the menu item text and href
            const menuText = this.querySelector('span').textContent;
            const href = this.querySelector('a').getAttribute('href');
            
            // If it's not the current page and has a valid href, navigate to it
            if (menuText !== 'Excel Import' && href && href !== '#') {
                if (menuText === 'Inventory') {
                    window.location.href = 'supervisor.html';
                } else {
                    window.location.href = href;
                }
            } else if (href === '#') {
                // For placeholder links, show alert
                alert(`${menuText} functionality will be implemented in the future.`);
            }
        });
    });

    // Add event listeners for QR code generation
    document.getElementById('generate-qr-codes').addEventListener('click', generateQRCodes);
    document.getElementById('download-pdf').addEventListener('click', generatePDF);
});

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    
    if (file) {
        // Update file name display
        fileNameDisplay.textContent = file.name;
        
        // Enable process button
        processButton.disabled = false;
        
        // Clear previous data
        excelData = [];
        dataTableBody.innerHTML = '';
        previewTableContainer.style.display = 'none';
        previewEmptyState.style.display = 'block';
        importButton.disabled = true;
    } else {
        fileNameDisplay.textContent = 'No file selected';
        processButton.disabled = true;
    }
}

// Process the Excel file
function processExcelFile() {
    const file = fileInput.files[0];
    
    if (!file) {
        addResultItem('No file selected', 'error');
        return;
    }
    
    // Show loading message
    addResultItem('Reading Excel file...', 'warning');
    
    // Use FileReader to read the file
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            // Parse the Excel file
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the first sheet
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            // Process the data and generate IDs
            processData(jsonData);
            
        } catch (error) {
            addResultItem(`Error reading Excel file: ${error.message}`, 'error');
        }
    };
    
    reader.onerror = function() {
        addResultItem('Error reading file', 'error');
    };
    
    // Read the file as an array buffer
    reader.readAsArrayBuffer(file);
}

// Process the data and generate IDs
function processData(jsonData) {
    if (!jsonData || jsonData.length === 0) {
        addResultItem('No data found in Excel file', 'error');
        return;
    }
    
    // Check if required columns exist
    const firstRow = jsonData[0];
    const requiredColumns = ['manufacturer', 'type', 'quantity'];
    const missingColumns = [];
    
    // Make column check case-insensitive
    const rowKeys = Object.keys(firstRow).map(key => key.toLowerCase());
    
    for (const col of requiredColumns) {
        if (!rowKeys.some(key => key.includes(col.toLowerCase()))) {
            missingColumns.push(col);
        }
    }
    
    if (missingColumns.length > 0) {
        addResultItem(`Missing required columns: ${missingColumns.join(', ')}`, 'error');
        return;
    }
    
    // Map column names (handle different possible names)
    const columnMap = {};
    for (const key of Object.keys(firstRow)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('type')) columnMap.type = key;
        if (lowerKey.includes('manufacturer') || lowerKey.includes('maker')) columnMap.manufacturer = key;
        if (lowerKey.includes('quantity') || lowerKey.includes('qty')) columnMap.quantity = key;
    }
    
    // Create a map to track combined items
    const combinedItems = {};
    const combinedItemsDetails = [];
    
    // First pass: Extract and combine items with the same base ID
    jsonData.forEach((row, index) => {
        // Extract data using column mapping
        const type = row[columnMap.type] || '';
        const manufacturer = row[columnMap.manufacturer] || '';
        const quantity = parseInt(row[columnMap.quantity] || 0);
        
        // Generate a base ID by combining manufacturer and type
        const baseId = generateBaseId(manufacturer, type);
        
        // If we already have this item, add to its quantity
        if (combinedItems[baseId]) {
            // Add quantity to existing item
            combinedItems[baseId].quantity += quantity;
            
            // Track merged items for reporting
            combinedItemsDetails.push({
                baseId,
                type,
                manufacturer,
                quantity,
                rowIndex: index + 2, // +2 for Excel row number (1-indexed + header)
                merged: true
            });
        } else {
            // Create new item
            combinedItems[baseId] = {
                id: baseId,
                type: String(type),
                manufacturer: String(manufacturer),
                quantity: quantity
            };
            
            // Track original items for reporting
            combinedItemsDetails.push({
                baseId,
                type,
                manufacturer,
                quantity,
                rowIndex: index + 2, // +2 for Excel row number (1-indexed + header)
                merged: false
            });
        }
    });
    
    // Convert the combined items map to an array for display
    excelData = Object.values(combinedItems);
    
    // Display the processed data
    displayData(excelData, combinedItemsDetails);
    
    // Show quantity combination information if any, but only in results log
    const mergedItems = combinedItemsDetails.filter(item => item.merged);
    if (mergedItems.length > 0) {
        addResultItem(`Info: ${mergedItems.length} duplicate entries had their quantities combined with existing items.`, 'warning');
        
        // No need to show detailed logs about each combined item
    }
    
    // Show success message
    addResultItem(`Successfully processed ${jsonData.length} rows into ${excelData.length} unique items`, 'success');
}

// Generate a base ID by combining manufacturer and type (without ensuring uniqueness)
function generateBaseId(manufacturer, type) {
    if (!manufacturer && !type) {
        return 'unknown-item';
    }
    
    let combinedString = `${manufacturer}-${type}`;
    
    // Apply formatting options
    if (lowercaseCheckbox.checked) {
        combinedString = combinedString.toLowerCase();
    }
    
    if (replaceSpacesCheckbox.checked) {
        combinedString = combinedString.replace(/\s+/g, '-');
    }
    
    // Remove special characters
    combinedString = combinedString.replace(/[^\w-]/g, '');
    
    // Add prefix if enabled
    if (includePrefixCheckbox.checked && prefixText.value) {
        combinedString = `${prefixText.value}${combinedString}`;
    }
    
    return combinedString;
}

// The original generateUniqueId function is now replaced by generateBaseId
// This function will remain for compatibility, but will call generateBaseId internally
function generateUniqueId(manufacturer, type) {
    return generateBaseId(manufacturer, type);
}

// Display the processed data in the table
function displayData(data, detailsArray) {
    // Clear the table
    dataTableBody.innerHTML = '';
    
    // Generate table rows
    data.forEach(item => {
        const row = document.createElement('tr');
        
        // We no longer show any visual indication of combined items
        
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.type}</td>
            <td>${item.manufacturer}</td>
            <td>${item.quantity}</td>
        `;
        dataTableBody.appendChild(row);
    });
    
    // Update row count
    rowCountDisplay.textContent = `${data.length} unique items`;
    
    // Show table and enable import button
    previewEmptyState.style.display = 'none';
    previewTableContainer.style.display = 'block';
    importButton.disabled = false;
}

// Import data to Firebase
function importToDatabase() {
    if (!excelData || excelData.length === 0) {
        addResultItem('No data to import', 'error');
        return;
    }
    
    // Disable import button during import
    importButton.disabled = true;
    
    // Show progress container
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressStatus.textContent = 'Processing: 0%';
    
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    let successCount = 0;
    let errorCount = 0;
    let updatedCount = 0;
    let totalItems = excelData.length;
    let processedItems = 0;
    
    // Function to update progress
    const updateProgress = () => {
        processedItems++;
        const percent = Math.round((processedItems / totalItems) * 100);
        progressBar.style.width = `${percent}%`;
        progressStatus.textContent = `Processing: ${percent}%`;
    };
    
    // Use promises for batch processing
    const promises = excelData.map(item => {
        return new Promise((resolve, reject) => {
            // Create a reference using the generated ID
            const itemRef = inventoryRef.child(item.id);
            
            // First check if the item already exists
            itemRef.once('value')
                .then((snapshot) => {
                    const existingItem = snapshot.val();
                    
                    if (existingItem) {
                        // Item exists, update quantity
                        const existingQuantity = parseInt(existingItem.quantity || 0);
                        const newQuantity = parseInt(item.quantity || 0);
                        const totalQuantity = existingQuantity + newQuantity;
                        
                        // Update the item with summed quantity
                        return itemRef.update({
                            quantity: totalQuantity.toString(),
                            lastUpdated: firebase.database.ServerValue.TIMESTAMP
                        }).then(() => {
                            updatedCount++;
                            updateProgress();
                            addResultItem(`Updated item ${item.id} with new quantity: ${totalQuantity}`, 'success');
                            resolve();
                        });
                    } else {
                        // Item doesn't exist, create new
                        return itemRef.set({
                            type: item.type,
                            manufacturer: item.manufacturer,
                            quantity: item.quantity.toString(),
                            createdAt: firebase.database.ServerValue.TIMESTAMP,
                            lastUpdated: firebase.database.ServerValue.TIMESTAMP
                        }).then(() => {
                            successCount++;
                            updateProgress();
                            addResultItem(`Created new item ${item.id}`, 'success');
                            resolve();
                        });
                    }
                })
                .catch(error => {
                    errorCount++;
                    updateProgress();
                    addResultItem(`Error importing item ${item.id}: ${error.message}`, 'error');
                    console.error('Database error:', error);
                    reject(error);
                });
        });
    });
    
    // Process all promises
    Promise.all(promises.map(p => p.catch(e => e)))
        .then(() => {
            // Import complete
            progressStatus.textContent = 'Import Complete';
            
            // Add summary result
            const summary = `Import complete: ${successCount} new items imported, ${updatedCount} existing items updated, ${errorCount} errors.`;
            addResultItem(summary, errorCount > 0 ? 'warning' : 'success');
            
            // Automatically generate QR codes after successful import
            if (errorCount === 0) {
                generateQRCodes();
            }
            
            // Re-enable import button
            importButton.disabled = false;
        })
        .catch(error => {
            console.error('Fatal error during import:', error);
            addResultItem('Fatal error during import. Please check console for details.', 'error');
            importButton.disabled = false;
        });
}

// Add a result item to the results container
function addResultItem(message, type) {
    const resultItem = document.createElement('div');
    resultItem.classList.add('result-item', `result-${type}`);
    
    const timestamp = new Date().toLocaleTimeString();
    resultItem.innerHTML = `
        <div class="result-time">${timestamp}</div>
        <div class="result-message">${message}</div>
    `;
    
    // Add to the top of the results container
    resultsContainer.insertBefore(resultItem, resultsContainer.firstChild);
    
    // Remove the default message if it exists
    const defaultMessage = resultsContainer.querySelector('p');
    if (defaultMessage && defaultMessage.textContent === 'Results will appear here after import...') {
        resultsContainer.removeChild(defaultMessage);
    }
}

// QR Code Generation
function generateQRCodes() {
    const qrCodesGrid = document.getElementById('qr-codes-grid');
    qrCodesGrid.innerHTML = '';
    qrCodes = [];

    const includeManufacturer = document.getElementById('include-manufacturer').checked;
    const includeType = document.getElementById('include-type').checked;
    const qrSize = parseInt(document.getElementById('qr-size').value);

    // Get data from the table
    const tableBody = document.getElementById('data-table-body');
    const rows = tableBody.getElementsByTagName('tr');

    for (let row of rows) {
        const cells = row.getElementsByTagName('td');
        const id = cells[0].textContent;
        const type = cells[1].textContent;
        const manufacturer = cells[2].textContent;

        // Create QR code container
        const qrContainer = document.createElement('div');
        qrContainer.className = 'qr-code-item';
        qrCodesGrid.appendChild(qrContainer);

        // Generate QR code
        const qr = new QRCode(qrContainer, {
            text: id,
            width: qrSize,
            height: qrSize,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });

        // Add item information
        const itemInfo = document.createElement('div');
        itemInfo.className = 'item-info';
        
        if (includeManufacturer) {
            const manufacturerDiv = document.createElement('div');
            manufacturerDiv.className = 'manufacturer';
            manufacturerDiv.textContent = manufacturer;
            itemInfo.appendChild(manufacturerDiv);
        }

        if (includeType) {
            const typeDiv = document.createElement('div');
            typeDiv.className = 'type';
            typeDiv.textContent = type;
            itemInfo.appendChild(typeDiv);
        }

        qrContainer.appendChild(itemInfo);

        // Store QR code data for PDF generation
        qrCodes.push({
            id: id,
            type: type,
            manufacturer: manufacturer,
            element: qrContainer,
            canvas: qrContainer.querySelector('canvas')
        });
    }

    // Show QR preview container and enable buttons
    document.getElementById('qr-preview-container').style.display = 'block';
    document.getElementById('download-pdf').disabled = false;
    document.getElementById('remove-qr-codes').disabled = false;
    updatePaginationButtons();
}

function displayQRPage(page) {
    const qrCodesGrid = document.getElementById('qr-codes-grid');
    qrCodesGrid.innerHTML = '';
    
    const startIndex = page * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, qrCodes.length);
    const qrSize = parseInt(document.getElementById('qr-size').value);
    const includeManufacturer = document.getElementById('include-manufacturer').checked;
    const includeType = document.getElementById('include-type').checked;

    for (let i = startIndex; i < endIndex; i++) {
        const qr = qrCodes[i];
        const qrContainer = document.createElement('div');
        qrContainer.className = 'qr-code-item';

        // Create QR code
        new QRCode(qrContainer, {
            text: qr.id,
            width: qrSize,
            height: qrSize,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });

        // Add item information
        const itemInfo = document.createElement('div');
        itemInfo.className = 'item-info';
        
        if (includeManufacturer) {
            const manufacturerDiv = document.createElement('div');
            manufacturerDiv.className = 'manufacturer';
            manufacturerDiv.textContent = qr.manufacturer;
            itemInfo.appendChild(manufacturerDiv);
        }

        if (includeType) {
            const typeDiv = document.createElement('div');
            typeDiv.className = 'type';
            typeDiv.textContent = qr.type;
            itemInfo.appendChild(typeDiv);
        }

        qrContainer.appendChild(itemInfo);
        qrCodesGrid.appendChild(qrContainer);
    }

    // Update page info
    document.getElementById('page-info').textContent = `Page ${page + 1} of ${Math.ceil(qrCodes.length / itemsPerPage)}`;
}

function updatePaginationButtons() {
    const totalPages = Math.ceil(qrCodes.length / itemsPerPage);
    document.getElementById('prev-page').disabled = currentPage === 0;
    document.getElementById('next-page').disabled = currentPage >= totalPages - 1;
}

function nextPage() {
    const totalPages = Math.ceil(qrCodes.length / itemsPerPage);
    if (currentPage < totalPages - 1) {
        currentPage++;
        displayQRPage(currentPage);
        updatePaginationButtons();
    }
}

function previousPage() {
    if (currentPage > 0) {
        currentPage--;
        displayQRPage(currentPage);
        updatePaginationButtons();
    }
}

function removeQRCodes() {
    // Clear the QR codes array
    qrCodes = [];
    
    // Clear the QR codes grid
    const qrCodesGrid = document.getElementById('qr-codes-grid');
    qrCodesGrid.innerHTML = '';
    
    // Hide the QR preview container
    document.getElementById('qr-preview-container').style.display = 'none';
    
    // Disable the download and remove buttons
    document.getElementById('download-pdf').disabled = true;
    document.getElementById('remove-qr-codes').disabled = true;
    
    // Reset pagination
    currentPage = 0;
    updatePaginationButtons();
}

function generatePDF() {
    if (qrCodes.length === 0) {
        alert('No QR codes to generate PDF for. Please generate QR codes first.');
        return;
    }

    // Create a new jsPDF instance
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12; // Reduced margin
    const qrCodesPerRow = 3;
    const qrCodesPerColumn = 3;
    const qrCodesPerPage = qrCodesPerRow * qrCodesPerColumn;
    
    // Calculate sizes based on page dimensions
    const availableWidth = pageWidth - (2 * margin);
    const availableHeight = pageHeight - (2 * margin);
    
    // Calculate QR code size and spacing
    const qrSize = Math.min(
        (availableWidth - (qrCodesPerRow - 1) * 12) / qrCodesPerRow, // Reduced horizontal spacing
        (availableHeight - (qrCodesPerColumn - 1) * 15) / qrCodesPerColumn // Reduced vertical spacing
    );
    
    const horizontalSpacing = (availableWidth - (qrCodesPerRow * qrSize)) / (qrCodesPerRow - 1);
    const verticalSpacing = 15; // Reduced vertical spacing
    const borderPadding = 4; // Reduced padding
    const itemHeight = qrSize + 25; // Reduced height for text
    
    let currentPage = 0;
    let currentX = margin;
    let currentY = margin;
    
    // Process each QR code
    qrCodes.forEach((qrData, index) => {
        // Add new page if needed
        if (index > 0 && index % qrCodesPerPage === 0) {
            doc.addPage();
            currentPage++;
            currentX = margin;
            currentY = margin;
        }
        
        // Calculate position
        const row = Math.floor((index % qrCodesPerPage) / qrCodesPerRow);
        const col = index % qrCodesPerRow;
        
        currentX = margin + col * (qrSize + horizontalSpacing);
        currentY = margin + row * (itemHeight + verticalSpacing);
        
        // Draw border
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.8);
        doc.rect(
            currentX - borderPadding,
            currentY - borderPadding,
            qrSize + 2 * borderPadding,
            itemHeight + 2 * borderPadding
        );
        
        // Get QR code image data from canvas
        const canvas = qrData.canvas;
        const imgData = canvas.toDataURL('image/png');
        
        // Add QR code to PDF
        doc.addImage(imgData, 'PNG', currentX, currentY, qrSize, qrSize);
        
        // Add text below QR code with proper spacing
        const text = qrData.id;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        
        // Split long IDs into multiple lines if needed
        const maxWidth = qrSize - 8;
        const words = text.split('-');
        let currentLine = '';
        let lines = [];
        
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine}-${word}` : word;
            const testWidth = doc.getTextWidth(testLine);
            
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) {
            lines.push(currentLine);
        }
        
        // Draw each line of text
        lines.forEach((line, i) => {
            const textWidth = doc.getTextWidth(line);
            const textX = currentX + (qrSize - textWidth) / 2;
            doc.text(line, textX, currentY + qrSize + 3 + (i * 3)); // Reduced line spacing
        });
        
        // Add manufacturer and type if included
        let yOffset = currentY + qrSize + 3 + (lines.length * 3); // Adjusted spacing
        doc.setFont('helvetica', 'normal');
        
        if (document.getElementById('include-manufacturer').checked) {
            doc.setFontSize(8);
            const manufacturerText = qrData.manufacturer;
            const manufacturerWidth = doc.getTextWidth(manufacturerText);
            const manufacturerX = currentX + (qrSize - manufacturerWidth) / 2;
            doc.text(manufacturerText, manufacturerX, yOffset);
            yOffset += 3; // Reduced spacing
        }
        
        if (document.getElementById('include-type').checked) {
            doc.setFontSize(7);
            const typeText = qrData.type;
            const typeWidth = doc.getTextWidth(typeText);
            const typeX = currentX + (qrSize - typeWidth) / 2;
            doc.text(typeText, typeX, yOffset);
        }
    });
    
    // Save the PDF
    doc.save('inventory-qr-codes.pdf');
}

// Enable QR code generation when data is loaded
document.getElementById('import-data').addEventListener('click', function() {
    document.getElementById('generate-qr-codes').disabled = false;
}); 