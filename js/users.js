(function() {
	// Check if user has admin access (level 4)
	function checkAdminAccess() {
		const user = window.ElavilAuth ? window.ElavilAuth.getCurrentUser() : null;
		if (!user || user.level !== 4) {
			alert('Access denied. Only administrators can access user management.');
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

	// Check admin access before proceeding
	if (!checkAdminAccess()) {
		return;
	}

	const database = firebase.database();
	const usersRef = database.ref('Users');
	const busesRef = database.ref('Buses');
	
	// Generate activity ID using user ID + counter
	async function generateActivityId(activitiesRef, userId) {
		let baseActivityId = userId;
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

	const form = document.getElementById('user-form');
	const hiddenId = document.getElementById('user-id');
	const fullName = document.getElementById('fullName');
	const username = document.getElementById('username');
	const password = document.getElementById('password');
	const contactNumber = document.getElementById('contactNumber');
	const address = document.getElementById('address');
	const birthdate = document.getElementById('birthdate');
	const age = document.getElementById('age');
	const employeeType = document.getElementById('employeeType');
	const assignedBus = document.getElementById('assignedBus');
	const assignedBusGroup = document.getElementById('assigned-bus-group');
	const resetBtn = document.getElementById('reset-form');

	const searchInput = document.getElementById('search-users');
	const emptyState = document.getElementById('users-empty-state');
	const tableContainer = document.getElementById('users-table-container');
	const tableBody = document.getElementById('users-table-body');

	// Pagination state
	let currentPage = 1;
	const itemsPerPage = 5;
	let totalPages = 1;

	function ensurePaginationControls() {
		let pagination = document.getElementById('users-pagination');
		if (!pagination && tableContainer && tableContainer.parentNode) {
			pagination = document.createElement('div');
			pagination.id = 'users-pagination';
			pagination.className = 'pagination-controls';
			pagination.innerHTML = `
				<button id="prev-page-users" class="pagination-button" disabled>Previous</button>
				<span id="users-page-info">Page 1 of 1</span>
				<button id="next-page-users" class="pagination-button" disabled>Next</button>
			`;
			tableContainer.parentNode.insertBefore(pagination, tableContainer.nextSibling);
			const prev = document.getElementById('prev-page-users');
			const next = document.getElementById('next-page-users');
			prev.addEventListener('click', function() {
				if (currentPage > 1) {
					currentPage--;
					renderUsersFromFirebase(latestUsers, searchInput.value);
				}
			});
			next.addEventListener('click', function() {
				if (currentPage < totalPages) {
					currentPage++;
					renderUsersFromFirebase(latestUsers, searchInput.value);
				}
			});
		}
	}

	function validateForm() {
		if (!fullName.value.trim()) return 'Full name is required';
		if (!username.value.trim()) return 'Username is required';
		if (!password.value.trim()) return 'Password is required';
		if (!contactNumber.value.trim()) return 'Contact number is required';
		if (!address.value.trim()) return 'Address is required';
		if (!birthdate.value) return 'Birthdate is required';
		const computed = computeAgeFromBirthdate(birthdate.value);
		if (computed < 18) return 'User must be at least 18 years old';
		if (!age.value || Number(age.value) !== computed) {
			age.value = computed;
		}
		if (!employeeType.value) return 'Employee type is required';
		const type = employeeType.value;
		if ((type === 'driver' || type === 'conductor') && !assignedBus.value) return 'Assigned bus is required for drivers and conductors';
		return '';
	}

	function computeAgeFromBirthdate(dateStr) {
		const dob = new Date(dateStr);
		if (Number.isNaN(dob.getTime())) return 0;
		const today = new Date();
		let years = today.getFullYear() - dob.getFullYear();
		const m = today.getMonth() - dob.getMonth();
		if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
			years--;
		}

		return years;
	}

	function clearForm() {
		hiddenId.value = '';
		form.reset();
		employeeType.selectedIndex = 0;
		if (assignedBus) assignedBus.value = '';
		if (assignedBusGroup) assignedBusGroup.style.display = 'none';
	}

	function populateForm(user) {
		hiddenId.value = user.id;
		fullName.value = user.fullName || '';
		username.value = user.username || '';
		password.value = user.password || '';
		contactNumber.value = user.contactNumber || '';
		address.value = user.address || '';
		birthdate.value = user.birthdate || '';
		age.value = user.age || (user.birthdate ? computeAgeFromBirthdate(user.birthdate) : '');
		employeeType.value = user.employeeType || '';
		const type = employeeType.value;
		if (type === 'driver' || type === 'conductor') {
			assignedBusGroup.style.display = 'block';
			assignedBus.value = user.assignedBus || '';
		} else {
			assignedBusGroup.style.display = 'none';
			assignedBus.value = '';
		}
		fullName.focus();
	}

	function toArrayFromSnapshot(snapshot) {
		const list = [];
		snapshot.forEach(child => {
			list.push({ id: child.key, ...child.val() });
		});
		return list;
	}

	function renderUsersFromFirebase(users, filterText = '') {
		const query = (filterText || '').trim().toLowerCase();
		const filtered = users.filter(u => {
			if (!query) return true;
			return (
				(u.fullName || '').toLowerCase().includes(query) ||
				(u.username || '').toLowerCase().includes(query) ||
				(u.employeeType || '').toLowerCase().includes(query) ||
				String(u.level || '').includes(query) ||
				(u.assignedBus || '').toLowerCase().includes(query)
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

		pageItems.forEach(user => {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td data-label="Full Name">${escapeHtml(user.fullName || '')}</td>
				<td data-label="Username">${escapeHtml(user.username || '')}</td>
				<td data-label="Contact">${escapeHtml(user.contactNumber || '')}</td>
				<td data-label="Address">${escapeHtml(user.address || '')}</td>
				<td data-label="Birthdate">${escapeHtml(String(user.birthdate || ''))}</td>
				<td data-label="Age">${escapeHtml(String(user.age || ''))}</td>
				<td data-label="Type">${escapeHtml(capitalize(user.employeeType || ''))}</td>
				<td data-label="Level">${escapeHtml(String(user.level || ''))}</td>
				<td data-label="Assigned Bus">${escapeHtml(String(user.assignedBus || 'N/A'))}</td>
				<td data-label="Actions">
					<button class="action-btn view-btn" data-action="edit" data-id="${user.id}"><i class="fas fa-edit"></i> Edit</button>
					<button class="action-btn danger" data-action="delete" data-id="${user.id}"><i class="fas fa-trash"></i> Delete</button>
				</td>
			`;
			tableBody.appendChild(tr);
		});

		// Update pagination controls
		ensurePaginationControls();
		const prev = document.getElementById('prev-page-users');
		const next = document.getElementById('next-page-users');
		const info = document.getElementById('users-page-info');
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
		return str.replace(/[&<>\"]+/g, function(s) {
			const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
			return map[s] || s;
		});
	}

	function capitalize(str) {
		return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
	}

	function computeLevelFromType(type) {
		if (type === 'driver' || type === 'conductor') return 1;
		if (type === 'mechanic') return 2;
		if (type === 'supervisor') return 3;
		return 0;
	}

	function generateRandomSixDigit() {
		return String(Math.floor(100000 + Math.random() * 900000));
	}

	function generateUniqueSixDigitId(callback) {
		function attempt() {
			const candidate = generateRandomSixDigit();
			usersRef.orderByChild('uniqueId').equalTo(candidate).once('value', function(snap) {
				if (snap.exists()) {
					// Collision, try again
					attempt();
				} else {
					callback(candidate);
				}
			});
		}
		attempt();
	}

	// Live subscription to Users node
	let latestUsers = [];
	usersRef.on('value', function(snapshot) {
		latestUsers = toArrayFromSnapshot(snapshot);
		renderUsersFromFirebase(latestUsers, searchInput.value);
	});

	// Initial skeletons on page load
	if (tableContainer) tableContainer.style.display = 'block';
	if (tableBody) renderSkeletonRows(tableBody, 10, 8);

	// Populate buses for assignment dropdown
	busesRef.on('value', function(snapshot) {
		if (!assignedBus) return;
		const previous = assignedBus.value;
		assignedBus.innerHTML = '<option value="" disabled selected>Select bus</option>';
		snapshot.forEach(function(child){
			const key = child.key;
			const opt = document.createElement('option');
			opt.value = key;
			opt.textContent = key;
			assignedBus.appendChild(opt);
		});
		if (previous) assignedBus.value = previous;
	});

	// Toggle assigned-bus visibility
	employeeType.addEventListener('change', function() {
		const type = employeeType.value;
		if (type === 'driver' || type === 'conductor') {
			assignedBusGroup.style.display = 'block';
		} else {
			assignedBusGroup.style.display = 'none';
			assignedBus.value = '';
		}
	});

	// Auto-compute age when birthdate changes
	birthdate.addEventListener('change', function() {
		const computed = computeAgeFromBirthdate(birthdate.value);
		age.value = computed > 0 ? computed : '';
	});

	form.addEventListener('submit', function(e) {
		e.preventDefault();
		const error = validateForm();
		if (error) {
			alert(error);
			return;
		}

		const computedLevel = computeLevelFromType(employeeType.value);
		const payload = {
			fullName: fullName.value.trim(),
			username: username.value.trim(),
			password: password.value, // Note: plaintext for demo only
			contactNumber: contactNumber.value.trim(),
			address: address.value.trim(),
			birthdate: birthdate.value,
			age: Number(age.value),
			employeeType: employeeType.value,
			level: computedLevel,
			assignedBus: (employeeType.value === 'driver' || employeeType.value === 'conductor') ? (assignedBus.value || '') : ''
		};

		const existingId = hiddenId.value;
		const original = latestUsers.find(function(u){ return u.id === existingId; }) || {};
		if (original.uniqueId) payload.uniqueId = original.uniqueId;

		function proceedWithSave() {
			// Enforce username as key
			usersRef.child(payload.username).once('value', function(usernameSnap) {
				const usernameExists = usernameSnap.exists();
				const isDifferentKey = existingId && existingId !== payload.username;
				const oldAssignedBus = original.assignedBus || '';
				const oldUsername = original.username || existingId;

				if (!existingId) {
					// Creating new
					if (usernameExists) {
						alert('Username already taken. Please choose another.');
						return;
					}
					usersRef.child(payload.username).set(payload, async function(err) {
						if (err) {
							alert('Failed to save user.');
							return;
						}
						if (payload.assignedBus) {
							busesRef.child(payload.assignedBus + '/AssignedPersonnel/' + payload.username).set(true);
						}
						
						// Save activity record
						try {
							const activitiesRef = database.ref('activities');
							const activityDescription = `User ${payload.fullName} created`;
							
							// Generate activity ID using username + counter
							const activityId = await generateActivityId(activitiesRef, payload.username);
							
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
								actType: 'User',
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
				} else {
					// Updating existing
					if (isDifferentKey) {
						if (usernameExists) {
							alert('New username already taken.');
							return;
						}
						// Write to new key then remove old
						usersRef.child(payload.username).set(payload, function(setErr) {
							if (setErr) {
								alert('Failed to update user.');
								return;
							}
							if (oldAssignedBus) {
								busesRef.child(oldAssignedBus + '/AssignedPersonnel/' + oldUsername).remove();
							}
							if (payload.assignedBus) {
								busesRef.child(payload.assignedBus + '/AssignedPersonnel/' + payload.username).set(true);
							}
							usersRef.child(existingId).remove(function(removeErr) {
								if (removeErr) {
									alert('Updated, but failed to remove old record.');
									return;
								}
								clearForm();
							});
						});
					} else {
						// Same key, simple overwrite
						usersRef.child(existingId).set(payload, function(err) {
							if (err) {
								alert('Failed to update user.');
								return;
							}
							if (oldAssignedBus && oldAssignedBus !== payload.assignedBus) {
								busesRef.child(oldAssignedBus + '/AssignedPersonnel/' + oldUsername).remove();
							}
							if (payload.assignedBus) {
								busesRef.child(payload.assignedBus + '/AssignedPersonnel/' + payload.username).set(true);
							}
							clearForm();
						});
					}
				}
			});
		}

		if (!payload.uniqueId) {
			generateUniqueSixDigitId(function(newId) {
				payload.uniqueId = newId;
				proceedWithSave();
			});
		} else {
			proceedWithSave();
		}
	});

	resetBtn.addEventListener('click', function() {
		clearForm();
	});

	searchInput.addEventListener('input', function() {
		currentPage = 1;
		renderUsersFromFirebase(latestUsers, searchInput.value);
	});

	tableBody.addEventListener('click', function(e) {
		const btn = e.target.closest('button[data-action]');
		if (!btn) return;
		const action = btn.getAttribute('data-action');
		const id = btn.getAttribute('data-id');

		if (action === 'edit') {
			const user = latestUsers.find(u => u.id === id);
			if (user) populateForm(user);
		} else if (action === 'delete') {
			if (!confirm('Are you sure you want to delete this user?')) return;
			const user = latestUsers.find(u => u.id === id) || {};
			if (user.assignedBus) {
				busesRef.child((user.assignedBus || '') + '/AssignedPersonnel/' + (user.username || id)).remove();
			}
			usersRef.child(id).remove(function(err) {
				if (err) alert('Failed to delete user.');
			});
		}
	});
})();

