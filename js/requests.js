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
const requestsRef = database.ref('Requests');
const usersRef = database.ref('Users');
const partsRequestRef = database.ref('PartsRequest');
const inventoryRef = database.ref('InventoryData');

// DOM Elements
const searchInput = document.getElementById('search-requests');
const statusFilter = document.getElementById('status-filter');
const dateFilter = document.getElementById('date-filter');
const requestsTableBody = document.getElementById('requests-table-body');
const requestsEmptyState = document.getElementById('requests-empty-state');
const requestsTableContainer = document.getElementById('requests-table-container');
const toBeConfirmedCount = document.getElementById('toBeConfirmed-count');
const toPickupCount = document.getElementById('toPickup-count');
const notAvailableCount = document.getElementById('toWait-count');
const completedCount = document.getElementById('completed-count');

// Modal Elements
const modal = document.getElementById('request-modal');
const closeModal = document.querySelector('.close-modal');
const modalRequestId = document.getElementById('modal-request-id');
const modalMechanicId = document.getElementById('modal-mechanic-id');
const modalBusId = document.getElementById('modal-bus-id');
const modalDate = document.getElementById('modal-date');
const modalStatus = document.getElementById('modal-status');
const modalNotes = document.getElementById('modal-notes');
const approveButton = document.getElementById('approve-request');
const rejectButton = document.getElementById('reject-request');

// Current request being viewed
let currentRequest = null;

// Add pagination variables
let currentPage = 1;
const itemsPerPage = 5;
let totalPages = 1;

// Add pagination controls to the HTML
function addPaginationControls() {
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-controls';
    paginationContainer.innerHTML = `
        <button id="prev-page" class="pagination-button" disabled>Previous</button>
        <span id="page-info">Page 1 of 1</span>
        <button id="next-page" class="pagination-button" disabled>Next</button>
    `;
    
    // Insert pagination controls after the table
    requestsTableContainer.parentNode.insertBefore(paginationContainer, requestsTableContainer.nextSibling);
    
    // Add event listeners
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayRequests(currentRequests);
        }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayRequests(currentRequests);
        }
    });
}

// Store current requests globally
let currentRequests = [];
let mechanicIdToName = {};

// Modal items pagination state
let modalItems = [];
let modalItemsPage = 1;
const modalItemsPerPage = 5;

// Build mechanicId -> fullName map from Users
usersRef.on('value', (snapshot) => {
    const map = {};
    snapshot.forEach(child => {
        const val = child.val() || {};
        const uniqueId = val.uniqueId || val.id || child.key;
        const fullName = val.fullName || val.name || '';
        if (uniqueId && fullName) {
            map[String(uniqueId)] = String(fullName);
        }
    });
    mechanicIdToName = map;
    // Re-render newest-first with updated names
    if (currentRequests && currentRequests.length) {
        currentRequests.sort((a, b) => {
            const diff = parseRequestDate(b) - parseRequestDate(a);
            if (diff !== 0) return diff;
            return String(b.partsRequestID).localeCompare(String(a.partsRequestID));
        });
        currentPage = 1;
        displayRequests(currentRequests);
        updateStats(currentRequests);
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Add pagination controls
    addPaginationControls();
    
    // Load requests
    loadRequests();

    // Add event listeners
    searchInput.addEventListener('input', () => {
        currentPage = 1; // Reset to first page on search
        filterRequests();
    });
    statusFilter.addEventListener('change', () => {
        currentPage = 1; // Reset to first page on filter
        filterRequests();
    });
    dateFilter.addEventListener('change', () => {
        currentPage = 1; // Reset to first page on filter
        filterRequests();
    });
    closeModal.addEventListener('click', closeRequestModal);
    
    // Remove any existing listeners
    approveButton.removeEventListener('click', approveRequest);
    rejectButton.removeEventListener('click', rejectRequest);
    
    // Add new listeners
    approveButton.addEventListener('click', approveRequest);
    rejectButton.addEventListener('click', rejectRequest);

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeRequestModal();
        }
    });
});

