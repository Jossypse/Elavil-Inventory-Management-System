// Firebase configuration - Replace with your Firebase project configuration
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

// Global variables
let database;
let reportsList;
let searchInput;
let activityFilter;
let dateFilter;
let currentPage = 1;
const itemsPerPage = 10;
let filteredRecords = [];
let allRecords = [];
let initialLoadComplete = false;
let seenActivities = new Set();

// Wait for Firebase to load
document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
        console.error('Firebase is not loaded. Please check the script tags.');
        return;
    }
    
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    
    // Reference to database
    database = firebase.database();
    
    // Initialize the rest of the application
    initializeReports();
});

function initializeReports() {
    // DOM Elements
    reportsList = document.getElementById('reports-list');
    searchInput = document.getElementById('search-records');
    activityFilter = document.getElementById('activity-filter');
    dateFilter = document.getElementById('date-filter');

    // Render skeleton rows while loading
    renderSkeletonRows(reportsList, 7, 5);
    
    // Load all activity records
    loadActivityRecords();
    
    // Event listeners for search and filter
    searchInput.addEventListener('input', function() {
        currentPage = 1;
        filterRecords();
    });
    
    activityFilter.addEventListener('change', function() {
        currentPage = 1;
        filterRecords();
    });
    
    dateFilter.addEventListener('change', function() {
        currentPage = 1;
        filterRecords();
    });
    
    // Create and add pagination controls
    createPaginationControls();
}

// Load activity records from the dedicated activities database
function loadActivityRecords() {
    // Clear existing records to prevent duplicates
    allRecords = [];
    
    const activitiesRef = database.ref('activities');
    
    activitiesRef.once('value', (snapshot) => {
        if (!snapshot.exists()) {
            console.log('No activities found');
            processRecords([]);
            return;
        }
        
        const activitiesData = snapshot.val();
        console.log('Activities data:', activitiesData);
        const records = [];
        // Clear the global seen activities set
        seenActivities.clear();
        
        // Convert activities data to records format
        Object.entries(activitiesData).forEach(([timestamp, activity]) => {
            console.log('Processing activity:', activity);
            
            // Create a unique key for this activity
            const activityKey = `${activity.user}-${activity.description}-${activity.role}-${activity.time}`;
            
            // Check if this activity already exists to prevent duplicates
            if (seenActivities.has(activityKey)) {
                console.log('Skipping duplicate activity:', activity.description);
                return;
            }
            
            // Mark this activity as seen
            seenActivities.add(activityKey);
            
            // Convert timestamp string to number for sorting
            let timestampValue;
            if (activity.time && typeof activity.time === 'string') {
                // Convert string timestamp like "20251021165019" to Date object
                // Format: YYYYMMDDHHMMSS
                const timeStr = activity.time.toString();
                if (timeStr.length === 14) {
                    const year = timeStr.substring(0, 4);
                    const month = timeStr.substring(4, 6);
                    const day = timeStr.substring(6, 8);
                    const hour = timeStr.substring(8, 10);
                    const minute = timeStr.substring(10, 12);
                    const second = timeStr.substring(12, 14);
                    
                    // Create Date object
                    const date = new Date(year, month - 1, day, hour, minute, second);
                    timestampValue = date.getTime();
                } else {
                    timestampValue = parseInt(activity.time);
                }
            } else {
                timestampValue = Date.now();
            }
            
            records.push({
                timestamp: timestampValue,
                activityType: activity.actType ? activity.actType.toLowerCase() : 'other',
                description: activity.description || 'No description',
                user: activity.user || 'Unknown',
                role: activity.role || 'Unknown',
                details: activity.details || {},
                id: timestamp // Use timestamp as ID for initial load
            });
        });
        
        // Process and display all records
        processRecords(records);
        
        // Mark initial load as complete
        initialLoadComplete = true;
        
    // Set up comprehensive real-time listeners
    setupRealtimeListeners(activitiesRef);
    });
}

