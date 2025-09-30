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
const underRepairEl = document.getElementById('under-repair').querySelector('p');
const readyToUseEl = document.getElementById('ready-to-use').querySelector('p');
const lowStockEl = document.getElementById('low-stock').querySelector('p');
const noStockEl = document.getElementById('no-stock').querySelector('p');
const sidebarItems = document.querySelectorAll('.sidebar-menu li');

// Pagination variables
let currentPage = 1;
const itemsPerPage = 5;
let filteredItems = [];

// Inventory data storage
let inventoryData = {};
let uniqueTypes = new Set();

// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', function() {
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
            const unit = document.getElementById('inv-unit').value;
            const description = document.getElementById('inv-description').value.trim();
            const supplierName = document.getElementById('inv-supplier-name').value.trim();
            const supplierNumber = (document.getElementById('inv-supplier-number').value || '').replace(/[^0-9]/g, '').slice(0, 11);

            // Validate
            const qty = Number(quantityStr);
            if (!Number.isInteger(qty) || qty <= 0) { alert('Quantity must be a whole number greater than 0.'); return; }
            if (!/^09\d{9}$/.test(supplierNumber)) { alert('Supplier Number must start with 09 and be 11 digits.'); return; }
            if (!unit) { alert('Please select a quantity unit.'); return; }

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
                quantityUnit: unit,
                description,
                supplierName,
                supplierNumber,
                createdAt: Date.now(),
                lastUpdated: Date.now()
            };

            try {
                await inventoryRef.child(newId).set(payload);
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
                // Let realtime child_changed update the UI and summary to avoid double renders
                closeAdj();
            } catch (err) {
                console.error('Adjust quantity failed:', err);
                alert('Failed to adjust quantity.');
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
    
    // Filter the items based on search and type filter
    filteredItems = Object.entries(inventoryData)
        .filter(([itemId, item]) => {
            const matchesSearch =
                (itemId && itemId.toLowerCase().includes(searchTerm)) ||
                (item.type && item.type.toLowerCase().includes(searchTerm)) ||
                (item.manufacturer && item.manufacturer.toLowerCase().includes(searchTerm));
            
            const matchesType = typeValue === 'all' || (item.type && item.type === typeValue);
            const computedStatus = computeStatusCode(itemId, item);
            const matchesStatus = statusValue === 'all' || statusValue === computedStatus;
            
            return matchesSearch && matchesType && matchesStatus;
        });
    
    // Log filtered items for debugging
    console.log('Filtered items:', filteredItems);
    
    // Render the current page
    renderCurrentPage();
    
    // Update pagination info
    updatePaginationInfo();
    
    // Render the current page
    renderCurrentPage();
}

// Compute normalized status code for filtering
function computeStatusCode(itemId, item) {
    const upperId = String(itemId).toUpperCase();
    const quantity = parseInt(item.quantity || 0);
    if (/-RET(?:-\d+)?$/i.test(upperId)) return 'returned';
    if (/-RETR(?:-\d+)?$/i.test(upperId)) return 'under_repair';
    if (/-RETF(?:-\d+)?$/i.test(upperId)) return 'repaired';
    if (quantity <= 0) return 'no_stock';
    if (quantity > 15) return 'available';
    return 'low_stock';
}

