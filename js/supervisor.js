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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Reference to database
const database = firebase.database();
const inventoryRef = database.ref('InventoryData');

// DOM Elements
const inventoryList = document.getElementById('inventory-list');
const searchInput = document.getElementById('search-items');
const typeFilter = document.getElementById('type-filter');
const statusFilterEl = document.getElementById('status-filter');
const sortFilterEl = document.getElementById('sort-filter');
const underRepairEl = document.getElementById('under-repair').querySelector('.summary-value');
const readyToUseEl = document.getElementById('ready-to-use').querySelector('.summary-value');
const lowStockEl = document.getElementById('low-stock').querySelector('.summary-value');
const noStockEl = document.getElementById('no-stock').querySelector('.summary-value');
const underRepairRetrEl = document.getElementById('under-repair-retr').querySelector('.summary-value');
const repairedRetfEl = document.getElementById('repaired-retf').querySelector('.summary-value');
const disposedRetdEl = document.getElementById('disposed-retd').querySelector('.summary-value');
const sidebarItems = document.querySelectorAll('.sidebar-menu li');

// Pagination variables
let currentPage = 1;
const itemsPerPage = 5;
let filteredItems = [];
let currentTab = 'brand-new';

// Inventory data storage
let inventoryData = {};
let uniqueTypes = new Set();

// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', function() {
    // Render skeleton rows while loading
    renderSkeletonRows(inventoryList, 10, 5);
    // Initialize inventory data from Firebase
    loadInventoryData();
    
    // Event listeners for search and filter
    searchInput.addEventListener('input', function() {
        currentPage = 1; // Reset to first page on search
        filterInventory();
    });
    
    typeFilter.addEventListener('change', function() {
        currentPage = 1; // Reset to first page on filter change
        filterInventory();
    });
    if (statusFilterEl) {
        statusFilterEl.addEventListener('change', function() {
            currentPage = 1;
            filterInventory();
        });
    }
    if (sortFilterEl) {
        sortFilterEl.addEventListener('change', function() {
            currentPage = 1;
            filterInventory();
        });
    }
    
    // Add event listeners to sidebar menu items
    sidebarItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // For links with actual href, don't prevent default
            const link = this.querySelector('a');
            const href = link.getAttribute('href');
            
            // Only prevent default for placeholder links
            if (href === '#') {
                e.preventDefault();
                
                // Remove active class from all items
                sidebarItems.forEach(i => i.classList.remove('active'));
                // Add active class to clicked item
                this.classList.add('active');
                
                // Get the menu item text
                const menuText = this.querySelector('span').textContent;
                
                // Here you would typically load different content based on the menu item
                // For now, we'll just show an alert
                if (menuText !== 'Inventory') {
                    alert(`${menuText} functionality will be implemented in the future.`);
                }
            }
        });
    });
    
    // Create and add pagination controls
    createPaginationControls();
    
    // Add double-click event to table headers to maximize minimized columns
    const table = document.getElementById('inventory-table');
    if (table) {
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            headerRow.addEventListener('dblclick', function(e) {
                const th = e.target.closest('th');
                if (th && th.cellIndex !== null) {
                    const columnIndex = th.cellIndex + 1; // Convert to 1-based index
                    // Check if column is minimized
                    if (table.classList.contains(`col-${columnIndex}-minimized`)) {
                        toggleColumn(columnIndex);
                    }
                }
            });
        }
    }

    // Wire Add Inventory FAB and modal
    const fab = document.getElementById('add-inventory-fab');
    const modal = document.getElementById('add-inventory-modal');
    const closeBtn = document.getElementById('close-add-inventory');
    const cancelBtn = document.getElementById('cancel-add-inventory');
    const form = document.getElementById('add-inventory-form');

    if (fab && modal && closeBtn && cancelBtn && form) {
        const openModal = () => { modal.style.display = 'flex'; };
        const closeModal = () => { modal.style.display = 'none'; form.reset(); };
        fab.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        // Enforce numeric input and 11-digit format starting with 09 in real-time
        const supplierNumberInput = document.getElementById('inv-supplier-number');
        if (supplierNumberInput) {
            supplierNumberInput.addEventListener('input', () => {
                const digitsOnly = supplierNumberInput.value.replace(/[^0-9]/g, '');
                supplierNumberInput.value = digitsOnly.slice(0, 11);
            });
            supplierNumberInput.addEventListener('blur', () => {
                const v = supplierNumberInput.value.trim();
                if (v && !/^09\d{9}$/.test(v)) {
                    supplierNumberInput.setCustomValidity('Must start with 09 and be 11 digits');
                } else {
                    supplierNumberInput.setCustomValidity('');
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Collect values
            const brand = document.getElementById('inv-brand').value.trim();
            const manufacturer = document.getElementById('inv-manufacturer').value.trim();
            const type = document.getElementById('inv-type').value.trim();
            const quantityStr = document.getElementById('inv-quantity').value.trim();
            const restockStr = (document.getElementById('inv-restock') && document.getElementById('inv-restock').value.trim()) || '';
            const unit = document.getElementById('inv-unit').value;
            const size = document.getElementById('inv-size').value.trim();
            const description = document.getElementById('inv-description').value.trim();
            const supplierName = document.getElementById('inv-supplier-name').value.trim();
            const supplierNumber = (document.getElementById('inv-supplier-number').value || '').replace(/[^0-9]/g, '').slice(0, 11);

            // Validate
            const qty = Number(quantityStr);
            const limitL = Number(restockStr);
            if (!Number.isInteger(qty) || qty <= 0) { alert('Quantity must be a whole number greater than 0.'); return; }
            if (!Number.isInteger(limitL) || limitL <= 0) { alert('ReStock No. must be a whole number greater than 0.'); return; }
            if (!/^09\d{9}$/.test(supplierNumber)) { alert('Supplier Number must start with 09 and be 11 digits.'); return; }
            if (!unit) { alert('Please select a quantity unit.'); return; }

            // Get current user information
            const userSession = sessionStorage.getItem('elavil_user');
            let addedBy = 'Unknown User';
            let addedByRole = 'Unknown Role';
            
            if (userSession) {
                try {
                    const user = JSON.parse(userSession);
                    addedBy = user.fullName || 'Unknown User';
                    // Map level to role
                    if (user.level === 3) {
                        addedByRole = 'Supervisor';
                    } else if (user.level === 4) {
                        addedByRole = 'Administrator';
                    } else {
                        addedByRole = user.employeeType || 'Unknown Role';
                    }
                } catch (e) {
                    console.error('Error parsing user session:', e);
                }
            }

            // Generate an ID: yyyymmddHHMMSS + normalized name
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const keyName = `${manufacturer}-${type}`.toLowerCase().replace(/\s+/g, '');
            const newId = `${Date.now()}${keyName}`;

            const payload = {
                brand,
                manufacturer,
                type,
                quantity: qty,
                limitL,
                quantityUnit: unit,
                size,
                description,
                supplierName,
                supplierNumber,
                addedBy,
                addedByRole,
                createdAt: Date.now(),
                lastUpdated: Date.now()
            };

            try {
                await inventoryRef.child(newId).set(payload);
                
                // Save activity record to activities database
                const activitiesRef = database.ref('activities');
                const activityDescription = `Added ${qty} ${brand} ${type} to inventory`;
                
                // Generate activity ID using inventory ID + counter
                const activityId = await generateActivityId(activitiesRef, newId);
                
                const activityRecord = {
                    time: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
                    actType: 'Inventory',
                    description: activityDescription,
                    user: addedBy,
                    role: addedByRole
                };
                
                await activitiesRef.child(activityId).set(activityRecord);
                
                // Do not mutate local cache; rely on realtime listener to update UI consistently
                alert('Inventory item added.');
                closeModal();
            } catch (err) {
                console.error('Failed to add inventory:', err);
                alert('Failed to add inventory item.');
            }
        });
    }

    // Wire Adjust Quantity modal handlers
    const adjModal = document.getElementById('adjust-qty-modal');
    const adjClose = document.getElementById('close-adjust-qty');
    const adjCancel = document.getElementById('cancel-adjust-qty');
    const adjForm = document.getElementById('adjust-qty-form');
    const adjInput = document.getElementById('adjust-qty-input');
    const adjNote = document.getElementById('adjust-qty-note');

    window._adjustTargetId = null;
    function closeAdj() { if (adjModal) { adjModal.style.display = 'none'; } window._adjustTargetId = null; if (adjForm) adjForm.reset(); }
    if (adjModal && adjClose && adjCancel && adjForm && adjInput) {
        adjClose.addEventListener('click', closeAdj);
        adjCancel.addEventListener('click', closeAdj);
        window.addEventListener('click', (e) => { if (e.target === adjModal) closeAdj(); });
        adjForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const addStr = adjInput.value.trim();
            const addQty = Number(addStr);
            if (!Number.isInteger(addQty) || addQty <= 0) { alert('Enter a whole number greater than 0.'); return; }
            const id = window._adjustTargetId;
            if (!id) return;
            try {
                await inventoryRef.child(id).child('quantity').transaction(current => {
                    const curr = Number(current || 0);
                    return curr + addQty;
                });
                
                // Save activity record for quantity adjustment
                const activitiesRef = database.ref('activities');
                
                // Get current user info
                const userSession = sessionStorage.getItem('elavil_user');
                let adjustedBy = 'Unknown User';
                let adjustedByRole = 'Unknown Role';
                
                if (userSession) {
                    try {
                        const user = JSON.parse(userSession);
                        adjustedBy = user.fullName || 'Unknown User';
                        if (user.level === 3) {
                            adjustedByRole = 'Supervisor';
                        } else if (user.level === 4) {
                            adjustedByRole = 'Administrator';
                        } else {
                            adjustedByRole = user.employeeType || 'Unknown Role';
                        }
                    } catch (e) {
                        console.error('Error parsing user session:', e);
                    }
                }
                
                // Get item details for description
                const itemSnapshot = await inventoryRef.child(id).once('value');
                const item = itemSnapshot.val();
                
                const activityDescription = `Added ${addQty} ${item.brand} ${item.type}`;
                
                // Generate activity ID using inventory ID + counter
                const activityId = await generateActivityId(activitiesRef, id);
                
                const activityRecord = {
                    time: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
                    actType: 'Inventory',
                    description: activityDescription,
                    user: adjustedBy,
                    role: adjustedByRole
                };
                
                await activitiesRef.child(activityId).set(activityRecord);
                
                // Let realtime child_changed update the UI and summary to avoid double renders
                closeAdj();
            } catch (err) {
                console.error('Adjust quantity failed:', err);
                alert('Failed to adjust quantity.');
            }
        });
    }

    // Wire Transaction History modal handlers
    const historyModal = document.getElementById('transaction-history-modal');
    const historyClose = document.getElementById('close-transaction-history');
    
    if (historyModal && historyClose) {
        historyClose.addEventListener('click', closeTransactionHistory);
        window.addEventListener('click', (e) => {
            if (e.target === historyModal) closeTransactionHistory();
        });
    }

    // Wire Mark as Repaired modal handlers
    const markRepairedModal = document.getElementById('mark-repaired-modal');
    const markRepairedClose = document.getElementById('close-mark-repaired');
    const markRepairedCancel = document.getElementById('cancel-mark-repaired');
    const markRepairedForm = document.getElementById('mark-repaired-form');
    const markRepairedInput = document.getElementById('repaired-qty-input');
    const markRepairedNote = document.getElementById('mark-repaired-note');

    window._markRepairedTargetId = null;
    function closeMarkRepaired() { 
        if (markRepairedModal) { markRepairedModal.style.display = 'none'; } 
        window._markRepairedTargetId = null; 
        if (markRepairedForm) markRepairedForm.reset(); 
    }
    
    if (markRepairedModal && markRepairedClose && markRepairedCancel && markRepairedForm && markRepairedInput) {
        markRepairedClose.addEventListener('click', closeMarkRepaired);
        markRepairedCancel.addEventListener('click', closeMarkRepaired);
        window.addEventListener('click', (e) => { if (e.target === markRepairedModal) closeMarkRepaired(); });
        
        markRepairedForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const qtyStr = markRepairedInput.value.trim();
            const qty = Number(qtyStr);
            if (!Number.isInteger(qty) || qty <= 0) { 
                alert('Enter a whole number greater than 0.'); 
                return; 
            }
            
            const id = window._markRepairedTargetId;
            if (!id) return;
            
            try {
                // Get the item to check quantity
                const itemSnapshot = await inventoryRef.child(id).once('value');
                const item = itemSnapshot.val();
                const currentQty = Number(item.quantity || 0);
                
                if (qty > currentQty) {
                    alert(`Cannot mark more items as repaired than available (${currentQty}).`);
                    return;
                }
                
                // If partial quantity, create new RETF item and reduce RETR item
                if (qty < currentQty) {
                    // Reduce RETR quantity
                    await inventoryRef.child(id).child('quantity').transaction(current => {
                        const curr = Number(current || 0);
                        return curr - qty;
                    });
                    
                    // Get base item ID
                    const baseId = id.replace(/-(RETR)(?:-\d+)?$/i, '');
                    
                    // Create RETF item
                    const retfId = `${baseId}-RETF`;
                    const retfRef = inventoryRef.child(retfId);
                    const retfSnap = await retfRef.once('value');
                    
                    if (retfSnap.exists()) {
                        // Add to existing RETF item
                        await retfRef.child('quantity').transaction(current => {
                            const curr = Number(current || 0);
                            return curr + qty;
                        });
                    } else {
                        // Create new RETF item
                        const retfData = {
                            ...item,
                            quantity: qty,
                            lastUpdated: Date.now()
                        };
                        await retfRef.set(retfData);
                    }
                } else {
                    // Mark all as repaired - transition entire item
                    await transitionItemStatus(id, 'RETF');
                }
                
                // Get current user info for activity
                const userSession = sessionStorage.getItem('elavil_user');
                let repairedBy = 'Unknown User';
                let repairedByRole = 'Unknown Role';
                
                if (userSession) {
                    try {
                        const user = JSON.parse(userSession);
                        repairedBy = user.fullName || 'Unknown User';
                        if (user.level === 3) {
                            repairedByRole = 'Supervisor';
                        } else if (user.level === 4) {
                            repairedByRole = 'Administrator';
                        } else {
                            repairedByRole = user.employeeType || 'Unknown Role';
                        }
                    } catch (e) {
                        console.error('Error parsing user session:', e);
                    }
                }
                
                // Record activity
                const activitiesRef = database.ref('activities');
                const activityDescription = `Marked ${qty} ${item.brand} ${item.type} as repaired`;
                
                // Generate activity ID
                const targetId = qty < currentQty ? `${id.replace(/-(RETR)(?:-\d+)?$/i, '')}-RETF` : id;
                const activityId = await generateActivityId(activitiesRef, targetId);
                
                const activityRecord = {
                    time: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
                    actType: 'Inventory',
                    description: activityDescription,
                    user: repairedBy,
                    role: repairedByRole
                };
                
                await activitiesRef.child(activityId).set(activityRecord);
                
                alert('Items marked as repaired successfully!');
                closeMarkRepaired();
            } catch (err) {
                console.error('Mark as repaired failed:', err);
                alert('Failed to mark as repaired.');
            }
        });
    }
});