// Set up comprehensive real-time listeners
function setupRealtimeListeners(activitiesRef) {
    console.log('Setting up real-time listeners...');
    
    // Listen for new activities
        activitiesRef.on('child_added', (snapshot) => {
            // Only process if initial load is complete
            if (!initialLoadComplete) {
                return;
            }
            
            const activity = snapshot.val();
        const activityId = snapshot.key;
        
        // Check if this activity already exists by ID
        const existingRecord = allRecords.find(record => record.id === activityId);
        if (existingRecord) {
            console.log('Activity already exists, skipping:', activity.description);
                return;
            }
            
            // Convert timestamp string to number for sorting
            let timestampValue;
            if (activity.time && typeof activity.time === 'string') {
                // Convert string timestamp like "20251021165019" to Date object
                // Format: YYYYMMDDHHMMSS
                const timeStr = activity.time.toString();
                if (timeStr.length === 14) {
                    const year = timeStr.substring(0, 4);
                    const month = timeStr.substring(4, 6);
                    const day = timeStr.substring(6, 8);
                    const hour = timeStr.substring(8, 10);
                    const minute = timeStr.substring(10, 12);
                    const second = timeStr.substring(12, 14);
                    
                    // Create Date object
                    const date = new Date(year, month - 1, day, hour, minute, second);
                    timestampValue = date.getTime();
                } else {
                    timestampValue = parseInt(activity.time);
                }
            } else {
                timestampValue = Date.now();
            }
            
            const newRecord = {
                timestamp: timestampValue,
                activityType: activity.actType ? activity.actType.toLowerCase() : 'other',
                description: activity.description || 'No description',
                user: activity.user || 'Unknown',
                role: activity.role || 'Unknown',
            details: activity.details || {},
            id: activityId // Add ID for tracking
            };
            
            // Add to beginning of records (newest first)
            allRecords.unshift(newRecord);
            
            // Show real-time update indicator
        showRealtimeIndicator('New activity added');
        
        // Re-populate date filter with new data
        populateDateFilter(allRecords);
        
        // Re-filter and render
        filterRecords();
        
        console.log('New activity added in real-time:', activity.description);
    });
    
    // Listen for updated activities
    activitiesRef.on('child_changed', (snapshot) => {
        if (!initialLoadComplete) {
            return;
        }
        
        const activity = snapshot.val();
        const activityId = snapshot.key;
        
        // Find and update existing record
        const recordIndex = allRecords.findIndex(record => record.id === activityId);
        if (recordIndex !== -1) {
            // Convert timestamp
            let timestampValue;
            if (activity.time && typeof activity.time === 'string') {
                const timeStr = activity.time.toString();
                if (timeStr.length === 14) {
                    const year = timeStr.substring(0, 4);
                    const month = timeStr.substring(4, 6);
                    const day = timeStr.substring(6, 8);
                    const hour = timeStr.substring(8, 10);
                    const minute = timeStr.substring(10, 12);
                    const second = timeStr.substring(12, 14);
                    
                    const date = new Date(year, month - 1, day, hour, minute, second);
                    timestampValue = date.getTime();
                } else {
                    timestampValue = parseInt(activity.time);
                }
            } else {
                timestampValue = Date.now();
            }
            
            // Update the record
            allRecords[recordIndex] = {
                timestamp: timestampValue,
                activityType: activity.actType ? activity.actType.toLowerCase() : 'other',
                description: activity.description || 'No description',
                user: activity.user || 'Unknown',
                role: activity.role || 'Unknown',
                details: activity.details || {},
                id: activityId
            };
            
            // Re-sort records by timestamp
            allRecords.sort((a, b) => b.timestamp - a.timestamp);
            
            // Show update indicator
            showRealtimeIndicator('Activity updated');
            
            // Re-populate date filter
            populateDateFilter(allRecords);
            
            // Re-filter and render
            filterRecords();
            
            console.log('Activity updated in real-time:', activity.description);
        }
    });
    
    // Listen for removed activities
    activitiesRef.on('child_removed', (snapshot) => {
        if (!initialLoadComplete) {
            return;
        }
        
        const activityId = snapshot.key;
        const removedActivity = snapshot.val();
        
        // Remove from records
        const recordIndex = allRecords.findIndex(record => record.id === activityId);
        if (recordIndex !== -1) {
            const removedRecord = allRecords[recordIndex];
            allRecords.splice(recordIndex, 1);
            
            // Show update indicator
            showRealtimeIndicator('Activity removed');
            
            // Re-populate date filter
            populateDateFilter(allRecords);
            
            // Re-filter and render
            filterRecords();
            
            console.log('Activity removed in real-time:', activityId, removedRecord.description);
        } else {
            console.log('Activity not found in local records:', activityId);
        }
    });
}

