(function() {
    // Check if user has supervisor access (level 3)
    function checkSupervisorAccess() {
        const user = window.ElavilAuth ? window.ElavilAuth.getCurrentUser() : null;
        if (!user || user.level !== 3) {
            alert('Access denied. Only supervisors can access return requests.');
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    // Initialize Firebase if not already initialized
    if (!firebase.apps || !firebase.apps.length) {
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
        firebase.initializeApp(firebaseConfig);
    }

    // Check supervisor access before proceeding
    if (!checkSupervisorAccess()) {
        return;
    }

    const database = firebase.database();
    const returnRequestsRef = database.ref('ReturnRequests');
    const returnPartsRef = database.ref('ReturnParts');
    
    console.log('Firebase database initialized'); // Debug log
    console.log('ReturnRequests ref:', returnRequestsRef.toString()); // Debug log
    console.log('ReturnParts ref:', returnPartsRef.toString()); // Debug log

    // DOM elements
    const searchInput = document.getElementById('search-return-requests');
    const statusFilter = document.getElementById('status-filter');
    const dateFilter = document.getElementById('date-filter');
    const emptyState = document.getElementById('return-requests-empty-state');
    const tableContainer = document.getElementById('return-requests-table-container');
    const tableBody = document.getElementById('return-requests-table-body');
    const modal = document.getElementById('return-request-modal');
    const closeModal = document.querySelector('.close-modal');
    const acceptBtn = document.getElementById('accept-return-request');
    const rejectBtn = document.getElementById('reject-return-request');
    const actionButtons = document.getElementById('return-action-buttons');

    // Stats elements
    const pendingCount = document.getElementById('pending-count');
    const acceptedCount = document.getElementById('accepted-count');
    const rejectedCount = document.getElementById('rejected-count');

    let currentReturnRequestId = null;
    let allReturnRequests = [];
    let currentPage = 1;
    const itemsPerPage = 5;
    let filteredRequests = [];

    function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            // If timestamp is not a valid date, try to extract date from ID
            const idMatch = timestamp.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
            if (idMatch) {
                const [, year, month, day, hour, minute, second] = idMatch;
                const extractedDate = new Date(year, month - 1, day, hour, minute, second);
                return extractedDate.toLocaleDateString() + ' ' + extractedDate.toLocaleTimeString();
            }
            return 'N/A';
        }
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    function getStatusBadgeClass(status) {
        switch (status) {
            case 'pending': return 'status-pending';
            case 'accepted': return 'status-accepted';
            case 'rejected': return 'status-rejected';
            default: return 'status-unknown';
        }
    }

    function filterReturnRequests(requests, searchText, statusFilter, dateFilter) {
        return requests.filter(request => {
            // Search filter
            if (searchText) {
                const search = searchText.toLowerCase();
                if (!request.id.toLowerCase().includes(search)) {
                    return false;
                }
            }

            // Status filter
            if (statusFilter && statusFilter !== 'all') {
                if (request.status !== statusFilter) {
                    return false;
                }
            }

            // Date filter
            if (dateFilter && dateFilter !== 'all') {
                const now = new Date();
                let requestDate = null;
                
                // Prefer robust parse from ID or ISO
                const ts = parseReturnDate(request);
                if (ts) requestDate = new Date(ts);
                
                // If date parsing failed, skip this filter
                if (!requestDate || isNaN(requestDate.getTime())) {
                    return true; // Don't filter out if we can't parse the date
                }
                
                switch (dateFilter) {
                    case 'today':
                        if (requestDate.toDateString() !== now.toDateString()) {
                            return false;
                        }
                        break;
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        if (requestDate < weekAgo) {
                            return false;
                        }
                        break;
                    case 'month':
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        if (requestDate < monthAgo) {
                            return false;
                        }
                        break;
                }
            }

            return true;
        });
    }

    function updateStats(requests) {
        const stats = {
            pending: 0,
            accepted: 0,
            rejected: 0
        };

        requests.forEach(request => {
            const status = request.status || 'pending';
            if (stats.hasOwnProperty(status)) {
                stats[status]++;
            }
        });

        pendingCount.textContent = stats.pending;
        acceptedCount.textContent = stats.accepted;
        rejectedCount.textContent = stats.rejected;
    }

    function updatePagination() {
        const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
        const paginationInfo = document.getElementById('pagination-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        const safeTotal = totalPages > 0 ? totalPages : 1;
        const safeCurrent = Math.min(Math.max(currentPage, 1), safeTotal);
        paginationInfo.textContent = `Page ${safeCurrent} of ${safeTotal}`;
        prevBtn.disabled = safeCurrent === 1;
        nextBtn.disabled = safeCurrent >= safeTotal;
    }

    function getPaginatedRequests() {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredRequests.slice(startIndex, endIndex);
    }

    function parseReturnDate(request) {
        console.log(`parseReturnDate called for: ${request.id}`);
        
        // PRIORITY: Extract timestamp from request.id first (most accurate)
        if (request && request.id) {
            const id = String(request.id).trim();
            console.log(`  Trying request.id: ${id}`);
            
            // Try to match format: RET-bus-yyyymmddHHMMSS (like RET-5090-20250930223343)
            const formatMatch = id.match(/^RET-(\d+)-(\d{14})$/);
            if (formatMatch) {
                const stamp = formatMatch[2]; // The 14-digit timestamp part
                console.log(`  Found RET format match, timestamp: ${stamp}`);
                const y = parseInt(stamp.slice(0, 4), 10);
                const mo = parseInt(stamp.slice(4, 6), 10) - 1;
                const d = parseInt(stamp.slice(6, 8), 10);
                const hh = parseInt(stamp.slice(8, 10), 10);
                const mm = parseInt(stamp.slice(10, 12), 10);
                const ss = parseInt(stamp.slice(12, 14), 10);
                const d3 = new Date(y, mo, d, hh, mm, ss);
                if (!isNaN(d3.getTime())) {
                    console.log(`  Using request.id (RET format): ${d3.getTime()}, Date: ${d3.toISOString()}`);
                    return d3.getTime();
                }
            }
            
            // Fallback: extract any 14-digit sequence anywhere in the ID
            const idMatch = id.match(/(\d{14})/);
            if (idMatch) {
                const stamp = idMatch[1];
                console.log(`  Found 14-digit match, timestamp: ${stamp}`);
                const y = parseInt(stamp.slice(0, 4), 10);
                const mo = parseInt(stamp.slice(4, 6), 10) - 1;
                const d = parseInt(stamp.slice(6, 8), 10);
                const hh = parseInt(stamp.slice(8, 10), 10);
                const mm = parseInt(stamp.slice(10, 12), 10);
                const ss = parseInt(stamp.slice(12, 14), 10);
                const d3 = new Date(y, mo, d, hh, mm, ss);
                if (!isNaN(d3.getTime())) {
                    console.log(`  Using request.id (14-digit match): ${d3.getTime()}, Date: ${d3.toISOString()}`);
                    return d3.getTime();
                }
            }
        }
        
        // Fallback: Use request.date if request.id parsing failed
        if (request && request.date) {
            console.log(`  Trying request.date: ${request.date}`);
            const d1 = new Date(request.date);
            if (!isNaN(d1.getTime())) {
                console.log(`  Using request.date (native): ${d1.getTime()}`);
                return d1.getTime();
            }
            // Try dd/mm/yyyy
            const m = String(request.date).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (m) {
                const day = parseInt(m[1], 10);
                const month = parseInt(m[2], 10) - 1;
                const year = parseInt(m[3], 10);
                const d2 = new Date(year, month, day);
                if (!isNaN(d2.getTime())) {
                    console.log(`  Using request.date (dd/mm/yyyy): ${d2.getTime()}`);
                    return d2.getTime();
                }
            }
        }
        
        console.log(`  No date found, returning 0`);
        return 0;
    }

    function renderReturnRequests(requests) {
        filteredRequests = filterReturnRequests(
            requests, 
            searchInput.value, 
            statusFilter.value, 
            dateFilter.value
        );

        // Sort by parsed date (newest first) with stable fallback by id
        console.log('Before sorting return requests:');
        filteredRequests.slice(0, 3).forEach((req, i) => {
            const parsedDate = parseReturnDate(req);
            console.log(`${i}: ID=${req.id}, ParsedDate=${parsedDate}, Date=${new Date(parsedDate).toISOString()}`);
        });
        
        filteredRequests.sort((a, b) => {
            const tb = parseReturnDate(b);
            const ta = parseReturnDate(a);
            if (tb !== ta) return tb - ta;
            return String(b.id).localeCompare(String(a.id));
        });
        
        console.log('After sorting return requests:');
        filteredRequests.slice(0, 3).forEach((req, i) => {
            const parsedDate = parseReturnDate(req);
            console.log(`${i}: ID=${req.id}, ParsedDate=${parsedDate}, Date=${new Date(parsedDate).toISOString()}`);
        });

        // Clamp current page within valid bounds
        const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
        if (totalPages === 0) {
            currentPage = 1;
        } else if (currentPage > totalPages) {
            currentPage = totalPages;
        } else if (currentPage < 1) {
            currentPage = 1;
        }

        const paginatedRequests = getPaginatedRequests();
        const tableBody = document.getElementById('return-requests-table-body');
        const tableContainer = document.getElementById('return-requests-table-container');
        const emptyState = document.getElementById('return-requests-empty-state');

        updateStats(requests);
        tableBody.innerHTML = '';

        if (filteredRequests.length === 0) {
            emptyState.style.display = 'flex';
            tableContainer.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        tableContainer.style.display = 'block';

        paginatedRequests.forEach((request, index) => {
            const tr = document.createElement('tr');
            
            // Get original status for display (with proper capitalization)
            const originalStatus = request.originalStatus || request.status || 'pending';
            const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
            const ts = parseReturnDate(request);
            const dateOut = ts ? new Date(ts).toLocaleString() : escapeHtml(request.displayDate || 'N/A');
            
            tr.innerHTML = `
                <td>${globalIndex}</td>
                <td>${dateOut}</td>
                <td>${escapeHtml(request.busId || 'N/A')}</td>
                <td>${escapeHtml(request.requestedBy || 'N/A')}</td>
                <td><span class="status-badge ${getStatusBadgeClass(request.status)}">${escapeHtml(originalStatus)}</span></td>
                <td>${request.itemsCount || 0}</td>
                <td>
                    <button class="action-btn view-btn" data-action="view" data-id="${request.id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        updatePagination();
    }

    function escapeHtml(str) {
        if (!str) return '';
        // Convert to string first in case it's a number or other type
        str = String(str);
        return str.replace(/[&<>"]/g, function(s) {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
            return map[s] || s;
        });
    }

    function showReturnRequestDetails(requestId) {
        console.log('=== showReturnRequestDetails called with ID:', requestId, '==='); // Debug log
        currentReturnRequestId = requestId;
        
        // Check if modal exists
        if (!modal) {
            console.error('Modal element not found!');
            alert('Modal element not found!');
            return;
        }
        
        console.log('Modal element found:', modal); // Debug log
        
        // Get return request details
        returnRequestsRef.child(requestId).once('value', (snapshot) => {
            if (!snapshot.exists()) {
                alert('Return request not found');
                return;
            }

            const request = snapshot.val();
            
            console.log('Request data:', request); // Debug log
            console.log('Request status:', request.status); // Debug log
            
            // Modal now only shows items, no need to populate other fields

            // Show/hide action buttons based on status
            const statusForButtons = (request.status || '').toLowerCase();
            console.log('Status for buttons (lowercase):', statusForButtons); // Debug log
            
            if (statusForButtons === 'pending') {
                console.log('Showing action buttons'); // Debug log
                actionButtons.style.display = 'flex';
            } else {
                console.log('Hiding action buttons'); // Debug log
                actionButtons.style.display = 'none';
            }

            // Get return parts for this request
            console.log('Attempting to load parts for request ID:', requestId); // Debug log
            
            // Test the specific path
            const specificPath = returnPartsRef.child(requestId);
            console.log('Specific path:', specificPath.toString()); // Debug log
            
            // Also test if the path exists at all
            returnPartsRef.once('value', (allPartsSnapshot) => {
                console.log('All ReturnParts data:', allPartsSnapshot.val()); // Debug log
                if (allPartsSnapshot.exists()) {
                    const allParts = allPartsSnapshot.val();
                    console.log('Available request IDs in ReturnParts:', Object.keys(allParts)); // Debug log
                }
            });
            
            // Load parts for this specific request ID - using the same logic as the working test
            console.log('=== LOADING PARTS FOR REQUEST:', requestId, '===');
            
            returnPartsRef.child(requestId).once('value', (snapshot) => {
                const itemsContainer = document.getElementById('returned-items-container');
                const noteContainer = document.getElementById('request-note');
                itemsContainer.innerHTML = '';

                // Find the request data to get the note
                const requestData = allReturnRequests.find(req => req.id === requestId);
                if (requestData && requestData.note) {
                    noteContainer.innerHTML = `<strong>Note:</strong> ${escapeHtml(requestData.note)}`;
                } else {
                    noteContainer.innerHTML = '<strong>Note:</strong> No note provided';
                }

                console.log('Parts snapshot exists:', snapshot.exists());
                
                if (!snapshot.exists()) {
                    console.log('No parts found for request:', requestId);
                    itemsContainer.innerHTML = '<div class="no-items-message"><i class="fas fa-box-open"></i><p>No items found for this return request.</p></div>';
                    modal.style.display = 'block'; // Show modal even if no parts
                    return;
                }

                const data = snapshot.val();
                console.log('Raw parts data:', data);
                
                // Get all part IDs under this request
                const keys = Object.keys(data);
                console.log('Part keys found:', keys);
                
                // Process each part - using the exact same logic as the working test
                keys.forEach(key => {
                    const part = data[key];
                    console.log('Processing part:', key, part);
                    
                    // Create item card for this part - using the exact same HTML as the working test
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'item-card';
                    itemDiv.innerHTML = `
                        <div class="item-info">
                            <span class="item-type">${escapeHtml(part.type || 'Unknown Type')}</span>
                            <span class="item-manufacturer">${escapeHtml(part.manufacturer || 'N/A')}</span>
                            <span class="item-quantity">Qty: ${escapeHtml(part.quantity || 0)}</span>
                        </div>
                    `;
                    itemsContainer.appendChild(itemDiv);
                });
                
                console.log('Successfully rendered', keys.length, 'items');
                console.log('About to show modal...'); // Debug log
                modal.style.display = 'block'; // Show modal after parts are loaded
                console.log('Modal display set to block'); // Debug log
            }).catch((error) => {
                console.error('Error loading parts:', error);
                const itemsContainer = document.getElementById('returned-items-container');
                itemsContainer.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i><p>Error loading items. Please try again.</p></div>';
                console.log('About to show modal (error case)...'); // Debug log
                modal.style.display = 'block'; // Show modal even if error
                console.log('Modal display set to block (error case)'); // Debug log
            });
        });
    }

    function updateReturnRequestStatus(status) {
        if (!currentReturnRequestId) return;

        const updates = {
            status: status,
            processedDate: Date.now(),
            processedBy: window.ElavilAuth.getCurrentUser().username
        };

        returnRequestsRef.child(currentReturnRequestId).update(updates, (error) => {
            if (error) {
                alert('Failed to update return request status');
            } else {
                alert(`Return request ${status} successfully`);
                modal.style.display = 'none';
                // Refresh the list
                loadReturnRequests();
            }
        });
    }

    // Accept logic: deduct from bus PartsIn and add RET item into InventoryData
    async function handleAcceptReturnRequest() {
        const requestId = currentReturnRequestId;
        if (!requestId) throw new Error('No return request selected');

        // Load request and parts
        const reqSnap = await returnRequestsRef.child(requestId).once('value');
        if (!reqSnap.exists()) throw new Error('Return request not found');
        const request = reqSnap.val();
        const busId = String(request.busId || '').trim();
        if (!busId) throw new Error('Missing busId in return request');

        const partsSnap = await returnPartsRef.child(requestId).once('value');
        if (!partsSnap.exists()) throw new Error('No parts to accept');
        const partsMap = partsSnap.val();

        // For each part: upsert InventoryData/{partId}-RET (add quantity if exists)
        await Promise.all(Object.keys(partsMap).map(async partId => {
            const part = partsMap[partId] || {};
            const addQty = Number(part.quantity || 0);
            const manufacturer = part.manufacturer || '';
            const type = part.type || '';
            const brand = part.brand || part.manufacturer || '';
            const unit = part.quantityUnit || part.unit || '';
            const desc = part.description || '';

            const retRef = database.ref(`InventoryData/${partId}-RET`);

            // Ensure metadata fields are set/updated (non-destructive) and increase quantity atomically
            // 1) Transaction on quantity
            await retRef.child('quantity').transaction(current => {
                const curr = Number(current || 0);
                return curr + addQty;
            });

            // 2) Update other fields (do not override existing non-empty fields unnecessarily)
            const metaSnap = await retRef.once('value');
            const existing = metaSnap.val() || {};
            const payload = {
                brand: existing.brand || brand,
                manufacturer: existing.manufacturer || manufacturer,
                type: existing.type || type,
                quantityUnit: existing.quantityUnit || unit,
                description: existing.description || desc,
                supplierName: existing.supplierName || (request.requestedBy || ''),
                supplierNumber: existing.supplierNumber || (request.requesterContact || ''),
                lastUpdated: Date.now()
            };
            if (!existing.createdAt) payload.createdAt = Date.now();
            await retRef.update(payload);
        }));

        // Deduct quantities from the bus using transactions to avoid race conditions
        await Promise.all(Object.keys(partsMap).map(async partId => {
            const qty = Number(partsMap[partId].quantity || 0);
            const qtyRef = database.ref(`Buses/${request.busId}/PartsIn/${partId}/quantity`);
            await qtyRef.transaction(current => {
                const curr = Number(current || 0);
                const next = curr - qty;
                return next < 0 ? 0 : next;
            });
        }));

        // Finally, mark request accepted
        await returnRequestsRef.child(requestId).update({ status: 'accepted', processedDate: Date.now() });

        alert('Return accepted and inventory updated');
        modal.style.display = 'none';
    }

    function loadReturnRequests() {
        returnRequestsRef.once('value', (snapshot) => {
            const requests = [];
            snapshot.forEach((child) => {
                const request = child.val();
                request.id = child.key;
                request.itemsCount = 0;
                
                // Use the actual date field from the database
                request.displayDate = request.date || 'N/A';
                request.originalStatus = request.status || 'Pending'; // Keep original for display
                request.status = (request.status || 'pending').toLowerCase(); // Convert to lowercase for consistency
                request.requestedBy = request.requestedBy || 'Unknown';
                request.note = request.note || '';
                request.busId = request.busId || '';
                
                requests.push(request);
            });

            console.log('Found return requests:', requests.length); // Debug log
            console.log('Sample request:', requests[0]); // Debug log

            // If no requests found, show empty state
            if (requests.length === 0) {
                allReturnRequests = [];
                renderReturnRequests([]);
                return;
            }

            // Get items count for each request
            const promises = requests.map(request => {
                return returnPartsRef.child(request.id).once('value').then(partsSnapshot => {
                    if (partsSnapshot.exists()) {
                        const partsData = partsSnapshot.val();
                        // Count the number of part IDs (keys) under the request
                        request.itemsCount = Object.keys(partsData).length;
                        console.log(`Request ${request.id} has ${request.itemsCount} items`); // Debug log
                    } else {
                        request.itemsCount = 0;
                        console.log(`No parts found for request ${request.id}`); // Debug log
                    }
                });
            });

            Promise.all(promises).then(() => {
                // Sort newest first before saving/displaying
                requests.sort((a, b) => parseReturnDate(b) - parseReturnDate(a));
                allReturnRequests = requests;
                console.log('Loaded return requests with items:', requests); // Debug log
                renderReturnRequests(requests);
            });
        }).catch((error) => {
            console.error('Error loading return requests:', error);
            allReturnRequests = [];
            renderReturnRequests([]);
        });
    }

    // Event listeners
    searchInput.addEventListener('input', () => {
        currentPage = 1; // Reset to first page when filtering
        renderReturnRequests(allReturnRequests);
    });

    statusFilter.addEventListener('change', () => {
        currentPage = 1; // Reset to first page when filtering
        renderReturnRequests(allReturnRequests);
    });

    dateFilter.addEventListener('change', () => {
        currentPage = 1; // Reset to first page when filtering
        renderReturnRequests(allReturnRequests);
    });

    // Pagination event listeners
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            // Re-render using current filters but do NOT reset the currentPage inside renderer
            renderReturnRequests(allReturnRequests);
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderReturnRequests(allReturnRequests);
        }
    });

    tableBody.addEventListener('click', (e) => {
        console.log('Table body clicked:', e.target); // Debug log
        const btn = e.target.closest('button[data-action]');
        console.log('Button found:', btn); // Debug log
        
        if (!btn) {
            console.log('No button found, returning'); // Debug log
            return;
        }
        
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        console.log('Action:', action, 'ID:', id); // Debug log

        if (action === 'view') {
            console.log('Calling showReturnRequestDetails with ID:', id); // Debug log
            showReturnRequestDetails(id);
        }
    });

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    acceptBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to accept this return request?')) {
            handleAcceptReturnRequest().catch(err => {
                console.error('Accept processing failed:', err);
                alert('Failed to process acceptance. Please try again.');
            });
        }
    });

    rejectBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reject this return request?')) {
            updateReturnRequestStatus('rejected');
        }
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });


    // Test database connection first
    function testDatabaseConnection() {
        console.log('Testing database connection...');
        
        // Test ReturnRequests
        returnRequestsRef.limitToFirst(1).once('value', (snapshot) => {
            console.log('ReturnRequests test - snapshot exists:', snapshot.exists());
            if (snapshot.exists()) {
                console.log('ReturnRequests test - sample data:', snapshot.val());
            }
        }).catch((error) => {
            console.error('ReturnRequests test error:', error);
        });
        
        // Test ReturnParts
        returnPartsRef.limitToFirst(1).once('value', (snapshot) => {
            console.log('ReturnParts test - snapshot exists:', snapshot.exists());
            if (snapshot.exists()) {
                console.log('ReturnParts test - sample data:', snapshot.val());
            }
        }).catch((error) => {
            console.error('ReturnParts test error:', error);
        });
    }

    // Test function to directly test the specific request
    function testSpecificRequestDirect() {
        const testRequestId = 'RET-2024-20250927195416';
        console.log('=== DIRECT TEST FOR REQUEST:', testRequestId, '===');
        
        returnPartsRef.child(testRequestId).once('value', (snapshot) => {
            console.log('Direct test - snapshot exists:', snapshot.exists());
            if (snapshot.exists()) {
                const data = snapshot.val();
                console.log('Direct test - raw data:', data);
                
                const parts = Object.keys(data);
                console.log('Direct test - part IDs:', parts);
                
                let itemsList = [];
                parts.forEach(partId => {
                    const partData = data[partId];
                    console.log('Direct test - processing part:', partId, partData);
                    
                    if (partData && typeof partData === 'object' && partData.type) {
                        itemsList.push({
                            id: partId,
                            type: partData.type || 'Unknown Type',
                            partId: partData.partId || partId,
                            manufacturer: partData.manufacturer || 'N/A',
                            quantity: partData.quantity || 0
                        });
                    }
                });
                
                console.log('Direct test - final items list:', itemsList);
            } else {
                console.log('Direct test - no data found for request:', testRequestId);
            }
        }).catch((error) => {
            console.error('Direct test - error:', error);
        });
    }

    function setupRealtimeListeners() {
        console.log('Setting up real-time listeners...');
        
        // Listen for changes to ReturnRequests
        returnRequestsRef.on('value', (snapshot) => {
            console.log('ReturnRequests data changed');
            if (snapshot.exists()) {
                const requests = [];
                snapshot.forEach((child) => {
                    const request = child.val();
                    request.id = child.key;
                    
                    // Process the request data
                    request.status = (request.status || 'pending').toLowerCase();
                    request.originalStatus = request.status;
                    request.displayDate = request.date || 'N/A';
                    
                    requests.push(request);
                });
                // Sort newest first continuously (with id fallback)
                requests.sort((a, b) => {
                    const tb = parseReturnDate(b);
                    const ta = parseReturnDate(a);
                    if (tb !== ta) return tb - ta;
                    return String(b.id).localeCompare(String(a.id));
                });
                allReturnRequests = requests;
                renderReturnRequests(requests);
            } else {
                allReturnRequests = [];
                renderReturnRequests([]);
            }
        }, (error) => {
            console.error('Error listening to ReturnRequests:', error);
        });

        // Listen for changes to ReturnParts to update item counts
        returnPartsRef.on('value', (snapshot) => {
            console.log('ReturnParts data changed');
            if (snapshot.exists()) {
                // Update item counts for all requests
                allReturnRequests.forEach(request => {
                    const requestParts = snapshot.child(request.id);
                    if (requestParts.exists()) {
                        request.itemsCount = Object.keys(requestParts.val()).length;
                    } else {
                        request.itemsCount = 0;
                    }
                });
                // Ensure newest first before rendering
                allReturnRequests.sort((a, b) => {
                    const tb = parseReturnDate(b);
                    const ta = parseReturnDate(a);
                    if (tb !== ta) return tb - ta;
                    return String(b.id).localeCompare(String(a.id));
                });
                // Re-render with updated counts
                renderReturnRequests(allReturnRequests);
            }
        }, (error) => {
            console.error('Error listening to ReturnParts:', error);
        });

        // Ensure new requests appear at the top immediately
        returnRequestsRef.on('child_added', (snapshot) => {
            const req = snapshot.val() || {};
            req.id = snapshot.key;
            req.status = (req.status || 'pending').toLowerCase();
            req.originalStatus = req.status;
            req.displayDate = req.date || 'N/A';
            const exists = allReturnRequests.some(r => r.id === req.id);
            if (!exists) {
                allReturnRequests.push(req);
                allReturnRequests.sort((a, b) => {
                    const diff = parseReturnDate(b) - parseReturnDate(a);
                    if (diff !== 0) return diff;
                    return String(b.id).localeCompare(String(a.id));
                });
                // Keep current page; renderer will clamp within bounds
                renderReturnRequests(allReturnRequests);
            }
        });
    }

    // Set up real-time listeners
    setupRealtimeListeners();
})();