// Load requests from Firebase
function loadRequests() {
    // Remove any existing listeners to prevent duplicates
    requestsRef.off();
    
    // Show loading state
    requestsTableBody.innerHTML = '<tr><td colspan="6" class="loading">Loading requests...</td></tr>';
    
    console.log('Loading requests from Firebase...');
    
    // Set up initial load and individual update listeners
    requestsRef.once('value')
        .then((snapshot) => {
            console.log('Firebase data received:', snapshot.exists());
            
            if (!snapshot.exists()) {
                console.log('No requests found in database');
                requestsTableBody.innerHTML = '';
                requestsEmptyState.style.display = 'block';
                requestsTableContainer.style.display = 'none';
                updateStats([]);
                return;
            }
            
            const requests = [];
            snapshot.forEach((childSnapshot) => {
                requests.push({
                    ...childSnapshot.val(),
                    partsRequestID: childSnapshot.key
                });
            });
            
            console.log(`Loaded ${requests.length} requests`);
            
            // Sort requests by parsed date (newest first)
            requests.sort((a, b) => parseRequestDate(b) - parseRequestDate(a));
            
            // Store requests globally and display first page
            currentRequests = requests;
            currentPage = 1;
            displayRequests(requests);
            updateStats(requests);
            
            // Set up individual listeners after initial load
            setupRequestListeners();
            
        })
        .catch((error) => {
            console.error('Error loading requests:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            let errorMessage = 'Error loading requests';
            if (error.code === 'PERMISSION_DENIED') {
                errorMessage = 'Permission denied. Please check Firebase database rules.';
            }
            
            requestsTableBody.innerHTML = `<tr><td colspan="6" class="error-message">${errorMessage}</td></tr>`;
        });
}

// Function to update a single request row
async function updateRequestRow(updatedRequest) {
    // Find the row in the table
    const row = document.querySelector(`tr[data-request-id="${updatedRequest.partsRequestID}"]`);
    if (!row) return;

    // Update the status cell
    const statusCell = row.querySelector('.status-badge');
    if (statusCell) {
        statusCell.className = `status-badge status-${updatedRequest.status.toLowerCase()}`;
        statusCell.textContent = updatedRequest.status;
    }

    // Update the request in currentRequests array
    const index = currentRequests.findIndex(r => r.partsRequestID === updatedRequest.partsRequestID);
    if (index !== -1) {
        currentRequests[index] = updatedRequest;
    }
}

// Function to update stats for a single change
function updateStatsFromChange(updatedRequest) {
    // Recalculate from current table rows to avoid drift
    const rows = document.querySelectorAll('#requests-table-body tr');
    const stats = { ToBeConfirmed: 0, ToPickup: 0, NotAvailable: 0, Completed: 0 };
    rows.forEach(row => {
        const badge = row.querySelector('.status-badge');
        if (!badge) return;
        const status = badge.textContent;
        if (stats.hasOwnProperty(status)) stats[status]++;
    });
    if (toBeConfirmedCount) toBeConfirmedCount.textContent = stats.ToBeConfirmed;
    if (toPickupCount) toPickupCount.textContent = stats.ToPickup;
    if (notAvailableCount) notAvailableCount.textContent = stats.NotAvailable;
    if (completedCount) completedCount.textContent = stats.Completed;
}

// Set up individual listeners for each request
function setupRequestListeners() {
    // Listen for changes to any request
    requestsRef.on('child_changed', async (snapshot) => {
        const updatedRequest = {
            ...snapshot.val(),
            partsRequestID: snapshot.key
        };
        
        // Update or insert in currentRequests, then resort newest-first and re-render from page 1
        const idx = currentRequests.findIndex(r => r.partsRequestID === updatedRequest.partsRequestID);
        if (idx !== -1) {
            currentRequests[idx] = updatedRequest;
        } else {
            currentRequests.push(updatedRequest);
        }
        currentRequests.sort((a, b) => parseRequestDate(b) - parseRequestDate(a));
        currentPage = 1;
        displayRequests(currentRequests);
        updateStats(currentRequests);
        
        // If this is the currently viewed request, update the modal
        if (currentRequest && currentRequest.partsRequestID === updatedRequest.partsRequestID) {
            currentRequest = updatedRequest;
            updateModalContent(updatedRequest);
        }
    });

    // Listen for new requests (incremental update, no full reload)
    requestsRef.on('child_added', (snapshot) => {
        const newRequest = {
            ...snapshot.val(),
            partsRequestID: snapshot.key
        };
        // Add to current list if not already present
        const exists = currentRequests.some(r => r.partsRequestID === newRequest.partsRequestID);
        if (!exists) {
            currentRequests.push(newRequest);
            // Keep newest first
            currentRequests.sort((a, b) => parseRequestDate(b) - parseRequestDate(a));
            // Re-render current view
            currentPage = 1;
            displayRequests(currentRequests);
            updateStats(currentRequests);
        }
    });

    // Listen for removed requests (incremental update)
    requestsRef.on('child_removed', (snapshot) => {
        const removedId = snapshot.key;
        const beforeLen = currentRequests.length;
        currentRequests = currentRequests.filter(r => r.partsRequestID !== removedId);
        if (currentRequests.length !== beforeLen) {
            currentPage = 1;
            currentRequests.sort((a, b) => parseRequestDate(b) - parseRequestDate(a));
            displayRequests(currentRequests);
            updateStats(currentRequests);
        }
    });
}

// Update a single request row
async function updateRequestRow(request) {
    const row = document.querySelector(`tr[data-request-id="${request.partsRequestID}"]`);
    if (!row) return;

    const availability = await checkItemsAvailability(request);
    
    // Update row classes
    if (!availability.isAvailable && request.status === 'ToBeConfirmed') {
        row.classList.add('unavailable-items');
    } else {
        row.classList.remove('unavailable-items');
    }
    
    // Update row content with index as first column
    const mechName = getMechanicName(request.mechanicId);
    const index = (typeof row.sectionRowIndex === 'number' ? row.sectionRowIndex + 1 : 1);
    row.innerHTML = `
        <td>${index}</td>
        <td>${mechName}</td>
        <td>${request.busId}</td>
        <td>${request.date}</td>
        <td><span class="status-badge status-${request.status.toLowerCase()}">${request.status}</span></td>
        <td>
            <button class="action-button view-button" onclick="viewRequest('${request.partsRequestID}')">
                View
            </button>
        </td>
    `;
}

// Update stats based on a single request change
function updateStatsFromChange(updatedRequest) {
    // Recalculate stats from all current requests
    const rows = document.querySelectorAll('#requests-table-body tr');
    const stats = {
        toBeConfirmed: 0,
        toPickup: 0,
        notAvailable: 0
    };

    rows.forEach(row => {
        const badge = row.querySelector('.status-badge');
        if (!badge) return;
        const status = badge.textContent;
        switch(status) {
            case 'ToBeConfirmed':
                stats.toBeConfirmed++;
                break;
            case 'ToPickup':
                stats.toPickup++;
                break;
            case 'NotAvailable':
                stats.notAvailable++;
                break;
        }
    });

    // Update the display
    if (toBeConfirmedCount) toBeConfirmedCount.textContent = stats.toBeConfirmed;
    if (toPickupCount) toPickupCount.textContent = stats.toPickup;
    if (notAvailableCount) notAvailableCount.textContent = stats.notAvailable;
}

// Display requests in the table with pagination
async function displayRequests(requests) {
    // Clear existing content
    requestsTableBody.innerHTML = '';
    
    if (requests.length === 0) {
        requestsEmptyState.style.display = 'block';
        requestsTableContainer.style.display = 'none';
        return;
    }
    
    requestsEmptyState.style.display = 'none';
    requestsTableContainer.style.display = 'block';
    
    // Ensure newest first (with id fallback for stability)
    requests = requests.slice().sort((a, b) => {
        const diff = parseRequestDate(b) - parseRequestDate(a);
        if (diff !== 0) return diff;
        return String(b.partsRequestID).localeCompare(String(a.partsRequestID));
    });
    
    // Calculate pagination
    totalPages = Math.ceil(requests.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, requests.length);
    const currentPageRequests = requests.slice(startIndex, endIndex);
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Process current page requests
    let rowNum = 1;
    for (const request of currentPageRequests) {
        const row = document.createElement('tr');
        row.setAttribute('data-request-id', request.partsRequestID);
        
        // Only check availability for ToBeConfirmed status
        if (request.status === 'ToBeConfirmed') {
            const availability = await checkItemsAvailability(request);
            if (!availability.isAvailable) {
                row.classList.add('unavailable-items');
            }
        }
        
        const mechName = getMechanicName(request.mechanicId);
        row.innerHTML = `
            <td>${rowNum++}</td>
            <td>${mechName}</td>
            <td>${request.busId}</td>
            <td>${request.date}</td>
            <td><span class="status-badge status-${request.status.toLowerCase()}">${request.status}</span></td>
            <td>
                <button class="action-button view-button" onclick="viewRequest('${request.partsRequestID}')">
                    View
                </button>
            </td>
        `;
        
        fragment.appendChild(row);
    }
    
    requestsTableBody.appendChild(fragment);
    updatePaginationControls();
}

// Update pagination controls
function updatePaginationControls() {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    if (!prevButton || !nextButton || !pageInfo) return;
    
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

// Update statistics
function updateStats(requests) {
    const stats = { ToBeConfirmed: 0, ToPickup: 0, NotAvailable: 0, Completed: 0 };
    requests.forEach(request => {
        const status = request.status;
        if (stats.hasOwnProperty(status)) stats[status]++;
    });
    if (toBeConfirmedCount) toBeConfirmedCount.textContent = stats.ToBeConfirmed;
    if (toPickupCount) toPickupCount.textContent = stats.ToPickup;
    if (notAvailableCount) notAvailableCount.textContent = stats.NotAvailable;
    if (completedCount) completedCount.textContent = stats.Completed;
}

// Filter requests based on search and filters - Optimized version
function filterRequests() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    const dateValue = dateFilter.value;
    
    // Reset to first page when filtering
    currentPage = 1;
    
    // Use the stored requests instead of fetching again
    if (!currentRequests) return;
    
    const filteredRequests = currentRequests.filter(request => {
        // Apply filters
        const mechName = getMechanicName(request.mechanicId).toLowerCase();
        const matchesSearch = 
            mechName.includes(searchTerm) ||
            String(request.mechanicId).toLowerCase().includes(searchTerm) ||
            request.busId.toLowerCase().includes(searchTerm) ||
            request.partsRequestID.toLowerCase().includes(searchTerm) ||
            request.status.toLowerCase().includes(searchTerm);
        
        const matchesStatus = statusValue === 'all' || request.status === statusValue;
        const matchesDate = filterByDate(request, dateValue);
        
        return matchesSearch && matchesStatus && matchesDate;
    });
    
    // Ensure newest-first and reset to page 1
    filteredRequests.sort((a, b) => parseRequestDate(b) - parseRequestDate(a));
    currentPage = 1;
    displayRequests(filteredRequests);
    updateStats(filteredRequests);
}

// Filter by date using parsed timestamps; supports today, yesterday, week, month
function filterByDate(request, filterValue) {
    if (filterValue === 'all') return true;
    const ts = parseRequestDate(request);
    if (!ts) return false;
    const d = new Date(ts);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    const day = startOfWeek.getDay();
    const diffToMonday = (day === 0 ? 6 : day - 1);
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    switch (filterValue) {
        case 'today':
            return d >= startOfToday;
        case 'yesterday':
            return d >= startOfYesterday && d < startOfToday;
        case 'week':
            return d >= startOfWeek;
        case 'month':
            return d >= startOfMonth;
        default:
            return true;
    }
}

// View request details
function viewRequest(requestId) {
    // Clear previous content
    const requestedItemsContainer = document.getElementById('requested-items-container');
    if (requestedItemsContainer) {
        requestedItemsContainer.innerHTML = '<div class="loading">Loading request details...</div>';
    }
    
    // Show modal first
    modal.style.display = 'block';

    // Remove previous listeners if any
    if (window._modalRequestListener) {
        window._modalRequestListener.off();
    }
    if (window._modalPartsListener) {
        window._modalPartsListener.off();
    }

    // Get request details and set up real-time listener
    const requestRef = requestsRef.child(requestId);
    const partsRef = partsRequestRef.child(requestId);

    // Listen for changes to the request
    requestRef.on('value', (snapshot) => {
        if (!snapshot.exists()) {
            if (requestedItemsContainer) {
                requestedItemsContainer.innerHTML = '<p class="error-message">Request not found</p>';
            }
            return;
        }
        
        const updatedRequest = {
            ...snapshot.val(),
            partsRequestID: requestId
        };
        
        currentRequest = updatedRequest;
        updateModalContent(updatedRequest);
        
        // Also update the row in the main table
        updateRequestRow(updatedRequest);
    });
    window._modalRequestListener = requestRef;

    // Listen for changes to the parts/items
    partsRef.on('value', (partsSnapshot) => {
        if (partsSnapshot.exists() && currentRequest) {
            currentRequest.items = partsSnapshot.val();
            displayRequestedItems(currentRequest);
        }
    });
    window._modalPartsListener = partsRef;
}

// Update modal content
function updateModalContent(request) {
    // Build compact layout similar to Return Request modal
    const modalBody = document.querySelector('.modal-body');
    modalBody.innerHTML = `
        <div class="requested-items-section">
            <div class="action-buttons">
                <button id="approve-request" class="success-button" ${request.status === 'ToPickup' ? 'disabled' : ''}>
                    <i class="fas fa-check"></i> ToPickup
                </button>
                <button id="reject-request" class="danger-button" ${request.status === 'NotAvailable' ? 'disabled' : ''}>
                    <i class="fas fa-times"></i> NotAvailable
                </button>
            </div>
            <div id="request-note" class="request-note">
                ${request.notes ? `<strong>Note:</strong> ${request.notes}` : '<strong>Note:</strong> No note provided'}
            </div>
            <div id="requested-items-container" class="items-container"></div>
        </div>
    `;

    // Update modal header (keep simple title and close)
    const modalHeader = document.querySelector('.modal-header');
    modalHeader.innerHTML = `
        <h2><i class="fas fa-clipboard-list"></i> Request Details</h2>
        <button class="close-modal">&times;</button>
    `;

    const closeButton = modalHeader.querySelector('.close-modal');
    closeButton.addEventListener('click', closeRequestModal);

    // Wire buttons
    const approveButton = modalBody.querySelector('#approve-request');
    const rejectButton = modalBody.querySelector('#reject-request');
    approveButton.addEventListener('click', () => updateRequestStatus('ToPickup'));
    rejectButton.addEventListener('click', () => updateRequestStatus('NotAvailable'));
}

// Function to update request status without page refresh
async function updateRequestStatus(newStatus) {
    if (!currentRequest) return;
    
    try {
        // Update in Firebase
        await requestsRef.child(currentRequest.partsRequestID).update({
            status: newStatus
        });

        // Update the status in the table row
        const tableRow = document.querySelector(`tr[data-request-id="${currentRequest.partsRequestID}"]`);
        if (tableRow) {
            const statusCell = tableRow.querySelector('.status-badge');
            if (statusCell) {
                statusCell.className = `status-badge status-${newStatus.toLowerCase()}`;
                statusCell.textContent = newStatus;
            }
        }

        // Update the current request object
        currentRequest.status = newStatus;
        
        // Show success message with animation
        const notification = document.createElement('div');
        notification.className = 'status-update-notification';
        notification.textContent = `Status updated to ${newStatus}`;
        document.body.appendChild(notification);
        
        // Remove notification after animation
        setTimeout(() => {
            notification.remove();
        }, 3000);

        // Close the modal with animation
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            closeRequestModal();
            modal.style.animation = '';
        }, 300);
        
        // Update request in currentRequests array
        const requestIndex = currentRequests.findIndex(r => r.partsRequestID === currentRequest.partsRequestID);
        if (requestIndex !== -1) {
            currentRequests[requestIndex].status = newStatus;
        }
        
    } catch (error) {
        console.error('Error updating status:', error);
        // Show error message
        const errorNotification = document.createElement('div');
        errorNotification.className = 'status-update-notification error';
        errorNotification.textContent = 'Failed to update status';
        document.body.appendChild(errorNotification);
        
        setTimeout(() => {
            errorNotification.remove();
        }, 3000);
    }
}