// Process and display records
function processRecords(records) {
    // Sort records by timestamp (newest first)
    allRecords = records.sort((a, b) => b.timestamp - a.timestamp);
    
    // Populate date filter
    populateDateFilter(allRecords);
    
    // Initial filter and render
    filterRecords();
}

// Populate date filter with unique dates
function populateDateFilter(records) {
    const uniqueDates = new Set();
    records.forEach(record => {
        const date = new Date(record.timestamp);
        const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        uniqueDates.add(dateString);
    });
    
    // Sort dates (newest first)
    const sortedDates = Array.from(uniqueDates).sort((a, b) => b.localeCompare(a));
    
    // Clear existing options except "All Time"
    while (dateFilter.options.length > 1) {
        dateFilter.remove(1);
    }
    
    // Add date options
    sortedDates.forEach(dateString => {
        const date = new Date(dateString);
        const displayDate = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        const option = document.createElement('option');
        option.value = dateString;
        option.textContent = displayDate;
        dateFilter.appendChild(option);
    });
}

// Filter records based on search and filters
function filterRecords() {
    const searchTerm = searchInput.value.toLowerCase();
    const activityValue = activityFilter.value;
    const dateValue = dateFilter.value;
    
    filteredRecords = allRecords.filter(record => {
        // Search filter
        if (searchTerm) {
            const search = searchTerm;
            if (!record.description.toLowerCase().includes(search) &&
                !record.user.toLowerCase().includes(search) &&
                !record.role.toLowerCase().includes(search)) {
                return false;
            }
        }
        
        // Activity filter - check based on description first word
        if (activityValue !== 'all') {
            const firstWord = record.description ? record.description.split(' ')[0].toLowerCase() : '';
            let recordType = 'other';
            
            if (firstWord === 'user') {
                recordType = 'users';
            } else if (firstWord === 'bus') {
                recordType = 'buses';
            } else if (firstWord === 'request') {
                recordType = 'requests';
            } else if (firstWord === 'return') {
                recordType = 'returns';
            } else if (firstWord === 'added' || firstWord === 'marked') {
                recordType = 'inventory';
            }
            
            if (recordType !== activityValue) {
            return false;
            }
        }
        
        // Date filter
        if (dateValue !== 'all') {
            const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
            if (recordDate !== dateValue) {
                return false;
            }
        }
        
        return true;
    });
    
    // Render current page
    renderCurrentPage();
    updatePaginationInfo();
}

// Render current page of records
function renderCurrentPage() {
    reportsList.innerHTML = '';
    
    if (filteredRecords.length === 0) {
        reportsList.innerHTML = '<tr><td colspan="6">No records found</td></tr>';
        return;
    }
    
    // Calculate start and end indices for the current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredRecords.length);
    
    // Get records for the current page
    const currentRecords = filteredRecords.slice(startIndex, endIndex);
    
    // Render records
    let rowNum = 1 + startIndex;
    currentRecords.forEach(record => {
        const row = createRecordRow(record, rowNum++);
        reportsList.appendChild(row);
    });
}

