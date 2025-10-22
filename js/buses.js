(function() {
	// Check if user has admin access (level 4)
	function checkAdminAccess() {
		const user = window.ElavilAuth ? window.ElavilAuth.getCurrentUser() : null;
		if (!user || user.level !== 4) {
			alert('Access denied. Only administrators can access bus management.');
			window.location.href = 'index.html';
			return false;
		}
		return true;
	}

	// Initialize Firebase if not already
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

	// Check admin access before proceeding
	if (!checkAdminAccess()) {
		return;
	}

	const database = firebase.database();
	const busesRef = database.ref('Buses');
	
	// Generate activity ID using bus ID + counter
	async function generateActivityId(activitiesRef, busId) {
		let baseActivityId = busId;
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

	const form = document.getElementById('bus-form');
	const hiddenId = document.getElementById('bus-id');
	const busNumber = document.getElementById('busNumber');
	const acquiredDate = document.getElementById('acquiredDate');
	const plateNumber = document.getElementById('plateNumber');
	const notes = document.getElementById('notes');
	const resetBtn = document.getElementById('reset-bus-form');

	const searchInput = document.getElementById('search-buses');
	const emptyState = document.getElementById('buses-empty-state');
	const tableContainer = document.getElementById('buses-table-container');
	const tableBody = document.getElementById('buses-table-body');

	// Pagination state
	let currentPage = 1;
	const itemsPerPage = 5;
	let totalPages = 1;

	function ensurePaginationControls() {
		let pagination = document.getElementById('buses-pagination');
		if (!pagination && tableContainer && tableContainer.parentNode) {
			pagination = document.createElement('div');
			pagination.id = 'buses-pagination';
			pagination.className = 'pagination-controls';
			pagination.innerHTML = `
				<button id="prev-page-buses" class="pagination-button" disabled>Previous</button>
				<span id="buses-page-info">Page 1 of 1</span>
				<button id="next-page-buses" class="pagination-button" disabled>Next</button>
			`;
			tableContainer.parentNode.insertBefore(pagination, tableContainer.nextSibling);
			const prev = document.getElementById('prev-page-buses');
			const next = document.getElementById('next-page-buses');
			prev.addEventListener('click', function() {
				if (currentPage > 1) {
					currentPage--;
					renderBuses(latest, searchInput.value);
				}
			});
			next.addEventListener('click', function() {
				if (currentPage < totalPages) {
					currentPage++;
					renderBuses(latest, searchInput.value);
				}
			});
		}
	}

	function validateForm() {
		if (!busNumber.value.trim()) return 'Bus number is required';
		if (!acquiredDate.value) return 'Acquired date is required';
		return '';
	}

	function clearForm() {
		hiddenId.value = '';
		form.reset();
	}

	function populateForm(bus) {
		hiddenId.value = bus.id;
		busNumber.value = bus.busNumber || '';
		acquiredDate.value = bus.acquiredDate || '';
		plateNumber.value = bus.plateNumber || '';
		notes.value = bus.notes || '';
		busNumber.focus();
	}

	function toArrayFromSnapshot(snapshot) {
		const list = [];
		snapshot.forEach(function(child){
			const val = child.val() || {};
			// Bus key is authoritative ID; ensure minimal shape
			list.push({
				id: child.key,
				busNumber: val.busNumber || child.key,
				plateNumber: val.plateNumber || '',
				acquiredDate: val.acquiredDate || '',
				notes: val.notes || ''
			});
		});
		return list;
	}

	function renderBuses(buses, filter = '') {
		const q = (filter || '').trim().toLowerCase();
		// Normalize and sort by busNumber (fallback to id)
		const normalized = buses.map(function(b){
			const busNumber = b.busNumber || b.id || '';
			return {
				id: b.id,
				busNumber: String(busNumber),
				plateNumber: b.plateNumber || '',
				acquiredDate: b.acquiredDate || '',
				notes: b.notes || ''
			};
		}).sort(function(a,b){
			return String(a.busNumber).localeCompare(String(b.busNumber), undefined, { numeric: true, sensitivity: 'base' });
		});

		const filtered = normalized.filter(b => {
			if (!q) return true;
			return (
				String(b.busNumber || '').toLowerCase().includes(q) ||
				String(b.plateNumber || '').toLowerCase().includes(q)
			);
		});

		// Pagination calculations
		totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
		if (currentPage > totalPages) currentPage = 1;
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = Math.min(startIndex + itemsPerPage, filtered.length);
		const pageItems = filtered.slice(startIndex, endIndex);

		tableBody.innerHTML = '';
		if (filtered.length === 0) {
			emptyState.style.display = 'flex';
			tableContainer.style.display = 'none';
			return;
		}

		emptyState.style.display = 'none';
		tableContainer.style.display = 'block';

		pageItems.forEach(bus => {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td data-label="Bus Number">${escapeHtml(bus.busNumber || '')}</td>
				<td data-label="Plate Number">${escapeHtml(bus.plateNumber || '')}</td>
				<td data-label="Acquired Date">${escapeHtml(bus.acquiredDate || '')}</td>
				<td data-label="Notes">${escapeHtml(bus.notes || '')}</td>
				<td data-label="Actions">
					<button class="action-btn view-btn" data-action="edit" data-id="${bus.id}"><i class="fas fa-edit"></i> Edit</button>
					<button class="action-btn danger" data-action="delete" data-id="${bus.id}"><i class="fas fa-trash"></i> Delete</button>
				</td>
			`;
			tableBody.appendChild(tr);
		});

		// Update pagination controls
		ensurePaginationControls();
		const prev = document.getElementById('prev-page-buses');
		const next = document.getElementById('next-page-buses');
		const info = document.getElementById('buses-page-info');
		if (prev && next && info) {
			info.textContent = `Page ${currentPage} of ${totalPages}`;
			prev.disabled = currentPage === 1;
			next.disabled = currentPage === totalPages;
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

	function escapeHtml(str) {
		str = String(str || '');
		return str.replace(/[&<>\"]+/g, function(s) {
			const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
			return map[s] || s;
		});
	}

	let latest = [];
	busesRef.on('value', function(snapshot) {
		latest = toArrayFromSnapshot(snapshot);
		// Reset filters and go to first page to show all buses by default
		currentPage = 1;
		if (searchInput) searchInput.value = '';
		renderBuses(latest, '');
	});

	// Initial skeletons on page load
	if (tableContainer) tableContainer.style.display = 'block';
	if (tableBody) renderSkeletonRows(tableBody, 5, 8);

	form.addEventListener('submit', function(e) {
		e.preventDefault();
		const error = validateForm();
		if (error) {
			alert(error);
			return;
		}

		const payload = {
			busNumber: busNumber.value.trim(),
			acquiredDate: acquiredDate.value, // yyyy-mm-dd
			plateNumber: plateNumber.value.trim(),
			notes: notes.value.trim()
		};

		const existingId = hiddenId.value;
		if (existingId) {
			// If the key (busNumber) changed, move the record to the new key
			if (existingId !== payload.busNumber) {
				// Ensure new busNumber doesn't already exist
				busesRef.child(payload.busNumber).once('value', function(existsSnap) {
					if (existsSnap.exists()) {
						alert('New bus number already exists. Please choose another.');
						return;
					}
					// Create under new key, then delete old key
					busesRef.child(payload.busNumber).set(payload, function(setErr) {
						if (setErr) {
							alert('Failed to update bus.');
							return;
						}
						busesRef.child(existingId).remove(function(removeErr) {
							if (removeErr) {
								alert('Updated, but failed to remove old record.');
								return;
							}
							clearForm();
						});
					});
				});
			} else {
				// Same key, simple overwrite
				busesRef.child(existingId).set(payload, function(err) {
					if (err) {
						alert('Failed to update bus.');
						return;
					}
					clearForm();
				});
			}
		} else {
			// Creating new bus with custom key equal to busNumber
			busesRef.child(payload.busNumber).once('value', async function(snap) {
				if (snap.exists()) {
					alert('Bus number already exists.');
					return;
				}
				busesRef.child(payload.busNumber).set(payload, async function(err) {
					if (err) {
						alert('Failed to save bus.');
						return;
					}
					
					// Save activity record
					try {
						const activitiesRef = database.ref('activities');
						const activityDescription = `Bus ${payload.busNumber} created`;
						
						// Generate activity ID using bus number + counter
						const activityId = await generateActivityId(activitiesRef, payload.busNumber);
						
						// Get current user information
						const userSession = sessionStorage.getItem('elavil_user');
						let createdBy = 'Unknown User';
						let createdByRole = 'Unknown Role';
						
						if (userSession) {
							try {
								const user = JSON.parse(userSession);
								createdBy = user.fullName || 'Unknown User';
								if (user.level === 4) {
									createdByRole = 'Administrator';
								} else {
									createdByRole = user.employeeType || 'Unknown Role';
								}
							} catch (e) {
								console.error('Error parsing user session:', e);
							}
						}
						
						const activityRecord = {
							time: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
							actType: 'Bus',
							description: activityDescription,
							user: createdBy,
							role: createdByRole
						};
						
						await activitiesRef.child(activityId).set(activityRecord);
					} catch (activityErr) {
						console.error('Failed to save activity record:', activityErr);
					}
					
					clearForm();
				});
			});
		}
	});

	resetBtn.addEventListener('click', function() {
		clearForm();
	});

	searchInput.addEventListener('input', function() {
		currentPage = 1;
		renderBuses(latest, searchInput.value);
	});

	tableBody.addEventListener('click', function(e) {
		const btn = e.target.closest('button[data-action]');
		if (!btn) return;
		const action = btn.getAttribute('data-action');
		const id = btn.getAttribute('data-id');

		if (action === 'edit') {
			const bus = latest.find(b => b.id === id);
			if (bus) populateForm(bus);
		} else if (action === 'delete') {
			if (!confirm('Are you sure you want to delete this bus?')) return;
			busesRef.child(id).remove(function(err) {
				if (err) alert('Failed to delete bus.');
			});
		}
	});
})();