function createItemRow(itemId, item, index) {
    const row = document.createElement('tr');
    row.setAttribute('data-item-id', itemId);
    const quantity = parseInt(item.quantity || 0);
    
    // Compute status text and color
    const upperId = String(itemId).toUpperCase();
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
    } else if (quantity <= 0) {
        statusText = 'No stock';
        statusColor = '#e74c3c';
    } else if (quantity > 15) {
        statusText = 'Available';
        statusColor = '#2ecc71';
    } else {
        statusText = 'Low Stock';
        statusColor = '#f1c40f';
    }

    row.innerHTML = `
        <td>${index}</td>
        <td>${escapeCell(item.brand)}</td>
        <td>${escapeCell(item.manufacturer)}</td>
        <td>${escapeCell(item.type)}</td>
        <td class="quantity-cell">${quantity}</td>
        <td>${escapeCell(item.quantityUnit)}</td>
        <td>${escapeCell(item.description)}</td>
        <td>${escapeCell(item.supplierName)}</td>
        <td>${escapeCell(item.supplierNumber)}</td>
        <td><span style="color:${statusColor}; font-weight:600;">${statusText}</span></td>
    `;

    // Double-click actions: transition RET -> RETR, RETR -> RETF, else open adjust qty
    row.addEventListener('dblclick', () => {
        const id = String(itemId);
        const upper = id.toUpperCase();
        if (/-RETF(?:-\d+)?$/i.test(upper)) {
            // Final state; no action
            return;
        }
        if (/-RETR(?:-\d+)?$/i.test(upper)) {
            showConfirm('Mark this item as Repaired?').then(ok => {
                if (!ok) return;
                transitionItemStatus(id, 'RETF').catch(err => {
                    console.error('Failed to mark repaired:', err);
                    alert('Failed to mark as Repaired.');
                });
            });
            return;
        }
        if (/-RET(?:-\d+)?$/i.test(upper)) {
            showConfirm('Put this returned item Under Repair?').then(ok => {
                if (!ok) return;
                transitionItemStatus(id, 'RETR').catch(err => {
                    console.error('Failed to move to Under Repair:', err);
                    alert('Failed to put item Under Repair.');
                });
            });
            return;
        }
        openAdjustQtyModal(id, item);
    });
    
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
            
            // Create new row with same index
            const newRow = createItemRow(itemId, item, currentIndex);
            
            // Update existing row with animation
            existingRow.classList.add('updating');
            setTimeout(() => {
                existingRow.innerHTML = newRow.innerHTML;
                existingRow.className = newRow.className;
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
    
    if (filteredItems.length === 0) {
        inventoryList.innerHTML = '<tr><td colspan="10">No items found</td></tr>';
        return;
    }
    
    // Calculate start and end indices for the current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredItems.length);
    
    console.log('Rendering page:', currentPage);
    console.log('Items to render:', filteredItems.slice(startIndex, endIndex));
    
    // Get items for the current page
    const currentItems = filteredItems.slice(startIndex, endIndex);
    
    // Render each item for the current page
    let rowNum = 1 + startIndex;
    currentItems.forEach(([itemId, item]) => {
        const row = createItemRow(itemId, item, rowNum++);
        inventoryList.appendChild(row);
    });
    
    // Update pagination info
    updatePaginationInfo();
}

function updatePaginationInfo() {
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
    // Strip known suffixes and optional numeric counters, e.g., -RETR-2
    baseId = baseId.replace(/-(RET|RETR|RETF)(-\d+)?$/i, '');
    const snap = await inventoryRef.child(currentId).once('value');
    if (!snap.exists()) throw new Error('Item no longer exists');
    const data = snap.val() || {};
    data.lastUpdated = Date.now();
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
                description: existing.description || data.description,
                supplierName: existing.supplierName || data.supplierName,
                supplierNumber: existing.supplierNumber || data.supplierNumber,
                lastUpdated: Date.now()
            };
            if (!existing.createdAt && data.createdAt) payload.createdAt = data.createdAt;
            await destRef.update(payload);
            await inventoryRef.child(currentId).remove();
            return;
        }
        // If no base -RETF exists, create it directly
        await destRef.set(data);
        await inventoryRef.child(currentId).remove();
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
    let underRepairCount = 0; // Will be used for RET items count
    let availableCount = 0;
    let lowStockItems = 0;
    let noStockItems = 0;
    
    Object.values(inventoryData).forEach(item => {
        const quantity = parseInt(item.quantity || 0);
        
        // Check if item has zero quantity
        if (quantity === 0) {
            noStockItems++;
            return;
        }
        
        // Count available items
            availableCount++;
        
        // Consider items with quantity less than 10 as low stock
        if (quantity < 10) {
            lowStockItems++;
        }
    });

    // Count items whose ID ends with -RETR (under repair items)
    try {
        underRepairCount = Object.keys(inventoryData)
            .filter(id => typeof id === 'string' && /-RETR(?:-\d+)?$/i.test(id))
            .length;
    } catch(e) {
        underRepairCount = 0;
    }
    
    // Update summary elements
    underRepairEl.textContent = underRepairCount;
    readyToUseEl.textContent = availableCount;
    lowStockEl.textContent = lowStockItems;
    noStockEl.textContent = noStockItems;
} 