// Create a record row
function createRecordRow(record, index) {
    const row = document.createElement('tr');
    const date = new Date(record.timestamp);
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Get activity type badge based on description
    const activityBadge = getActivityBadge(record.activityType, record.description);
    
    // Create description cell with better formatting
    const descriptionCell = document.createElement('td');
    descriptionCell.setAttribute('data-label', 'Description');
    descriptionCell.style.cssText = 'max-width: 400px; min-width: 200px; white-space: normal; word-wrap: break-word; line-height: 1.4;';
    descriptionCell.innerHTML = escapeCell(record.description);
    
    row.innerHTML = `
        <td data-label="No.">${index}</td>
        <td data-label="Timestamp">${formattedDate}</td>
        <td data-label="Activity Type">${activityBadge}</td>
    `;
    
    // Append the description cell
    row.appendChild(descriptionCell);
    
    row.innerHTML += `
        <td data-label="User">${escapeCell(record.user)}</td>
        <td data-label="Role">${escapeCell(record.role)}</td>
    `;
    
    // Add double-click functionality
    row.addEventListener('dblclick', () => {
        showActivityDetails(record);
    });
    
    // Add cursor pointer to indicate clickable
    row.style.cursor = 'pointer';
    
    return row;
}

// Get activity type badge based on description first word
function getActivityBadge(activityType, description) {
    // Get the first word from the description
    const firstWord = description ? description.split(' ')[0].toLowerCase() : '';
    
    // Determine activity type based on first word
    let displayType = 'Other';
    let badgeClass = 'badge-secondary';
    
    if (firstWord === 'user') {
        displayType = 'New User';
        badgeClass = 'badge-info';
    } else if (firstWord === 'bus') {
        displayType = 'New Bus';
        badgeClass = 'badge-warning';
    } else if (firstWord === 'request') {
        displayType = 'Request';
        badgeClass = 'badge-success';
    } else if (firstWord === 'return') {
        displayType = 'Return';
        badgeClass = 'badge-warning';
    } else if (firstWord === 'added' || firstWord === 'marked') {
        displayType = 'Inventory';
        badgeClass = 'badge-primary';
    }
    
    return `<span class="badge ${badgeClass}">${displayType}</span>`;
}

// Show activity details by extracting base ID and fetching related data
async function showActivityDetails(record) {
    try {
        // Extract base ID by removing the -1, -2, etc. suffix
        const baseId = extractBaseId(record.id);
        const activityType = getActivityTypeFromDescription(record.description);
        
        console.log('Showing details for:', record.description);
        console.log('Original record.id:', record.id);
        console.log('Base ID:', baseId);
        console.log('Activity Type:', activityType);
        
        // For request and return activities, we need to get the original request ID
        // from the description to fetch the items
        let originalRequestId = null;
        
        if (activityType === 'request') {
            // For request activities, the baseId should be the original request ID
            // The activity ID format is: {originalRequestId}-{counter}
            // So we can use the baseId directly
            originalRequestId = baseId;
            console.log('Using baseId as original request ID:', originalRequestId);
        } else if (activityType === 'return') {
            // For return requests, the baseId should be the return request ID
            originalRequestId = baseId;
        }
        
        // Fetch related data based on activity type
        let relatedData = null;
        let title = 'Activity Details';
        
        switch (activityType) {
            case 'inventory':
                relatedData = await fetchInventoryData(baseId);
                title = 'Inventory Details';
                break;
            case 'request':
                relatedData = await fetchRequestData(baseId);
                title = 'Request Details';
                break;
            case 'return':
                relatedData = await fetchReturnRequestData(baseId);
                title = 'Return Request Details';
                break;
            case 'user':
                relatedData = await fetchUserData(baseId);
                title = 'User Details';
                break;
            case 'bus':
                relatedData = await fetchBusData(baseId);
                title = 'Bus Details';
                break;
            default:
                relatedData = null;
        }
        
        // Show modal with details and original request ID for items
        showActivityModal(record, relatedData, title, originalRequestId);
        
    } catch (error) {
        console.error('Error fetching activity details:', error);
        alert('Error loading activity details. Please try again.');
    }
}

// Extract base ID by removing suffix like -1, -2, etc.
function extractBaseId(activityId) {
    if (!activityId) return '';
    
    // Remove the last part if it matches pattern -number
    const baseId = activityId.replace(/-\d+$/, '');
    return baseId;
}