// Function to update request status
async function updateRequestStatus(newStatus) {
    if (!currentRequest) return;
    
    try {
        // Update in Firebase
        await requestsRef.child(currentRequest.partsRequestID).update({
            status: newStatus
        });

        // Show success notification
        const notification = document.createElement('div');
        notification.className = 'status-update-notification';
        notification.textContent = `Status updated to ${newStatus}`;
        document.body.appendChild(notification);
        
        // Remove notification after animation
        setTimeout(() => {
            notification.remove();
        }, 3000);

        // Close the modal with animation
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            closeRequestModal();
            modal.style.animation = '';
        }, 300);
        
    } catch (error) {
        console.error('Error updating status:', error);
        const errorNotification = document.createElement('div');
        errorNotification.className = 'status-update-notification error';
        errorNotification.textContent = 'Failed to update status';
        document.body.appendChild(errorNotification);
        
        setTimeout(() => {
            errorNotification.remove();
        }, 3000);
    }
}

// Update action buttons based on current status
function updateActionButtons() {
    if (!currentRequest) return;
    const status = currentRequest.status;
    
    // Reset all buttons
    approveButton.disabled = false;
    rejectButton.disabled = false;
    
    // Disable buttons based on current status
    switch (status) {
        case 'ToPickup':
            approveButton.disabled = true;
            break;
        case 'NotAvailable':
            rejectButton.disabled = true;
            break;
    }
}