function openAdjustQtyModal(itemId, item) {
    const adjModal = document.getElementById('adjust-qty-modal');
    const adjNote = document.getElementById('adjust-qty-note');
    if (!adjModal) return;
    window._adjustTargetId = itemId;
    if (adjNote) {
        adjNote.textContent = `Adding quantity to ${item.brand || ''} ${item.type || ''} (${item.manufacturer || ''})`;
    }
    adjModal.style.display = 'flex';
}

function openMarkRepairedModal(itemId, item) {
    const modal = document.getElementById('mark-repaired-modal');
    const note = document.getElementById('mark-repaired-note');
    if (!modal) return;
    window._markRepairedTargetId = itemId;
    if (note) {
        note.textContent = `Marking as repaired: ${item.brand || ''} ${item.type || ''} (${item.manufacturer || ''})`;
    }
    modal.style.display = 'flex';
}

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
            }
        });
        
        // Create next button
        const nextButton = document.createElement('button');
        nextButton.id = 'next-page';
        nextButton.className = 'pagination-btn';
        nextButton.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
        nextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderCurrentPage();
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
        const inventoryDisplay = document.getElementById('inventory-display');
        if (inventoryDisplay) {
            inventoryDisplay.appendChild(paginationContainer);
        }
    }
}

// Load inventory data from Firebase
function loadInventoryData() {
    // Initial load of all data
    inventoryRef.once('value', (snapshot) => {
        console.log('Raw Firebase data:', snapshot.val());
        
        if (!snapshot.exists()) {
            console.log('No data available in Firebase');
            inventoryList.innerHTML = '<tr><td colspan="4">No inventory items found</td></tr>';
            return;
        }
        
        inventoryData = snapshot.val() || {};
        uniqueTypes = new Set();
        
        // Extract unique types for the filter
        Object.values(inventoryData).forEach(item => {
            if (item.type) {
                uniqueTypes.add(item.type);
            }
        });
        
        // Initial render
        updateTypeFilter();
        filterInventory();
        updateSummary();
        
        // Log data for debugging
        console.log('Loaded inventory data:', inventoryData);
    });

    // Listen for changes to specific items
    inventoryRef.on('child_changed', (snapshot) => {
        const itemId = snapshot.key;
        const updatedItem = snapshot.val();
        
        // Update our local data
        inventoryData[itemId] = updatedItem;
        
        // Update the specific row if it's currently displayed
        updateItemRow(itemId, updatedItem);
        
        // Update summary without full re-render
        updateSummary();
    });

    // Listen for renames (simulate via child_removed + child_added)
    inventoryRef.on('child_removed', (snapshot) => {
        const removedId = snapshot.key;
        if (inventoryData[removedId]) {
            delete inventoryData[removedId];
            // Rebuild unique types from remaining data
            uniqueTypes = new Set();
            Object.values(inventoryData).forEach(it => { if (it && it.type) uniqueTypes.add(it.type); });
            updateTypeFilter();
            filterInventory();
            updateSummary();
        }
    });

    // Listen for new items and render them in place without full refresh
    inventoryRef.on('child_added', (snapshot) => {
        const itemId = snapshot.key;
        const newItem = snapshot.val();
        // If already present skip
        if (inventoryData[itemId]) return;
        inventoryData[itemId] = newItem;

        // Update unique types and filter options if needed
        if (newItem && newItem.type) {
            uniqueTypes.add(newItem.type);
            updateTypeFilter();
        }

        // Recompute filtered items given current search/filter
        filterInventory();
        updateSummary();
    });

    // Listen for removed items and update UI
    inventoryRef.on('child_removed', (snapshot) => {
        const removedId = snapshot.key;
        if (inventoryData[removedId]) {
            delete inventoryData[removedId];
            // Rebuild unique types from remaining data
            uniqueTypes = new Set();
            Object.values(inventoryData).forEach(it => { if (it && it.type) uniqueTypes.add(it.type); });
            updateTypeFilter();
            filterInventory();
            updateSummary();
        }
    });
}