// Get activity type from description first word
function getActivityTypeFromDescription(description) {
    const firstWord = description ? description.split(' ')[0].toLowerCase() : '';
    
    if (firstWord === 'user') return 'user';
    if (firstWord === 'bus') return 'bus';
    if (firstWord === 'request') return 'request';
    if (firstWord === 'return') return 'return';
    if (firstWord === 'added' || firstWord === 'marked') return 'inventory';
    
    return 'other';
}

// Fetch inventory data
async function fetchInventoryData(baseId) {
    const inventoryRef = database.ref(`InventoryData/${baseId}`);
    const snapshot = await inventoryRef.once('value');
    return snapshot.exists() ? snapshot.val() : null;
}

// Fetch request data
async function fetchRequestData(baseId) {
    const requestRef = database.ref(`Requests/${baseId}`);
    const snapshot = await requestRef.once('value');
    return snapshot.exists() ? snapshot.val() : null;
}

// Fetch return request data
async function fetchReturnRequestData(baseId) {
    const returnRequestRef = database.ref(`ReturnRequests/${baseId}`);
    const snapshot = await returnRequestRef.once('value');
    return snapshot.exists() ? snapshot.val() : null;
}

// Fetch user data
async function fetchUserData(baseId) {
    const userRef = database.ref(`Users/${baseId}`);
    const snapshot = await userRef.once('value');
    return snapshot.exists() ? snapshot.val() : null;
}

// Fetch bus data
async function fetchBusData(baseId) {
    const busRef = database.ref(`Buses/${baseId}`);
    const snapshot = await busRef.once('value');
    return snapshot.exists() ? snapshot.val() : null;
}

// Find request ID by bus ID from the activity description
async function findRequestIdByBus(description) {
    try {
        // Extract bus ID from description like "Request approved for pickup for Bus 5090"
        const busMatch = description.match(/Bus (\d+)/);
        if (!busMatch) {
            console.log('No bus ID found in description:', description);
            return null;
        }
        
        const extractedBusId = busMatch[1];
        console.log('Looking for requests with bus ID:', extractedBusId);
        
        // Search through Requests to find the one with this bus ID
        const requestsRef = database.ref('Requests');
        const snapshot = await requestsRef.once('value');
        
        if (!snapshot.exists()) {
            console.log('No requests found in database');
            return null;
        }
        
        const requests = snapshot.val();
        console.log('All requests:', Object.keys(requests));
        
        for (const requestId in requests) {
            const request = requests[requestId];
            console.log('Checking request:', requestId, 'busId:', request.busId, 'vs extracted:', extractedBusId);
            if (request.busId === extractedBusId || request.busId === parseInt(extractedBusId)) {
                console.log('Found matching request:', requestId, 'for bus:', extractedBusId);
                return requestId;
            }
        }
        
        console.log('No matching request found for bus:', extractedBusId);
        return null;
    } catch (error) {
        console.error('Error finding request by bus:', error);
        return null;
    }
}