// Close request modal
function closeRequestModal() {
    // Remove real-time listeners
    if (window._modalRequestListener) {
        window._modalRequestListener.off();
        window._modalRequestListener = null;
    }
    if (window._modalPartsListener) {
        window._modalPartsListener.off();
        window._modalPartsListener = null;
    }
    modal.style.display = 'none';
    currentRequest = null;
    // Clear modal content
    const requestedItemsContainer = document.getElementById('requested-items-container');
    if (requestedItemsContainer) {
        requestedItemsContainer.innerHTML = '';
    }
    // Reset form fields
    const notesField = document.getElementById('modal-notes');
    if (notesField) notesField.value = '';
}

// Reject request
function rejectRequest() {
    if (!currentRequest) return;
    
    // Disable buttons to prevent double clicks
    approveButton.disabled = true;
    rejectButton.disabled = true;
    
    const updates = {
        status: 'NotAvailable',
        notes: modalNotes.value,
        rejectedDate: new Date().toISOString()
    };
    
    requestsRef.child(currentRequest.partsRequestID).update(updates)
        .then(() => {
            // Close the modal after successful update
            closeRequestModal();
        })
        .catch(error => {
            console.error('Error updating request:', error);
            alert('Error updating request status');
            // Re-enable buttons on error
            approveButton.disabled = false;
            rejectButton.disabled = false;
        });
}