// Update type filter with unique types
function updateTypeFilter() {
    // Clear existing options except the "All Types" option
    while (typeFilter.options.length > 1) {
        typeFilter.remove(1);
    }
    
    // Add new options based on unique types
    uniqueTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
    });
}

// Filter inventory based on search and type
function filterInventory() {
    const searchTerm = searchInput.value.toLowerCase();
    const typeValue = typeFilter.value;
    const statusValue = (statusFilterEl && statusFilterEl.value) || 'all';
    
    // Filter the items based on current tab, search, and type filter
    filteredItems = Object.entries(inventoryData)
        .filter(([itemId, item]) => {
            const upperId = String(itemId).toUpperCase();
            
            // Filter by tab
            if (currentTab === 'brand-new') {
                // Only show base items (no RET/RETR/RETF/RETD suffix)
                if (/-RET(?:-\d+)?$/i.test(upperId) || /-RETR(?:-\d+)?$/i.test(upperId) || /-RETF(?:-\d+)?$/i.test(upperId) || /-RETD(?:-\d+)?$/i.test(upperId)) {
                    return false;
                }
            } else if (currentTab === 'returned') {
                // Only show RET items
                if (!/-RET(?:-\d+)?$/i.test(upperId)) {
                    return false;
                }
            } else if (currentTab === 'under-repair') {
                // Only show RETR items
                if (!/-RETR(?:-\d+)?$/i.test(upperId)) {
                    return false;
                }
            } else if (currentTab === 'repaired') {
                // Only show RETF items
                if (!/-RETF(?:-\d+)?$/i.test(upperId)) {
                    return false;
                }
            } else if (currentTab === 'disposed') {
                // Only show RETD items
                if (!/-RETD(?:-\d+)?$/i.test(upperId)) {
                    return false;
                }
            }
            
            const matchesSearch =
                (itemId && itemId.toLowerCase().includes(searchTerm)) ||
                (item.type && item.type.toLowerCase().includes(searchTerm)) ||
                (item.manufacturer && item.manufacturer.toLowerCase().includes(searchTerm));
            
            const matchesType = typeValue === 'all' || (item.type && item.type === typeValue);
            const computedStatus = computeStatusCode(itemId, item);
            const matchesStatus = statusValue === 'all' || statusValue === computedStatus;
            
            return matchesSearch && matchesType && matchesStatus;
        });
    
    // Apply sorting if a sort option is selected
    const sortValue = (sortFilterEl && sortFilterEl.value) || 'none';
    if (sortValue !== 'none') {
        filteredItems.sort(([itemIdA, itemA], [itemIdB, itemB]) => {
            let valueA, valueB;
            
            if (sortValue === 'type') {
                // Sort by type first, then by brand, then by manufacturer
                const typeA = (itemA.type || '').toLowerCase();
                const typeB = (itemB.type || '').toLowerCase();
                if (typeA !== typeB) {
                    return typeA < typeB ? -1 : 1;
                }
                // Same type, sort by brand
                const brandA = (itemA.brand || '').toLowerCase();
                const brandB = (itemB.brand || '').toLowerCase();
                if (brandA !== brandB) {
                    return brandA < brandB ? -1 : 1;
                }
                // Same type and brand, sort by manufacturer
                const manA = (itemA.manufacturer || '').toLowerCase();
                const manB = (itemB.manufacturer || '').toLowerCase();
                return manA < manB ? -1 : manA > manB ? 1 : 0;
            } else if (sortValue === 'brand') {
                // Sort by brand first, then by manufacturer
                const brandA = (itemA.brand || '').toLowerCase();
                const brandB = (itemB.brand || '').toLowerCase();
                if (brandA !== brandB) {
                    return brandA < brandB ? -1 : 1;
                }
                // Same brand, sort by manufacturer
                const manA = (itemA.manufacturer || '').toLowerCase();
                const manB = (itemB.manufacturer || '').toLowerCase();
                return manA < manB ? -1 : manA > manB ? 1 : 0;
            } else if (sortValue === 'manufacturer') {
                // Sort by manufacturer first, then by brand
                const manA = (itemA.manufacturer || '').toLowerCase();
                const manB = (itemB.manufacturer || '').toLowerCase();
                if (manA !== manB) {
                    return manA < manB ? -1 : 1;
                }
                // Same manufacturer, sort by brand
                const brandA = (itemA.brand || '').toLowerCase();
                const brandB = (itemB.brand || '').toLowerCase();
                return brandA < brandB ? -1 : brandA > brandB ? 1 : 0;
            }
            
            return 0;
        });
    }
    
    // Log filtered items for debugging
    console.log('Filtered items:', filteredItems);
    
    // Render the current page
    renderCurrentPage();
    
    // Update pagination info
    updatePaginationInfo();
}

// Compute normalized status code for filtering
function computeStatusCode(itemId, item) {
    const upperId = String(itemId).toUpperCase();
    const baseQuantity = parseInt(item.quantity || 0);
    const limitL = parseInt(item.limitL || 0);
    
    if (/-RET(?:-\d+)?$/i.test(upperId)) return 'returned';
    if (/-RETR(?:-\d+)?$/i.test(upperId)) return 'under_repair';
    if (/-RETF(?:-\d+)?$/i.test(upperId)) return 'repaired';
    if (/-RETD(?:-\d+)?$/i.test(upperId)) return 'disposed';
    
    // For base items, calculate total quantity including all variants
    let totalQuantity = baseQuantity;
    Object.entries(inventoryData).forEach(([variantId, variantItem]) => {
        const upperVariantId = String(variantId).toUpperCase();
        if (/-RET(?:-\d+)?$/i.test(upperVariantId) || /-RETR(?:-\d+)?$/i.test(upperVariantId) || /-RETF(?:-\d+)?$/i.test(upperVariantId)) {
            const baseId = variantId.replace(/-(RET|RETR|RETF)(?:-\d+)?$/i, '');
            if (baseId === itemId) {
                totalQuantity += parseInt(variantItem.quantity || 0);
            }
        }
    });
    
    if (totalQuantity <= 0) return 'no_stock';
    if (totalQuantity >= limitL) return 'available';
    return 'low_stock';
}

function createItemRowWithVariants(itemId, item, index, variants = []) {
    const row = document.createElement('tr');
    row.setAttribute('data-item-id', itemId);
    const baseQuantity = parseInt(item.quantity || 0);
    
    // Calculate total quantity including all variants (RET + RETR + RETF)
    let totalQuantity = baseQuantity;
    let totalReturned = 0;
    let totalUnderRepair = 0;
    let totalRepaired = 0;

    variants.forEach(([variantId, variantItem]) => {
        const quantity = parseInt(variantItem.quantity || 0);
        const upperId = String(variantId).toUpperCase();
        
        if (/-RETR(?:-\d+)?$/i.test(upperId)) {
            totalUnderRepair += quantity;
        } else if (/-RETF(?:-\d+)?$/i.test(upperId)) {
            totalRepaired += quantity;
        } else if (/-RET(?:-\d+)?$/i.test(upperId)) {
            totalReturned += quantity;
        }
        totalQuantity += quantity;
    });
    
    // Compute status text and color based on total combined quantity
    const limitL = parseInt(item.limitL || 0);
    let statusText = '';
    let statusColor = '';
    if (totalQuantity <= 0) {
        statusText = 'No stock';
        statusColor = '#e74c3c';
    } else if (totalQuantity >= limitL) {
        statusText = 'Available';
        statusColor = '#2ecc71';
    } else {
        statusText = 'Low Stock';
        statusColor = '#f1c40f';
    }

    // Variant dropdown removed - no longer showing RET/RETR/RETF variants
    let variantDropdown = '';

    row.innerHTML = `
        <td data-label="No.">${index}</td>
        <td data-label="Brand">${escapeCell(item.brand)}</td>
        <td data-label="Manufacturer">${escapeCell(item.manufacturer)}</td>
        <td data-label="Type">${escapeCell(item.type)}</td>
        <td data-label="Quantity" class="quantity-cell">${totalQuantity}</td>
        <td data-label="Unit">${escapeCell(item.quantityUnit)}</td>
        <td data-label="Size">${escapeCell(item.size || '')}</td>
        <td data-label="Description">${escapeCell(item.description)}</td>
        <td data-label="Supplier Name">${escapeCell(item.supplierName)}</td>
        <td data-label="Supplier Number">${escapeCell(item.supplierNumber)}</td>
        <td data-label="Status">
            <span style="color:${statusColor}; font-weight:600;">${statusText}</span>
            ${variantDropdown}
        </td>
    `;

    // Single-click and double-click handlers for brand-new tab
    if (currentTab === 'brand-new') {
        row.style.cursor = 'pointer';
        let clickTimer = null;
        
        row.addEventListener('click', (e) => {
            // Clear any existing timer
            if (clickTimer) {
                clearTimeout(clickTimer);
            }
            
            // Set a timer to trigger single click after delay
            clickTimer = setTimeout(() => {
                const id = String(itemId);
                openTransactionHistory(id, item);
                clickTimer = null;
            }, 300); // Wait 300ms to see if double-click occurs
        });
        
        // Double-click action - cancel single click and open adjust modal
        row.addEventListener('dblclick', (e) => {
            // Cancel the single-click timer
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            
            const id = String(itemId);
            openAdjustQtyModal(id, item);
        });
    } else {
        // Double-click action for other tabs (Under Repair)
        row.addEventListener('dblclick', () => {
            const id = String(itemId);
            
            // Under Repair tab - open mark as repaired modal
            if (currentTab === 'under-repair') {
                openMarkRepairedModal(id, item);
            }
        });
    }
    
    return row;
}