// Show activity modal with details
async function showActivityModal(record, relatedData, title, originalRequestId = null) {
    console.log('showActivityModal called with:', {
        description: record.description,
        originalRequestId: originalRequestId,
        activityType: getActivityTypeFromDescription(record.description)
    });
    
    // Get items list based on activity type
    let itemsList = [];
    const activityType = getActivityTypeFromDescription(record.description);
    
    if (activityType === 'request' && originalRequestId) {
        console.log('Fetching request items for ID:', originalRequestId);
        // For requests, get items from RequestParts using the original request ID
        itemsList = await fetchRequestItems(originalRequestId);
        console.log('Request items found:', itemsList.length);
    } else if (activityType === 'return' && originalRequestId) {
        console.log('Fetching return items for ID:', originalRequestId);
        // For returns, get items from ReturnParts using the original request ID
        itemsList = await fetchReturnItems(originalRequestId);
        console.log('Return items found:', itemsList.length);
    } else {
        console.log('No items to fetch. Activity type:', activityType, 'Original ID:', originalRequestId);
    }
    
    // Create modal HTML
    const modalHTML = `
        <div id="activity-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        ">
            <div style="
                background: white;
                border-radius: 8px;
                padding: 20px;
                max-width: 700px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #333;">${title}</h2>
                    <button id="close-activity-modal" style="
                        background: #e74c3c;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 8px 12px;
                        cursor: pointer;
                        font-size: 16px;
                    ">&times;</button>
                </div>
                
                <div id="activity-modal-content">
                    <div style="margin-bottom: 15px;">
                        <strong>Activity Description:</strong><br>
                        <span style="color: #666;">${record.description}</span>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <strong>Performed By:</strong><br>
                        <span style="color: #666;">${record.user} (${record.role})</span>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <strong>Timestamp:</strong><br>
                        <span style="color: #666;">${new Date(record.timestamp).toLocaleString()}</span>
                    </div>
                    
                    ${itemsList.length > 0 ? `
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                            <strong>Items:</strong><br>
                            <div id="items-list" style="margin-top: 10px;">
                                ${itemsList.map(item => `
                                    <div style="
                                        background: #f8f9fa;
                                        border: 1px solid #dee2e6;
                                        border-radius: 6px;
                                        padding: 12px;
                                        margin-bottom: 8px;
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                    ">
                                        <div>
                                            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">
                                                ${escapeHtml(item.type || 'Unknown Type')}
                                            </div>
                                            <div style="color: #666; font-size: 14px;">
                                                ${escapeHtml(item.manufacturer || 'N/A')} ${escapeHtml(item.brand || '')}
                                            </div>
                                        </div>
                                        <div style="
                                            background: #007bff;
                                            color: white;
                                            padding: 4px 8px;
                                            border-radius: 4px;
                                            font-weight: 600;
                                            font-size: 14px;
                                        ">
                                            Qty: ${escapeHtml(item.quantity || 0)}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : relatedData ? `
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                            ${getFormattedRelatedData(relatedData, activityType)}
                        </div>
                    ` : `
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                            <span style="color: #999;">No related data found</span>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add close functionality
    const modal = document.getElementById('activity-modal');
    const closeBtn = document.getElementById('close-activity-modal');
    
    const closeModal = () => {
        modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Fetch request items from PartsRequest
async function fetchRequestItems(requestId) {
    try {
        console.log('fetchRequestItems called with requestId:', requestId);
        const partsRequestRef = database.ref(`PartsRequest/${requestId}`);
        const snapshot = await partsRequestRef.once('value');
        
        console.log('PartsRequest snapshot exists:', snapshot.exists());
        
        if (!snapshot.exists()) {
            console.log('No PartsRequest found for requestId:', requestId);
            return [];
        }
        
        const partsData = snapshot.val();
        console.log('PartsRequest data:', partsData);
        
        const itemsList = [];
        
        Object.keys(partsData).forEach(partId => {
            const part = partsData[partId];
            console.log('Processing part:', partId, part);
            itemsList.push({
                type: part.type || 'Unknown Type',
                manufacturer: part.manufacturer || 'N/A',
                brand: part.brand || '',
                quantity: part.quantity || 0,
                unit: part.quantityUnit || part.unit || ''
            });
        });
        
        console.log('Final items list:', itemsList);
        return itemsList;
    } catch (error) {
        console.error('Error fetching request items:', error);
        return [];
    }
}

// Fetch return items from ReturnParts
async function fetchReturnItems(returnRequestId) {
    try {
        const returnPartsRef = database.ref(`ReturnParts/${returnRequestId}`);
        const snapshot = await returnPartsRef.once('value');
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const partsData = snapshot.val();
        const itemsList = [];
        
        Object.keys(partsData).forEach(partId => {
            const part = partsData[partId];
            itemsList.push({
                type: part.type || 'Unknown Type',
                manufacturer: part.manufacturer || 'N/A',
                brand: part.brand || '',
                quantity: part.quantity || 0,
                unit: part.quantityUnit || part.unit || ''
            });
        });
        
        return itemsList;
    } catch (error) {
        console.error('Error fetching return items:', error);
        return [];
    }
}

// Format related data in a user-friendly way
function getFormattedRelatedData(data, activityType) {
    if (!data) return '<span style="color: #999;">No related data found</span>';
    
    switch (activityType) {
        case 'inventory':
            return `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745;">
                    <h4 style="margin: 0 0 10px 0; color: #333;">Inventory Details</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><strong>Type:</strong> ${escapeHtml(data.type || 'N/A')}</div>
                        <div><strong>Brand:</strong> ${escapeHtml(data.brand || 'N/A')}</div>
                        <div><strong>Manufacturer:</strong> ${escapeHtml(data.manufacturer || 'N/A')}</div>
                        <div><strong>Quantity:</strong> ${escapeHtml(data.quantity || 0)} ${escapeHtml(data.quantityUnit || '')}</div>
                        <div><strong>Description:</strong> ${escapeHtml(data.description || 'N/A')}</div>
                        <div><strong>Supplier:</strong> ${escapeHtml(data.supplierName || 'N/A')}</div>
                        <div><strong>Contact:</strong> ${escapeHtml(data.supplierNumber || 'N/A')}</div>
                        <div><strong>Low Stock Limit:</strong> ${escapeHtml(data.limitL || 'N/A')}</div>
                    </div>
                </div>
            `;
            
        case 'user':
            return `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff;">
                    <h4 style="margin: 0 0 10px 0; color: #333;">User Details</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><strong>Full Name:</strong> ${escapeHtml(data.fullName || 'N/A')}</div>
                        <div><strong>Username:</strong> ${escapeHtml(data.username || 'N/A')}</div>
                        <div><strong>Employee Type:</strong> ${escapeHtml(data.employeeType || 'N/A')}</div>
                        <div><strong>Level:</strong> ${escapeHtml(data.level || 'N/A')}</div>
                        <div><strong>Age:</strong> ${escapeHtml(data.age || 'N/A')}</div>
                        <div><strong>Contact:</strong> ${escapeHtml(data.contactNumber || 'N/A')}</div>
                        <div><strong>Address:</strong> ${escapeHtml(data.address || 'N/A')}</div>
                        <div><strong>Assigned Bus:</strong> ${escapeHtml(data.assignedBus || 'N/A')}</div>
                        <div><strong>Unique ID:</strong> ${escapeHtml(data.uniqueId || 'N/A')}</div>
                    </div>
                </div>
            `;
            
        case 'bus':
            return `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107;">
                    <h4 style="margin: 0 0 10px 0; color: #333;">Bus Details</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><strong>Bus Number:</strong> ${escapeHtml(data.busNumber || 'N/A')}</div>
                        <div><strong>Plate Number:</strong> ${escapeHtml(data.plateNumber || 'N/A')}</div>
                        <div><strong>Acquired Date:</strong> ${escapeHtml(data.acquiredDate || 'N/A')}</div>
                        <div><strong>Notes:</strong> ${escapeHtml(data.notes || 'N/A')}</div>
                    </div>
                </div>
            `;
            
        default:
            return `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #6c757d;">
                    <h4 style="margin: 0 0 10px 0; color: #333;">Related Information</h4>
                    <pre style="
                        background: #fff;
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                        font-size: 12px;
                        margin: 0;
                        border: 1px solid #dee2e6;
                    ">${JSON.stringify(data, null, 2)}</pre>
                </div>
            `;
    }
}

// Escape HTML function
function escapeHtml(str) {
    if (!str) return '';
    str = String(str);
    return str.replace(/[&<>"]/g, function(s) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
        return map[s] || s;
    });
}

// View record details (legacy function)
window.viewRecordDetails = function(timestamp) {
    const record = allRecords.find(r => r.timestamp.toString() === timestamp);
    if (!record) return;
    
    const details = `
        <strong>Activity:</strong> ${record.description}<br>
        <strong>User:</strong> ${record.user} (${record.role})<br>
        <strong>Time:</strong> ${new Date(record.timestamp).toLocaleString()}<br>
        <strong>Type:</strong> ${record.activityType}<br>
        ${record.details ? `<strong>Details:</strong> ${JSON.stringify(record.details, null, 2)}` : ''}
    `;
    
    alert(`Record Details:\n\n${details}`);
};

// Create pagination controls
function createPaginationControls() {
    // Create pagination container if it doesn't exist
    if (!document.getElementById('pagination-controls')) {
        const paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination-controls';
        paginationContainer.className = 'pagination-controls';
        
        // Create previous button
        const prevButton = document.createElement('button');
        prevButton.id = 'prev-page';
        prevButton.className = 'pagination-btn';
        prevButton.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderCurrentPage();
                updatePaginationInfo();
            }
        });
        
        // Create next button
        const nextButton = document.createElement('button');
        nextButton.id = 'next-page';
        nextButton.className = 'pagination-btn';
        nextButton.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
        nextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderCurrentPage();
                updatePaginationInfo();
            }
        });
        
        // Create page information display
        const pageInfo = document.createElement('div');
        pageInfo.id = 'page-info';
        pageInfo.className = 'page-info';
        pageInfo.textContent = 'Page 1 of 1';
        
        // Add elements to pagination container
        paginationContainer.appendChild(prevButton);
        paginationContainer.appendChild(pageInfo);
        paginationContainer.appendChild(nextButton);
        
        // Add pagination container to the page
        const reportsDisplay = document.getElementById('reports-display');
        if (reportsDisplay) {
            reportsDisplay.appendChild(paginationContainer);
        }
    }
}