// Approve request
function approveRequest() {
    if (!currentRequest) return;
    
    // Disable buttons to prevent double clicks
    approveButton.disabled = true;
    rejectButton.disabled = true;
    
    const updates = {
        status: 'ToPickup',
        notes: modalNotes.value,
        approvedDate: new Date().toISOString()
    };
    
    requestsRef.child(currentRequest.partsRequestID).update(updates)
        .then(() => {
            // Close the modal after successful update
            closeRequestModal();
        })
        .catch(error => {
            console.error('Error updating request:', error);
            alert('Error updating request status');
            // Re-enable buttons on error
            approveButton.disabled = false;
            rejectButton.disabled = false;
        });
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Safely parse date; supports ISO, dd/mm/yyyy, and fallback from partsRequestID
function parseRequestDate(request) {
    // Numeric timestamps first
    if (typeof request.createdAt === 'number') return request.createdAt;
    if (typeof request.requestedAt === 'number') return request.requestedAt;
    if (typeof request.approvedDate === 'number') return request.approvedDate;
    if (typeof request.rejectedDate === 'number') return request.rejectedDate;

    // Prefer ISO in request.date if present
    if (request.date) {
        // Try native Date first
        const d1 = new Date(request.date);
        if (!isNaN(d1.getTime())) return d1.getTime();

        // Try dd/mm/yyyy
        const m = String(request.date).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const month = parseInt(m[2], 10) - 1;
            const year = parseInt(m[3], 10);
            const d2 = new Date(year, month, day);
            if (!isNaN(d2.getTime())) return d2.getTime();
        }
    }

    // Fallback: extract yyyymmddHHMMSS from partsRequestID like mech-bus-yyyymmddHHMMSS
    if (request.partsRequestID) {
        const id = String(request.partsRequestID).trim();
        // Extract last 14-digit sequence anywhere in the ID
        const idMatch = id.match(/(\d{14})(?!.*\d)/);
        if (idMatch) {
            const stamp = idMatch[1];
            const y = parseInt(stamp.slice(0, 4), 10);
            const mo = parseInt(stamp.slice(4, 6), 10) - 1;
            const d = parseInt(stamp.slice(6, 8), 10);
            const hh = parseInt(stamp.slice(8, 10), 10);
            const mm = parseInt(stamp.slice(10, 12), 10);
            const ss = parseInt(stamp.slice(12, 14), 10);
            const d3 = new Date(y, mo, d, hh, mm, ss);
            if (!isNaN(d3.getTime())) return d3.getTime();
        }
    }

    return 0; // as last resort
}