function createItemRow(itemId, item, index, isGrouped = false) {
    const row = document.createElement('tr');
    row.setAttribute('data-item-id', itemId);
    const quantity = parseInt(item.quantity || 0);
    
    // Compute status text and color
    const upperId = String(itemId).toUpperCase();
    const limitL = parseInt(item.limitL || 0);
    let statusText = '';
    let statusColor = '';
    if (/-RET(?:-\d+)?$/i.test(upperId)) {
        statusText = 'Returned';
        statusColor = '#e74c3c';
    } else if (/-RETR(?:-\d+)?$/i.test(upperId)) {
        statusText = 'Under Repair';
        statusColor = '#e67e22';
    } else if (/-RETF(?:-\d+)?$/i.test(upperId)) {
        statusText = 'Repaired';
        statusColor = '#2ecc71';
    } else if (/-RETD(?:-\d+)?$/i.test(upperId)) {
        statusText = 'Disposed';
        statusColor = '#95a5a6';
    } else if (quantity <= 0) {
        statusText = 'No stock';
        statusColor = '#e74c3c';
    } else if (quantity >= limitL) {
        statusText = 'Available';
        statusColor = '#2ecc71';
    } else {
        statusText = 'Low Stock';
        statusColor = '#f1c40f';
    }

    // For RET/RETR/RETF/RETD variants, get the base item details
    let displayItem = item;
    if (/-RET(?:-\d+)?$/i.test(upperId) || /-RETR(?:-\d+)?$/i.test(upperId) || /-RETF(?:-\d+)?$/i.test(upperId) || /-RETD(?:-\d+)?$/i.test(upperId)) {
        let baseId = itemId.replace(/-(RET|RETR|RETF|RETD)(?:-\d+)?$/i, '');
        console.log('Variant item ID:', itemId, 'Extracted base ID:', baseId);
        const baseItem = inventoryData[baseId];
        console.log('Base item found:', baseItem);
        if (baseItem) {
            // Use base item's details but keep variant's quantity and status
            displayItem = {
                brand: baseItem.brand || item.brand || '',
                manufacturer: baseItem.manufacturer || item.manufacturer || '',
                type: baseItem.type || item.type || '',
                quantityUnit: baseItem.quantityUnit || item.quantityUnit || '',
                size: baseItem.size || item.size || '',
                description: baseItem.description || item.description || '',
                supplierName: baseItem.supplierName || item.supplierName || '',
                supplierNumber: baseItem.supplierNumber || item.supplierNumber || '',
                quantity: quantity, // Keep the variant quantity
                limitL: baseItem.limitL || item.limitL || 0
            };
            console.log('Display item after merge:', displayItem);
        } else {
            console.log('Base item not found in inventoryData. Using variant data.');
        }
    }

    // Add indentation for grouped items
    const indentClass = isGrouped ? 'grouped-item' : '';
    const indentStyle = isGrouped ? 'padding-left: 30px;' : '';

    const noteCellHtml = (currentTab === 'returned' || currentTab === 'disposed')
        ? `<td data-label="Note" class="${indentClass}" style="${indentStyle}">${escapeCell(displayItem.note || item.note || '')}</td>`
        : '';

    row.innerHTML = `
        <td data-label="No." class="${indentClass}" style="${indentStyle}">${index}</td>
        <td data-label="Brand" class="${indentClass}" style="${indentStyle}">${escapeCell(displayItem.brand)}</td>
        <td data-label="Manufacturer" class="${indentClass}" style="${indentStyle}">${escapeCell(displayItem.manufacturer)}</td>
        <td data-label="Type" class="${indentClass}" style="${indentStyle}">${escapeCell(displayItem.type)}</td>
        <td data-label="Quantity" class="quantity-cell ${indentClass}" style="${indentStyle}">${quantity}</td>
        <td data-label="Unit" class="${indentClass}" style="${indentStyle}">${escapeCell(displayItem.quantityUnit)}</td>
        <td data-label="Size" class="${indentClass}" style="${indentStyle}">${escapeCell(displayItem.size || '')}</td>
        <td data-label="Description" class="${indentClass}" style="${indentStyle}">${escapeCell(displayItem.description)}</td>
        <td data-label="Supplier Name" class="${indentClass}" style="${indentStyle}">${escapeCell(displayItem.supplierName)}</td>
        <td data-label="Supplier Number" class="${indentClass}" style="${indentStyle}">${escapeCell(displayItem.supplierNumber)}</td>
        <td data-label="Status" class="${indentClass}" style="${indentStyle}"><span style="color:${statusColor}; font-weight:600;">${statusText}</span></td>
        ${noteCellHtml}
    `;

    // Single-click and double-click handlers for brand-new tab
    if (currentTab === 'brand-new') {
        row.style.cursor = 'pointer';
        let clickTimer = null;
        
        row.addEventListener('click', (e) => {
            // Clear any existing timer
            if (clickTimer) {
                clearTimeout(clickTimer);
            }
            
            // Set a timer to trigger single click after delay
            clickTimer = setTimeout(() => {
                const id = String(itemId);
                openTransactionHistory(id, displayItem);
                clickTimer = null;
            }, 300); // Wait 300ms to see if double-click occurs
        });
        
        // Double-click action - cancel single click and open adjust modal
        row.addEventListener('dblclick', (e) => {
            // Cancel the single-click timer
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            
            const id = String(itemId);
            openAdjustQtyModal(id, displayItem);
        });
    } else {
        // Double-click actions for other tabs (Under Repair)
        row.addEventListener('dblclick', () => {
            const id = String(itemId);
            
            // Under Repair tab - open mark as repaired modal
            if (currentTab === 'under-repair') {
                openMarkRepairedModal(id, displayItem);
            }
            // All other tabs (returned, repaired, disposed) do nothing
        });
    }
    
    return row;
}