// Update pagination info
function updatePaginationInfo() {
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const pageInfo = document.getElementById('page-info');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    }
    
    // Update button states
    if (prevButton) {
        prevButton.disabled = currentPage <= 1;
    }
    
    if (nextButton) {
        nextButton.disabled = currentPage >= totalPages;
    }
}

// Render skeleton placeholder rows
function renderSkeletonRows(tbody, columns, rows) {
    if (!tbody) return;
    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        tr.className = 'skeleton-row';
        for (let c = 0; c < columns; c++) {
            const td = document.createElement('td');
            const bar = document.createElement('span');
            bar.className = 'skeleton';
            td.appendChild(bar);
            tr.appendChild(td);
        }
        frag.appendChild(tr);
    }
    tbody.innerHTML = '';
    tbody.appendChild(frag);
}


// Function to add sample activity data to Firebase (call this once to add your data)
function addSampleActivityToFirebase() {
    const sampleActivity = {
        actType: "Inventory",
        description: "Administrator Elton Devie Responde added 3 Sample Aircon to inventory",
        role: "Administrator",
        time: "20251021165019",
        user: "Elton Devie Responde"
    };
    
    // Add to Firebase
    const activitiesRef = database.ref('activities');
    const newActivityRef = activitiesRef.push();
    newActivityRef.set(sampleActivity)
        .then(() => {
            console.log('Sample activity added to Firebase successfully!');
        })
        .catch((error) => {
            console.error('Error adding sample activity:', error);
        });
}

// Uncomment the line below to add the sample data to Firebase (run this once)
// addSampleActivityToFirebase();

// Show real-time update indicator
function showRealtimeIndicator(message = 'New activity added') {
    // Create or update real-time indicator
    let indicator = document.getElementById('realtime-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'realtime-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2ecc71;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            cursor: pointer;
        `;
        document.body.appendChild(indicator);
        
        // Add click to dismiss functionality
        indicator.addEventListener('click', () => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 300);
        });
    }
    
    // Set different colors based on message type
    if (message.includes('updated')) {
        indicator.style.background = '#f39c12'; // Orange for updates
    } else if (message.includes('removed')) {
        indicator.style.background = '#e74c3c'; // Red for removals
    } else {
        indicator.style.background = '#2ecc71'; // Green for new activities
    }
    
    indicator.innerHTML = `<i class="fas fa-sync-alt"></i> ${message}`;
    indicator.style.display = 'block';
    indicator.style.opacity = '1';
    
    // Hide after 4 seconds
    setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 300);
    }, 4000);
}


// Escape HTML in cell content
function escapeCell(val) {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}