function getMechanicName(mechanicId) {
    if (!mechanicId) return '';
    const key = String(mechanicId);
    return mechanicIdToName[key] || key;
}

// Display requested items in the modal
async function displayRequestedItems(request) {
    const requestedItemsContainer = document.getElementById('requested-items-container');
    
    try {
        // Get inventory data for availability check
        const inventorySnapshot = await inventoryRef.once('value');
        const inventory = inventorySnapshot.val();
        
        // Display requested items
        if (request.items) {
            // Build flat items array for modal pagination
            const flat = Object.entries(request.items)
                .filter(([key]) => key !== 'partsRequestID')
                .map(([_, item]) => {
                    const inventoryItem = inventory[item.partId];
                    const availableQty = inventoryItem ? inventoryItem.quantity : 0;
                    const isAvailable = availableQty >= item.quantity;
                    return {
                        manufacturer: item.manufacturer || '',
                        type: item.type || '',
                        quantity: item.quantity || 0,
                        availableQty,
                        isAvailable
                    }
                });

            if (flat.length === 0) {
                requestedItemsContainer.innerHTML = '<p class="no-items">No items requested</p>';
                // Remove pagination if present
                const parent = requestedItemsContainer.parentElement;
                const oldPag = document.getElementById('modal-items-pagination');
                if (oldPag && parent) parent.removeChild(oldPag);
                return;
            }

            // Set pagination state and render first page
            modalItems = flat;
            modalItemsPage = 1;
            renderModalItemsPage();
        } else {
            requestedItemsContainer.innerHTML = '<p class="no-items">No items requested</p>';
        }
    } catch (error) {
        console.error('Error displaying items:', error);
        requestedItemsContainer.innerHTML = '<p class="error-message">Error loading requested items</p>';
    }
}