// Build a floating variant summary that appears below the dropdown button
function createFloatingVariantSummary(baseId, variants) {
    const floatingDiv = document.createElement('div');
    floatingDiv.className = 'floating-variant-summary';
    floatingDiv.setAttribute('data-base-id', baseId);
    floatingDiv.style.cssText = `
        position: absolute;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 12px 16px;
        z-index: 1000;
        font-size: 14px;
        min-width: 200px;
        max-width: 300px;
    `;

    // Calculate totals for each status
    let totalReturned = 0;
    let totalUnderRepair = 0;
    let totalRepaired = 0;

    variants.forEach(([variantId, variantItem]) => {
        const quantity = parseInt(variantItem.quantity || 0);
        const upperId = String(variantId).toUpperCase();
        
        if (/-RETR(?:-\d+)?$/i.test(upperId)) {
            totalUnderRepair += quantity;
        } else if (/-RETF(?:-\d+)?$/i.test(upperId)) {
            totalRepaired += quantity;
        } else if (/-RET(?:-\d+)?$/i.test(upperId)) {
            totalReturned += quantity;
        }
    });

    // Build summary display
    const summaryItems = [];
    if (totalRepaired > 0) {
        summaryItems.push(`<div style="color: #2ecc71; font-weight: 600; margin: 4px 0;">Repaired: ${totalRepaired}</div>`);
    }
    if (totalUnderRepair > 0) {
        summaryItems.push(`<div style="color: #e67e22; font-weight: 600; margin: 4px 0;">Under Repair: ${totalUnderRepair}</div>`);
    }
    if (totalReturned > 0) {
        summaryItems.push(`<div style="color: #e74c3c; font-weight: 600; margin: 4px 0;">Returned: ${totalReturned}</div>`);
    }

    const summaryText = summaryItems.length > 0 ? summaryItems.join('') : '<div style="color: #7f8c8d; font-style: italic;">No variants</div>';

    floatingDiv.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px; color: #2c3e50; border-bottom: 1px solid #ecf0f1; padding-bottom: 4px;">Variants Summary</div>
        ${summaryText}
    `;

    return floatingDiv;
}

function createGroupHeader(baseId, items, index) {
    const row = document.createElement('tr');
    row.className = 'group-header';
    row.setAttribute('data-group-id', baseId);
    
    // Calculate total quantities for each status
    let totalAvailable = 0;
    let totalReturned = 0;
    let totalUnderRepair = 0;
    let totalRepaired = 0;
    
    items.forEach(([itemId, item]) => {
        const quantity = parseInt(item.quantity || 0);
        const upperId = String(itemId).toUpperCase();
        if (/-RET(?:-\d+)?$/i.test(upperId)) {
            totalReturned += quantity;
        } else if (/-RETR(?:-\d+)?$/i.test(upperId)) {
            totalUnderRepair += quantity;
        } else if (/-RETF(?:-\d+)?$/i.test(upperId)) {
            totalRepaired += quantity;
        } else {
            totalAvailable += quantity;
        }
    });
    
    const totalItems = items.length;
    const totalQuantity = totalAvailable + totalReturned + totalUnderRepair + totalRepaired;
    
    row.innerHTML = `
        <td colspan="10" class="group-header-cell">
            <div class="group-header-content">
                <button class="group-toggle-btn" onclick="toggleGroup('${baseId}')">
                    <i class="fas fa-chevron-down group-icon"></i>
                </button>
                <div class="group-info">
                    <span class="group-title">${escapeCell(baseId)}</span>
                    <span class="group-stats">
                        ${totalItems} item${totalItems !== 1 ? 's' : ''} • 
                        Total: ${totalQuantity} • 
                        Available: ${totalAvailable} • 
                        Returned: ${totalReturned} • 
                        Under Repair: ${totalUnderRepair} • 
                        Repaired: ${totalRepaired}
                    </span>
                </div>
            </div>
        </td>
    `;
    
    return row;
}

function escapeCell(val){
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function updateItemRow(itemId, item) {
    // Find if the item is in the current filtered and paginated view
    const isItemInCurrentView = filteredItems.some(([id, _]) => id === itemId);
    
    if (isItemInCurrentView) {
        const existingRow = inventoryList.querySelector(`tr[data-item-id="${itemId}"]`);
        if (existingRow) {
            // Preserve the current index (first cell value)
            const currentIndex = existingRow.querySelector('td')?.textContent || '';
            
            // Check if this is a grouped item
            const isGrouped = existingRow.classList.contains('group-item');
            
            // Create new row with same index
            const newRow = createItemRow(itemId, item, currentIndex, isGrouped);
            
            // Update existing row with animation
            existingRow.classList.add('updating');
            setTimeout(() => {
                existingRow.innerHTML = newRow.innerHTML;
                existingRow.className = newRow.className;
                if (isGrouped) {
                    existingRow.classList.add('group-item');
                }
                existingRow.classList.add('updated');
                setTimeout(() => {
                    existingRow.classList.remove('updated');
                }, 500);
            }, 300);
        }
    }
}


function renderCurrentPage() {
    // Clear the current list
    inventoryList.innerHTML = '';
    
    // Check if status column should be hidden
    let hideStatusColumn = currentTab === 'returned' || currentTab === 'under-repair' || currentTab === 'repaired' || currentTab === 'disposed';
    // Base visible columns are 10 when status is hidden; add 1 more for Note on returned/ disposed
    let colspan = hideStatusColumn ? (currentTab === 'returned' || currentTab === 'disposed' ? 11 : 10) : 11;
    
    if (filteredItems.length === 0) {
        inventoryList.innerHTML = `<tr><td colspan="${colspan}">No items found</td></tr>`;
        return;
    }
    
    // Calculate start and end indices for the current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredItems.length);
    
    console.log('Rendering page:', currentPage);
    console.log('Items to render:', filteredItems.slice(startIndex, endIndex));
    
    // Get items for the current page
    const currentItems = filteredItems.slice(startIndex, endIndex);
    
    // Find variants for each base item
    const variantItems = {};
    
    currentItems.forEach(([itemId, item]) => {
        // Look for RET/RETR/RETF variants of this base item
        const variants = [];
        Object.entries(inventoryData).forEach(([variantId, variantItem]) => {
            const upperVariantId = String(variantId).toUpperCase();
            if (/-RET(?:-\d+)?$/i.test(upperVariantId) || /-RETR(?:-\d+)?$/i.test(upperVariantId) || /-RETF(?:-\d+)?$/i.test(upperVariantId)) {
                const baseId = variantId.replace(/-(RET|RETR|RETF)(?:-\d+)?$/i, '');
                if (baseId === itemId) {
                    variants.push([variantId, variantItem]);
                }
            }
        });
        
        if (variants.length > 0) {
            variantItems[itemId] = variants;
        }
    });
    
    // Expose variants map for this page to the toggle handler
    window.baseIdToVariants = variantItems;

    // Render base items with variant dropdowns if they exist
    let rowNum = 1 + startIndex;
    currentItems.forEach(([itemId, item]) => {
        const variants = variantItems[itemId] || [];
        
        // Use different rendering function based on tab
        let row;
        if (currentTab === 'brand-new') {
            // Brand New tab uses variant display
            row = createItemRowWithVariants(itemId, item, rowNum++, variants);
        } else {
            // Other tabs (returned, under-repair, repaired, disposed) show individual items
            row = createItemRow(itemId, item, rowNum++, false);
        }
        
        inventoryList.appendChild(row);
    });
    
    // Check if status column should be hidden for this tab
    hideStatusColumn = currentTab === 'returned' || currentTab === 'under-repair' || currentTab === 'repaired' || currentTab === 'disposed';
    
    // Hide/show status column header and cells based on tab
    const headerRow = document.querySelector('#inventory-table thead tr');
    if (headerRow && headerRow.cells.length >= 11) {
        headerRow.cells[10].style.display = hideStatusColumn ? 'none' : '';
    }
    // Toggle Remarks header (index 11) for Returned and Disposed tabs
    if (headerRow && headerRow.cells.length >= 12) {
        const showRemarks = currentTab === 'returned' || currentTab === 'disposed';
        headerRow.cells[11].style.display = showRemarks ? '' : 'none';
    }
    
    // Hide/show status cells in all data rows
    const dataRows = inventoryList.querySelectorAll('tr');
    dataRows.forEach(row => {
        if (row.cells.length >= 11) {
            row.cells[10].style.display = hideStatusColumn ? 'none' : '';
        }
        // Hide/show Remarks cells in rows (index 11) based on tab
        if (row.cells.length >= 12) {
            const showRemarks = currentTab === 'returned' || currentTab === 'disposed';
            row.cells[11].style.display = showRemarks ? '' : 'none';
        }
    });
    
    // Update pagination info
    updatePaginationInfo();
}

// Toggle variant dropdown visibility
window.toggleVariants = function(itemId) {
    const toggleBtn = document.querySelector(`button[onclick="toggleVariants('${itemId}')"]`);
    if (!toggleBtn) return;
    const icon = toggleBtn.querySelector('i');
    const variantContent = document.getElementById(`variant-content-${itemId}`);
    
    if (!variantContent) return;
    
    // Toggle the dropdown content visibility
    if (variantContent.style.display === 'none') {
        variantContent.style.display = 'block';
        icon.className = 'fas fa-chevron-up';
        toggleBtn.classList.add('variant-expanded');
    } else {
        variantContent.style.display = 'none';
        icon.className = 'fas fa-chevron-down';
        toggleBtn.classList.remove('variant-expanded');
    }
}

// Variant action handlers
window.toggleVariantActions = function(variantId, baseId) {
    // Close others under the same base
    const container = document.getElementById(`variant-content-${baseId}`);
    if (container) {
        const others = container.querySelectorAll('.variant-actions');
        others.forEach(node => {
            if (node.id !== `variant-actions-${variantId}`) node.style.display = 'none';
        });
    }
    const el = document.getElementById(`variant-actions-${variantId}`);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.onVariantCombine = async function(variantId) {
    try {
        // Merge variant quantity into base item, then remove variant
        const baseId = String(variantId).replace(/-(RET|RETR|RETF)(-\d+)?$/i, '');
        const snap = await inventoryRef.child(variantId).once('value');
        if (!snap.exists()) return;
        const data = snap.val() || {};
        const addQty = Number(data.quantity || 0);
        await inventoryRef.child(baseId).child('quantity').transaction(current => {
            const curr = Number(current || 0);
            return curr + addQty;
        });
        // Preserve some metadata on base if missing
        const baseSnap = await inventoryRef.child(baseId).once('value');
        const base = baseSnap.val() || {};
        const payload = {
            brand: base.brand || data.brand || '',
            manufacturer: base.manufacturer || data.manufacturer || '',
            type: base.type || data.type || '',
            quantityUnit: base.quantityUnit || data.quantityUnit || '',
            size: base.size || data.size || '',
            description: base.description || data.description || '',
            lastUpdated: Date.now()
        };
        await inventoryRef.child(baseId).update(payload);
        await inventoryRef.child(variantId).remove();
    } catch (e) {
        console.error('Combine variant failed:', e);
        alert('Failed to combine variant');
    }
};

window.onVariantToRepair = async function(variantId) {
    try {
        await transitionItemStatus(variantId, 'RETR');
    } catch (e) {
        console.error('Move to Under Repair failed:', e);
        alert('Failed to mark as Under Repair');
    }
};

window.onVariantRepair = async function(variantId) {
    try {
        await transitionItemStatus(variantId, 'RETF');
    } catch (e) {
        console.error('Mark repaired failed:', e);
        alert('Failed to mark as Repaired');
    }
};

// Toggle group visibility - make it globally accessible
window.toggleGroup = function(baseId) {
    const groupHeader = document.querySelector(`tr[data-group-id="${baseId}"]`);
    const groupItems = document.querySelectorAll(`tr.group-item[data-item-id^="${baseId}"]`);
    const toggleIcon = groupHeader.querySelector('.group-icon');
    
    if (!groupHeader || groupItems.length === 0) return;
    
    const isCollapsed = groupItems[0].style.display === 'none';
    
    groupItems.forEach(item => {
        item.style.display = isCollapsed ? 'table-row' : 'none';
    });
    
    // Update icon
    toggleIcon.className = isCollapsed ? 'fas fa-chevron-up group-icon' : 'fas fa-chevron-down group-icon';
    
    // Update group header styling
    groupHeader.classList.toggle('group-expanded', isCollapsed);
}

// Switch inventory tabs
window.switchInventoryTab = function(tabName) {
    currentTab = tabName;
    
    // Update active tab button
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Show/hide status column header based on tab
    const hideStatusColumn = tabName === 'returned' || tabName === 'under-repair' || tabName === 'repaired' || tabName === 'disposed';
    const headerRow = document.querySelector('#inventory-table thead tr');
    if (headerRow && headerRow.cells.length >= 11) {
        headerRow.cells[10].style.display = hideStatusColumn ? 'none' : '';
    }
    
    // Reset to first page and re-filter
    currentPage = 1;
    filterInventory();
}

// Toggle column visibility - make it globally accessible
window.toggleColumn = function(columnIndex) {
    const table = document.getElementById('inventory-table');
    if (!table) return;
    
    const rows = table.querySelectorAll('tr');
    const isMinimized = table.classList.contains(`col-${columnIndex}-minimized`);
    
    // Get the button element and icons
    const headerCell = rows[0].cells[columnIndex - 1];
    const buttonElement = headerCell.querySelector('button.minimize-btn');
    const minimizeIcon = buttonElement ? buttonElement.querySelector('.minimize-icon') : null;
    const maximizeIcon = buttonElement ? buttonElement.querySelector('.maximize-icon') : null;
    
    rows.forEach((row, rowIndex) => {
        const cell = row.cells[columnIndex - 1];
        if (cell) {
            if (isMinimized) {
                // Maximize/restore column
                cell.style.width = '';
                cell.style.minWidth = '';
                cell.style.maxWidth = '';
                cell.style.overflow = '';
                cell.style.textOverflow = '';
                cell.style.padding = '';
                cell.style.whiteSpace = '';
            } else {
                // Minimize column
                cell.style.width = '40px';
                cell.style.minWidth = '40px';
                cell.style.maxWidth = '40px';
                cell.style.overflow = 'hidden';
                cell.style.textOverflow = 'ellipsis';
                cell.style.padding = '4px 2px';
                cell.style.whiteSpace = 'nowrap';
                
                // Keep header visible for minimize button
                if (rowIndex === 0) { // Header row
                    cell.style.overflow = 'visible';
                }
            }
        }
    });
    
    // Toggle the minimized state
    if (isMinimized) {
        table.classList.remove(`col-${columnIndex}-minimized`);
    } else {
        table.classList.add(`col-${columnIndex}-minimized`);
    }
    
    // Update button icons and title to reflect current state
    if (minimizeIcon && maximizeIcon && buttonElement) {
        if (isMinimized) {
            // Now maximized - show minus (minimize) icon
            minimizeIcon.style.display = '';
            maximizeIcon.style.display = 'none';
            buttonElement.title = 'Minimize column';
        } else {
            // Now minimized - show plus (maximize) icon
            minimizeIcon.style.display = 'none';
            maximizeIcon.style.display = '';
            buttonElement.title = 'Maximize column';
        }
    }
}

// Render skeleton placeholder rows to preserve layout during loading
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

function updatePaginationInfo() {
    // filteredItems now only contains base items (RET/RETR/RETF variants are excluded)
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
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

function viewItemDetails(itemId, item) {
    // Create a formatted details string
    const details = `
        ID: ${itemId}
        Type: ${item.type || 'N/A'}
        Manufacturer: ${item.manufacturer || 'N/A'}
        Quantity: ${item.quantity || '0'}
    `;
    
    // Show in an alert for simplicity (in a real app, you'd use a modal)
    alert(`Item Details:\n${details}`);
}

// Transition item ID suffix and update in Firebase by cloning to a new key and removing the old
async function transitionItemStatus(currentId, targetSuffix) {
    const upper = String(currentId).toUpperCase();
    let baseId = currentId;
    // Strip known suffixes and optional numeric counters, e.g., -RETR-2, -RETD
    baseId = baseId.replace(/-(RET|RETR|RETF|RETD)(-\d+)?$/i, '');
    
    // Get the current item data
    const snap = await inventoryRef.child(currentId).once('value');
    if (!snap.exists()) throw new Error('Item no longer exists');
    let data = snap.val() || {};
    
    // If transitioning from a variant, get the base item's data for proper display
    if (/-RET(?:-\d+)?$/i.test(upper) || /-RETR(?:-\d+)?$/i.test(upper) || /-RETF(?:-\d+)?$/i.test(upper) || /-RETD(?:-\d+)?$/i.test(upper)) {
        const baseSnap = await inventoryRef.child(baseId).once('value');
        if (baseSnap.exists()) {
            const baseData = baseSnap.val() || {};
            // Merge base data but keep variant's quantity and status-specific data
            data = {
                ...baseData,
                quantity: data.quantity, // Keep variant quantity
                note: data.note || baseData.note,
                lastUpdated: Date.now()
            };
        }
    } else {
        data.lastUpdated = Date.now();
    }
    
    // Get current user info for activity tracking
    const userSession = sessionStorage.getItem('elavil_user');
    let transitionedBy = 'Unknown User';
    let transitionedByRole = 'Unknown Role';
    
    if (userSession) {
        try {
            const user = JSON.parse(userSession);
            transitionedBy = user.fullName || 'Unknown User';
            if (user.level === 3) {
                transitionedByRole = 'Supervisor';
            } else if (user.level === 4) {
                transitionedByRole = 'Administrator';
            } else {
                transitionedByRole = user.employeeType || 'Unknown Role';
            }
        } catch (e) {
            console.error('Error parsing user session:', e);
        }
    }
    
    // Special handling for RETF: merge quantity into existing base -RETF if present
    if (String(targetSuffix).toUpperCase() === 'RETF') {
        const destId = `${baseId}-RETF`;
        const destRef = inventoryRef.child(destId);
        const destSnap = await destRef.once('value');
        const addQty = Number(data.quantity || 0);
        if (destSnap.exists()) {
            // Merge quantities and preserve existing metadata; update lastUpdated
            await destRef.child('quantity').transaction(current => {
                const curr = Number(current || 0);
                return curr + addQty;
            });
            // Perform a non-destructive metadata update
            const existing = destSnap.val() || {};
            const payload = {
                brand: existing.brand || data.brand,
                manufacturer: existing.manufacturer || data.manufacturer,
                type: existing.type || data.type,
                quantityUnit: existing.quantityUnit || data.quantityUnit,
                size: existing.size || data.size,
                description: existing.description || data.description,
                supplierName: existing.supplierName || data.supplierName,
                supplierNumber: existing.supplierNumber || data.supplierNumber,
                lastUpdated: Date.now()
            };
            if (!existing.createdAt && data.createdAt) payload.createdAt = data.createdAt;
            await destRef.update(payload);
            await inventoryRef.child(currentId).remove();
            
            // Record activity
            const activitiesRef = database.ref('activities');
            const activityDescription = `Marked ${data.quantity} ${data.brand} ${data.type} as repaired`;
            
            // Generate activity ID using inventory ID + counter
            const activityId = await generateActivityId(activitiesRef, destId);
            
            const activityRecord = {
                time: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
                actType: 'Inventory',
                description: activityDescription,
                user: transitionedBy,
                role: transitionedByRole
            };
            
            await activitiesRef.child(activityId).set(activityRecord);
            return;
        }
        // If no base -RETF exists, create it directly
        await destRef.set(data);
        await inventoryRef.child(currentId).remove();
        
        // Record activity
        const activitiesRef = database.ref('activities');
        const activityDescription = `Marked ${data.quantity} ${data.brand} ${data.type} as repaired`;
        
        // Generate activity ID using inventory ID + counter
        const activityId = await generateActivityId(activitiesRef, destId);
        
        const activityRecord = {
            time: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
            actType: 'Inventory',
            description: activityDescription,
            user: transitionedBy,
            role: transitionedByRole
        };
        
        await activitiesRef.child(activityId).set(activityRecord);
        return;
    }
    // Default behavior for other suffixes: create unique target id if needed
    let candidateId = `${baseId}-${targetSuffix}`;
    let counter = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        // eslint-disable-next-line no-await-in-loop
        const existsSnap = await inventoryRef.child(candidateId).once('value');
        if (!existsSnap.exists()) break;
        candidateId = `${baseId}-${targetSuffix}-${counter++}`;
    }
    await inventoryRef.child(candidateId).set(data);
    await inventoryRef.child(currentId).remove();
    
    // Record activity
    const activitiesRef = database.ref('activities');
    const statusText = targetSuffix === 'RET' ? 'returned' : targetSuffix === 'RETR' ? 'under repair' : 'repaired';
    const activityDescription = `Marked ${data.quantity} ${data.brand} ${data.type} as ${statusText}`;
    
    // Generate activity ID using inventory ID + counter
    const activityId = await generateActivityId(activitiesRef, candidateId);
    
    const activityRecord = {
        time: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
        actType: 'Inventory',
        description: activityDescription,
        user: transitionedBy,
        role: transitionedByRole
    };
    
    await activitiesRef.child(activityId).set(activityRecord);
}

// Generate activity ID using inventory ID + counter
async function generateActivityId(activitiesRef, inventoryId) {
    let baseActivityId = inventoryId;
    let counter = 1;
    let candidateId = `${baseActivityId}-${counter}`;
    
    // Check if this activity ID already exists
    while (true) {
        const existsSnap = await activitiesRef.child(candidateId).once('value');
        if (!existsSnap.exists()) {
            break;
        }
        counter++;
        candidateId = `${baseActivityId}-${counter}`;
    }
    
    return candidateId;
}

// Modal-based confirmation helper
function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const yesBtn = document.getElementById('confirm-yes');
        const noBtn = document.getElementById('confirm-no');
        const closeBtn = document.getElementById('confirm-close');
        if (!modal || !msgEl || !yesBtn || !noBtn || !closeBtn) {
            // Fallback to native confirm
            resolve(window.confirm(message));
            return;
        }
        msgEl.textContent = message || 'Are you sure?';
        modal.style.display = 'flex';
        const cleanup = () => {
            modal.style.display = 'none';
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
            closeBtn.removeEventListener('click', onNo);
            window.removeEventListener('click', outside);
        };
        const onYes = () => { cleanup(); resolve(true); };
        const onNo = () => { cleanup(); resolve(false); };
        const outside = (e) => { if (e.target === modal) onNo(); };
        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
        closeBtn.addEventListener('click', onNo);
        window.addEventListener('click', outside);
    });
}

// Update inventory summary
function updateSummary() {
    let returnedItemsCount = 0; // Count items with -RET suffix (returned items)
    let underRepairCount = 0; // Count items with -RETR suffix (under repair items)
    let repairedCount = 0; // Count items with -RETF suffix (repaired items)
    let disposedCount = 0; // Count items with -RETD suffix (disposed items)
    let totalItems = 0; // Total base items (matches table count)
    let availableCount = 0;
    let lowStockItems = 0;
    let noStockItems = 0;
    
    // Only count base items (without RET/RETR/RETF/RETD suffixes)
    Object.entries(inventoryData).forEach(([itemId, item]) => {
        const upperId = String(itemId).toUpperCase();
        
        // Skip RET/RETR/RETF/RETD variants - only count base items
        if (/-RET(?:-\d+)?$/i.test(upperId) || /-RETR(?:-\d+)?$/i.test(upperId) || /-RETF(?:-\d+)?$/i.test(upperId) || /-RETD(?:-\d+)?$/i.test(upperId)) {
            return;
        }
        
        // Count total base items (this should match table count)
        totalItems++;
        
        const baseQuantity = parseInt(item.quantity || 0);
        const limitL = parseInt(item.limitL || 0);
        
        // Calculate total quantity including all variants
        let totalQuantity = baseQuantity;
        Object.entries(inventoryData).forEach(([variantId, variantItem]) => {
            const upperVariantId = String(variantId).toUpperCase();
            if (/-RET(?:-\d+)?$/i.test(upperVariantId) || /-RETR(?:-\d+)?$/i.test(upperVariantId) || /-RETF(?:-\d+)?$/i.test(upperVariantId)) {
                const baseId = variantId.replace(/-(RET|RETR|RETF)(?:-\d+)?$/i, '');
                if (baseId === itemId) {
                    totalQuantity += parseInt(variantItem.quantity || 0);
                }
            }
        });
        
        // Check if item has zero total quantity
        if (totalQuantity <= 0) {
            noStockItems++;
        } else if (totalQuantity >= limitL) {
            availableCount++;
        } else {
            lowStockItems++;
        }
    });

    // Count items whose ID ends with -RET (returned items)
    try {
        returnedItemsCount = Object.keys(inventoryData)
            .filter(id => typeof id === 'string' && /-RET(?:-\d+)?$/i.test(id) && !/-RETR(?:-\d+)?$/i.test(id.toUpperCase()) && !/-RETF(?:-\d+)?$/i.test(id.toUpperCase()) && !/-RETD(?:-\d+)?$/i.test(id.toUpperCase()))
            .length;
    } catch(e) {
        returnedItemsCount = 0;
    }

    // Count items whose ID ends with -RETR (under repair items)
    try {
        underRepairCount = Object.keys(inventoryData)
            .filter(id => typeof id === 'string' && /-RETR(?:-\d+)?$/i.test(id))
            .length;
    } catch(e) {
        underRepairCount = 0;
    }
    
    // Count items whose ID ends with -RETF (repaired items)
    try {
        repairedCount = Object.keys(inventoryData)
            .filter(id => typeof id === 'string' && /-RETF(?:-\d+)?$/i.test(id))
            .length;
    } catch(e) {
        repairedCount = 0;
    }
    
    // Count items whose ID ends with -RETD (disposed items)
    try {
        disposedCount = Object.keys(inventoryData)
            .filter(id => typeof id === 'string' && /-RETD(?:-\d+)?$/i.test(id))
            .length;
    } catch(e) {
        disposedCount = 0;
    }
    
    // Update summary elements
    underRepairEl.textContent = returnedItemsCount; // This element shows "Items Returned"
    readyToUseEl.textContent = totalItems; // This shows total items (matches table count)
    lowStockEl.textContent = lowStockItems;
    noStockEl.textContent = noStockItems;
    underRepairRetrEl.textContent = underRepairCount;
    repairedRetfEl.textContent = repairedCount;
    disposedRetdEl.textContent = disposedCount;
}

// Transaction History Functions
function openTransactionHistory(itemId, item) {
    const modal = document.getElementById('transaction-history-modal');
    if (!modal) return;
    
    // Show modal and loading state
    modal.style.display = 'flex';
    document.getElementById('transaction-history-loading').style.display = 'block';
    document.getElementById('transaction-history-content').style.display = 'none';
    document.getElementById('transaction-history-empty').style.display = 'none';
    
    // Load history
    loadTransactionHistory(itemId, item);
}

function closeTransactionHistory() {
    const modal = document.getElementById('transaction-history-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}


async function loadTransactionHistory(itemId, item) {
    try {
        const activitiesRef = database.ref('activities');
        const snapshot = await activitiesRef.once('value');
        
        if (!snapshot.exists()) {
            showEmptyHistory();
            return;
        }
        
        const allActivities = snapshot.val();
        const candidateActivities = [];
        const requestIdsToCheck = new Set();
        const returnIdsToCheck = new Set();
        
        // First pass: Quick filter for Inventory activities and collect Request/Return IDs
        // This avoids expensive database queries for activities that won't match anyway
        for (const [activityId, activity] of Object.entries(allActivities)) {
            const description = (activity.description || '').toLowerCase();
            let quickMatch = false;
            
            // Fast check for Inventory activities by ID prefix
            if (activity.actType === 'Inventory') {
                // Check if description mentions quantity changes first (avoid expensive ID extraction)
                if (description.includes('added') || description.includes('adjust')) {
                    const baseId = extractInventoryIdFromActivity(activityId, activity);
                    if (baseId === itemId || activityId.startsWith(itemId)) {
                        quickMatch = true;
                    }
                }
            }
            // Fast check for Request activities - only collect IDs for "picked up" activities
            else if (activity.actType === 'Request') {
                if (description.includes('picked up') || description.includes('pickup')) {
                    const requestId = extractRequestIdFromActivity(activityId);
                    if (requestId) {
                        requestIdsToCheck.add(requestId);
                        candidateActivities.push({
                            activityId,
                            ...activity,
                            _requestId: requestId,
                            _needsCheck: true
                        });
                    }
                }
            }
            // Fast check for Return activities
            else if (activity.actType === 'Return') {
                if (description.includes('return request accepted') || description.includes('returned')) {
                    const returnId = extractReturnIdFromActivity(activityId);
                    if (returnId) {
                        returnIdsToCheck.add(returnId);
                        candidateActivities.push({
                            activityId,
                            ...activity,
                            _returnId: returnId,
                            _needsCheck: true
                        });
                    }
                }
            }
            
            // Also check direct itemId field
            if (!quickMatch && activity.itemId) {
                if (activity.itemId === itemId || activity.itemId.startsWith(itemId)) {
                    const desc = (activity.description || '').toLowerCase();
                    // Only include if it affects quantity
                    if ((activity.actType === 'Inventory' && (desc.includes('added') || desc.includes('adjust'))) ||
                        (activity.actType === 'Request' && (desc.includes('picked up') || desc.includes('pickup'))) ||
                        (activity.actType === 'Return' && (desc.includes('return request accepted') || desc.includes('returned')))) {
                        candidateActivities.push({
                            activityId,
                            ...activity
                        });
                    }
                }
            } else if (quickMatch) {
                candidateActivities.push({
                    activityId,
                    ...activity
                });
            }
        }
        
        // Batch fetch all PartsRequest and ReturnParts in parallel
        const batchPromises = [];
        const requestPartsMap = new Map();
        const returnPartsMap = new Map();
        
        // Batch fetch PartsRequest
        if (requestIdsToCheck.size > 0) {
            requestIdsToCheck.forEach(requestId => {
                batchPromises.push(
                    database.ref(`PartsRequest/${requestId}`).once('value').then(snap => {
                        if (snap.exists()) {
                            requestPartsMap.set(requestId, snap.val());
                        }
                    })
                );
            });
        }
        
        // Batch fetch ReturnParts
        if (returnIdsToCheck.size > 0) {
            returnIdsToCheck.forEach(returnId => {
                batchPromises.push(
                    database.ref(`ReturnParts/${returnId}`).once('value').then(snap => {
                        if (snap.exists()) {
                            returnPartsMap.set(returnId, snap.val());
                        }
                    })
                );
            });
        }
        
        // Wait for all batch queries to complete in parallel
        await Promise.all(batchPromises);
        
        // Second pass: Filter Request and Return activities using cached data
        const quantityAffectingActivities = candidateActivities.filter(activity => {
            // Inventory activities already filtered in first pass
            if (activity.actType === 'Inventory') {
                return true;
            }
            
            // Request activities - check cached PartsRequest data
            if (activity.actType === 'Request' && activity._needsCheck) {
                const parts = requestPartsMap.get(activity._requestId);
                if (parts && typeof parts === 'object') {
                    for (const partId in parts) {
                        if (partId === itemId || partId.startsWith(itemId)) {
                            // Cache the parts data for later use
                            activity.requestData = parts;
                            return true;
                        }
                    }
                }
                return false;
            }
            
            // Return activities - check cached ReturnParts data
            if (activity.actType === 'Return' && activity._needsCheck) {
                const parts = returnPartsMap.get(activity._returnId);
                if (parts && typeof parts === 'object') {
                    for (const partId in parts) {
                        if (partId === itemId || partId.startsWith(itemId)) {
                            return true;
                        }
                    }
                }
                return false;
            }
            
            return true;
        });
        
        // Sort by time (newest first) and take latest 5
        quantityAffectingActivities.sort((a, b) => {
            const timeA = a.time || '';
            const timeB = b.time || '';
            return timeB.localeCompare(timeA);
        });
        
        const latest5 = quantityAffectingActivities.slice(0, 5);
        
        if (latest5.length === 0) {
            showEmptyHistory();
            return;
        }
        
        // Fetch additional details for Return activities only (Request already cached)
        const enrichedActivities = await Promise.all(
            latest5.map(async (activity) => {
                const enriched = { ...activity };
                
                // Remove internal flags
                delete enriched._requestId;
                delete enriched._returnId;
                delete enriched._needsCheck;
                
                // Request data already cached in requestData
                // Only need to fetch ReturnRequests details
                if (activity.actType === 'Return') {
                    const returnId = extractReturnIdFromActivity(activity.activityId);
                    if (returnId && !enriched.returnData) {
                        const returnRequestRef = database.ref(`ReturnRequests/${returnId}`);
                        const returnSnap = await returnRequestRef.once('value');
                        if (returnSnap.exists()) {
                            enriched.returnData = returnSnap.val();
                        }
                    }
                }
                
                return enriched;
            })
        );
        
        displayTransactionHistory(enrichedActivities, item, itemId);
        
    } catch (error) {
        console.error('Error loading transaction history:', error);
        showEmptyHistory();
    }
}

function extractInventoryIdFromActivity(activityId, activity) {
    if (!activityId) return '';
    
    // For Inventory activities: {inventoryId}-{counter}
    if (activity && activity.actType === 'Inventory') {
        // Remove trailing -{number} pattern
        return activityId.replace(/-\d+$/, '');
    }
    
    // For Request activities: {requestId}-{counter}
    // We don't extract inventory ID from these
    if (activity && activity.actType === 'Request') {
        return null;
    }
    
    // For Return activities: RET-{requestId}-{timestamp}
    // We don't extract inventory ID from these
    if (activity && activity.actType === 'Return') {
        return null;
    }
    
    // Default: try to remove trailing -{number}
    return activityId.replace(/-\d+$/, '');
}

function extractRequestIdFromActivity(activityId) {
    if (!activityId) return null;
    
    // Format: {requestId}-{counter}
    // Remove trailing -{number} to get request ID
    return activityId.replace(/-\d+$/, '');
}

function extractReturnIdFromActivity(activityId) {
    if (!activityId) return null;
    
    // Format: RET-{requestId}-{timestamp}
    // Extract the requestId between RET- and last timestamp
    const match = activityId.match(/^RET-(.+?)-(\d+)$/);
    if (match && match[1]) {
        return match[1];
    }
    
    // Fallback: try removing RET- prefix and last timestamp
    return activityId.replace(/^RET-/, '').replace(/-\d+$/, '');
}

function displayTransactionHistory(activities, item, itemId) {
    const loadingEl = document.getElementById('transaction-history-loading');
    const contentEl = document.getElementById('transaction-history-content');
    const listEl = document.getElementById('transaction-history-list');
    const emptyEl = document.getElementById('transaction-history-empty');
    
    loadingEl.style.display = 'none';
    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';
    
    // Clear previous content
    listEl.innerHTML = '';
    
    // Add header with item info
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'padding:1rem; background:#f8f9fa; border-radius:8px; margin-bottom:1rem;';
    headerDiv.innerHTML = `
        <div style="font-weight:600; color:#2c3e50; margin-bottom:0.5rem;">${escapeCell(item.brand)} ${escapeCell(item.type)}</div>
        <div style="font-size:0.9rem; color:#7f8c8d;">${escapeCell(item.manufacturer)} • History of Quantity Changes</div>
    `;
    listEl.appendChild(headerDiv);
    
    // Render each activity
    activities.forEach((activity, index) => {
        const activityDiv = document.createElement('div');
        activityDiv.style.cssText = 'padding:1rem; border:1px solid #e9ecef; border-radius:8px; margin-bottom:0.75rem; background:#fff;';
        
        let activityContent = '';
        const timeStr = formatTime(activity.time);
        const icon = getActivityIcon(activity.actType);
        const color = getActivityColor(activity.actType);
        
        if (activity.actType === 'Inventory') {
            // Parse description like "Added 1 Yamalube engine oil" to "+ 1 Yamalube engine oil"
            let displayText = activity.description || '';
            if (displayText.toLowerCase().startsWith('added ')) {
                displayText = '+ ' + displayText.substring(6); // Remove "Added " and add "+ "
            } else if (displayText.toLowerCase().includes('added')) {
                // Handle cases like "Added X items to inventory"
                displayText = displayText.replace(/added\s+/i, '+ ');
            }
            
            activityContent = `
                <div style="display:flex; align-items:start; gap:1rem;">
                    <div style="font-size:1.5rem; color:${color};">
                        <i class="${icon}"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:600; color:#2c3e50; margin-bottom:0.25rem;">
                            ${escapeCell(displayText)}
                        </div>
                        <div style="font-size:0.85rem; color:#7f8c8d;">
                            <i class="fas fa-user"></i> ${escapeCell(activity.user)} • 
                            <i class="fas fa-user-tag"></i> ${escapeCell(activity.role)}
                        </div>
                        <div style="font-size:0.8rem; color:#95a5a6; margin-top:0.25rem;">
                            <i class="fas fa-clock"></i> ${timeStr}
                        </div>
                    </div>
                </div>
            `;
        } else if (activity.actType === 'Request') {
            // Try to get quantity deducted from PartsRequest for display
            let deductedQty = null;
            if (activity.requestData) {
                const reqData = activity.requestData;
                // PartsRequest data structure might have quantity info
                if (reqData && typeof reqData === 'object') {
                    // Look for the item's quantity in the request
                    for (const partId in reqData) {
                        if (partId === itemId || partId.startsWith(itemId)) {
                            const partData = reqData[partId];
                            if (partData && partData.quantity) {
                                deductedQty = partData.quantity;
                            }
                            break;
                        }
                    }
                }
            }
            
            // Build display text with item name
            let displayText = '';
            if (deductedQty) {
                const itemName = `${item.brand || ''} ${item.type || ''}`.trim();
                displayText = `- ${deductedQty} ${itemName}`;
            } else {
                displayText = activity.description || 'Request Item Picked Up';
            }
            
            activityContent = `
                <div style="display:flex; align-items:start; gap:1rem;">
                    <div style="font-size:1.5rem; color:${color};">
                        <i class="${icon}"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:600; color:#2c3e50; margin-bottom:0.25rem;">
                            ${escapeCell(displayText)}
                        </div>
                        <div style="font-size:0.85rem; color:#7f8c8d;">
                            <i class="fas fa-user"></i> ${escapeCell(activity.user)} • 
                            <i class="fas fa-user-tag"></i> ${escapeCell(activity.role)}
                        </div>
                        <div style="font-size:0.8rem; color:#95a5a6; margin-top:0.25rem;">
                            <i class="fas fa-clock"></i> ${timeStr}
                        </div>
                    </div>
                </div>
            `;
        } else if (activity.actType === 'Return') {
            const returnId = extractReturnIdFromActivity(activity.activityId);
            let returnInfo = '';
            
            if (activity.returnData) {
                const retData = activity.returnData;
                returnInfo = `
                    <div style="margin-top:0.5rem; padding:0.5rem; background:#f8f9fa; border-radius:4px; font-size:0.85rem;">
                        <div><strong>Return Request ID:</strong> ${escapeCell(returnId)}</div>
                        ${retData.busId ? `<div><strong>Bus ID:</strong> ${escapeCell(retData.busId)}</div>` : ''}
                        ${retData.status ? `<div><strong>Status:</strong> ${escapeCell(retData.status)}</div>` : ''}
                    </div>
                `;
            }
            
            activityContent = `
                <div style="display:flex; align-items:start; gap:1rem;">
                    <div style="font-size:1.5rem; color:${color};">
                        <i class="${icon}"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:600; color:#2c3e50; margin-bottom:0.25rem;">
                            ${escapeCell(activity.description)}
                        </div>
                        <div style="font-size:0.85rem; color:#7f8c8d;">
                            <i class="fas fa-user"></i> ${escapeCell(activity.user)} • 
                            <i class="fas fa-user-tag"></i> ${escapeCell(activity.role)}
                        </div>
                        ${returnInfo}
                        <div style="font-size:0.8rem; color:#95a5a6; margin-top:0.25rem;">
                            <i class="fas fa-clock"></i> ${timeStr}
                        </div>
                    </div>
                </div>
            `;
        }
        
        activityDiv.innerHTML = activityContent;
        listEl.appendChild(activityDiv);
    });
}

function getActivityIcon(actType) {
    switch (actType) {
        case 'Inventory': return 'fas fa-box';
        case 'Request': return 'fas fa-shopping-cart';
        case 'Return': return 'fas fa-undo';
        default: return 'fas fa-circle';
    }
}

function getActivityColor(actType) {
    switch (actType) {
        case 'Inventory': return '#3498db';
        case 'Request': return '#e67e22';
        case 'Return': return '#2ecc71';
        default: return '#95a5a6';
    }
}

function formatTime(timeStr) {
    if (!timeStr || timeStr.length !== 14) return 'Unknown time';
    
    // Format: YYYYMMDDHHmmss
    const year = timeStr.substring(0, 4);
    const month = timeStr.substring(4, 6);
    const day = timeStr.substring(6, 8);
    const hour = timeStr.substring(8, 10);
    const minute = timeStr.substring(10, 12);
    const second = timeStr.substring(12, 14);
    
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    // Always show days ago format
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
}

function showEmptyHistory() {
    const loadingEl = document.getElementById('transaction-history-loading');
    const contentEl = document.getElementById('transaction-history-content');
    const emptyEl = document.getElementById('transaction-history-empty');
    
    loadingEl.style.display = 'none';
    contentEl.style.display = 'none';
    emptyEl.style.display = 'block';
} 