// Render paginated requested items inside the modal
function renderModalItemsPage() {
    const container = document.getElementById('requested-items-container');
    if (!container) return;

    const totalPages = Math.ceil(modalItems.length / modalItemsPerPage) || 1;
    if (modalItemsPage > totalPages) modalItemsPage = totalPages;
    const start = (modalItemsPage - 1) * modalItemsPerPage;
    const end = Math.min(start + modalItemsPerPage, modalItems.length);
    const slice = modalItems.slice(start, end);

    // Render current page items
    container.innerHTML = '';
    slice.forEach(item => {
        const wrap = document.createElement('div');
        wrap.className = `item-card ${!item.isAvailable ? 'unavailable' : ''}`;
        wrap.innerHTML = `
            <div class="item-header">
                <div class="item-title">
                    <i class="fas fa-cog"></i>
                    <h4>${item.manufacturer} ${item.type}</h4>
                </div>
            </div>
            <div class="item-details">
                <div class="detail-row">
                    <span class="label">Quantity Requested:</span>
                    <span class="value quantity">${item.quantity}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Available:</span>
                    <span class="value ${!item.isAvailable ? 'unavailable' : 'available'}">${item.availableQty}</span>
                </div>
            </div>
        `;
        container.appendChild(wrap);
    });

    // Ensure pagination controls exist under the section
    const section = container.parentElement; // .requested-items-section
    if (!section) return;
    let pagination = document.getElementById('modal-items-pagination');
    if (!pagination) {
        pagination = document.createElement('div');
        pagination.id = 'modal-items-pagination';
        pagination.className = 'pagination-controls';
        section.appendChild(pagination);
    }

    // Render controls (only if more than one page)
    if (totalPages > 1) {
        pagination.innerHTML = `
            <button id="modal-prev-items" class="pagination-button" ${modalItemsPage === 1 ? 'disabled' : ''}>Previous</button>
            <span id="modal-page-info">Page ${modalItemsPage} of ${totalPages}</span>
            <button id="modal-next-items" class="pagination-button" ${modalItemsPage === totalPages ? 'disabled' : ''}>Next</button>
        `;

        // Bind events
        const prevBtn = document.getElementById('modal-prev-items');
        const nextBtn = document.getElementById('modal-next-items');
        if (prevBtn) prevBtn.addEventListener('click', () => {
            if (modalItemsPage > 1) {
                modalItemsPage--;
                renderModalItemsPage();
            }
        });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            if (modalItemsPage < totalPages) {
                modalItemsPage++;
                renderModalItemsPage();
            }
        });
    } else {
        pagination.innerHTML = '';
    }
}

// Check if items in a request are available - Optimized version
async function checkItemsAvailability(request) {
    try {
        // Only check if request has items
        if (!request.items || !Array.isArray(request.items)) {
            return { isAvailable: true, unavailableItems: [] };
        }

        const snapshot = await inventoryRef.once('value');
        const inventory = snapshot.val();
        const unavailableItems = [];
        
        // Check each item
        for (const item of request.items) {
            const inventoryItem = inventory[item.partId];
            if (!inventoryItem || inventoryItem.quantity < item.quantity) {
                unavailableItems.push({
                    partId: item.partId,
                    requested: item.quantity,
                    available: inventoryItem ? inventoryItem.quantity : 0,
                    type: item.type,
                    manufacturer: item.manufacturer
                });
            }
        }
        
        return {
            isAvailable: unavailableItems.length === 0,
            unavailableItems: unavailableItems
        };
    } catch (error) {
        console.error('Error checking item availability:', error);
        return {
            isAvailable: false,
            unavailableItems: []
        };
    }
} 