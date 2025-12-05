// ============================================
// INVENTORY APP - MAIN APPLICATION
// ============================================
// NO NEED TO EDIT THIS FILE
// ============================================

// Application state
const AppState = {
    inventory: [],
    offlineQueue: [],
    isOnline: navigator.onLine,
    syncInProgress: false,
    lastSyncTime: null,
    adminMode: false,
    currentFilters: {
        location: '',
        group: '',
        search: ''
    }
};

// DOM Elements cache
const Elements = {
    // Form inputs
    nameInput: null,
    quantityInput: null,
    groupInput: null,
    detailsInput: null,
    locationInput: null,
    
    // Buttons
    addBtn: null,
    refreshBtn: null,
    toggleAdminBtn: null,
    deleteAllBtn: null,
    exportBtn: null,
    importBtn: null,
    importFile: null,
    changePasswordBtn: null,
    installBtn: null,
    offlineBtn: null,
    
    // UI Elements
    inventoryList: null,
    suggestions: null,
    syncStatus: null,
    adminPanel: null,
    deleteModal: null,
    confirmDeleteBtn: null,
    cancelDeleteBtn: null,
    confirmDeleteInput: null,
    
    // Filters
    filterLocation: null,
    filterGroup: null,
    searchInput: null,
    
    // Stats
    totalCount: null,
    pendingCount: null,
    lastSync: null,
    
    // Location buttons
    locationButtons: null
};

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    console.log('🚀 Inventory App Initializing...');
    
    // Cache DOM elements
    cacheElements();
    
    // Load data from localStorage
    loadLocalData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup service worker for offline
    setupServiceWorker();
    
    // Check install prompt
    setupInstallPrompt();
    
    // Initial UI update
    updateUI();
    
    // Try to sync if online
    if (AppState.isOnline) {
        await syncWithGitHub();
    } else {
        updateSyncStatus('🔴 OFFLINE - Working locally');
    }
    
    // Start auto-sync interval (every 2 minutes if online)
    setInterval(async () => {
        if (AppState.isOnline && !AppState.syncInProgress && AppState.offlineQueue.length > 0) {
            await syncWithGitHub();
        }
    }, 2 * 60 * 1000);
    
    console.log('✅ App initialized successfully');
}

function cacheElements() {
    // Form inputs
    Elements.nameInput = document.getElementById('nameInput');
    Elements.quantityInput = document.getElementById('quantityInput');
    Elements.groupInput = document.getElementById('groupInput');
    Elements.detailsInput = document.getElementById('detailsInput');
    Elements.locationInput = document.getElementById('locationInput');
    
    // Buttons
    Elements.addBtn = document.getElementById('addBtn');
    Elements.refreshBtn = document.getElementById('refreshBtn');
    Elements.toggleAdminBtn = document.getElementById('toggleAdminBtn');
    Elements.deleteAllBtn = document.getElementById('deleteAllBtn');
    Elements.exportBtn = document.getElementById('exportBtn');
    Elements.importBtn = document.getElementById('importBtn');
    Elements.importFile = document.getElementById('importFile');
    Elements.changePasswordBtn = document.getElementById('changePasswordBtn');
    Elements.installBtn = document.getElementById('installBtn');
    Elements.offlineBtn = document.getElementById('offlineBtn');
    
    // UI Elements
    Elements.inventoryList = document.getElementById('inventoryList');
    Elements.suggestions = document.getElementById('suggestions');
    Elements.syncStatus = document.getElementById('syncStatus');
    Elements.adminPanel = document.getElementById('adminPanel');
    Elements.deleteModal = document.getElementById('deleteModal');
    Elements.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    Elements.cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    Elements.confirmDeleteInput = document.getElementById('confirmDeleteInput');
    
    // Filters
    Elements.filterLocation = document.getElementById('filterLocation');
    Elements.filterGroup = document.getElementById('filterGroup');
    Elements.searchInput = document.getElementById('searchInput');
    
    // Stats
    Elements.totalCount = document.getElementById('totalCount');
    Elements.pendingCount = document.getElementById('pendingCount');
    Elements.lastSync = document.getElementById('lastSync');
    
    // Location buttons
    Elements.locationButtons = document.querySelectorAll('.location-btn');
}

// ============================================
// DATA MANAGEMENT
// ============================================

function loadLocalData() {
    // Load inventory from localStorage
    const savedInventory = localStorage.getItem('inventory_data');
    if (savedInventory) {
        try {
            AppState.inventory = JSON.parse(savedInventory);
            console.log(`📁 Loaded ${AppState.inventory.length} items from localStorage`);
        } catch (error) {
            console.error('Error parsing saved inventory:', error);
            AppState.inventory = [];
        }
    }
    
    // Load offline queue
    const savedQueue = localStorage.getItem('inventory_offline_queue');
    if (savedQueue) {
        try {
            AppState.offlineQueue = JSON.parse(savedQueue);
            console.log(`📦 Loaded ${AppState.offlineQueue.length} items in offline queue`);
        } catch (error) {
            console.error('Error parsing offline queue:', error);
            AppState.offlineQueue = [];
        }
    }
    
    // Load last sync time
    AppState.lastSyncTime = localStorage.getItem('last_sync_time');
}

function saveLocalData() {
    // Save inventory to localStorage
    localStorage.setItem('inventory_data', JSON.stringify(AppState.inventory));
    
    // Save offline queue
    localStorage.setItem('inventory_offline_queue', JSON.stringify(AppState.offlineQueue));
    
    // Save last sync time
    if (AppState.lastSyncTime) {
        localStorage.setItem('last_sync_time', AppState.lastSyncTime);
    }
}

// ============================================
// SYNC FUNCTIONS
// ============================================

async function syncWithGitHub() {
    if (AppState.syncInProgress || !AppState.isOnline) {
        return;
    }
    
    AppState.syncInProgress = true;
    updateSyncStatus('🔄 Syncing with GitHub...');
    
    try {
        // Step 1: Push offline changes to GitHub
        if (AppState.offlineQueue.length > 0) {
            console.log(`📤 Pushing ${AppState.offlineQueue.length} offline items to GitHub...`);
            
            await gitHubDB.bulkSync(AppState.offlineQueue);
            
            // Clear offline queue
            AppState.offlineQueue = [];
            saveLocalData();
            
            console.log('✅ Offline items synced to GitHub');
        }
        
        // Step 2: Pull latest from GitHub
        console.log('📥 Pulling latest data from GitHub...');
        const remoteData = await gitHubDB.readAll();
        
        // Step 3: Merge data (GitHub wins conflicts)
        mergeData(remoteData);
        
        // Step 4: Save locally
        saveLocalData();
        
        // Update sync time
        AppState.lastSyncTime = new Date().toISOString();
        
        // Update UI
        updateUI();
        updateSyncStatus('✅ Synced with GitHub!');
        
        console.log('✅ Sync completed successfully');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
            updateSyncStatus('🟢 Online - GitHub Synced');
        }, 3000);
        
    } catch (error) {
        console.error('❌ Sync failed:', error);
        updateSyncStatus('❌ Sync failed - Using local data');
        
        // Show error to user
        setTimeout(() => {
            updateSyncStatus('🟡 Online - Sync issues');
        }, 5000);
    } finally {
        AppState.syncInProgress = false;
    }
}

function mergeData(remoteData) {
    console.log('🔄 Merging local and remote data...');
    
    // Create a map of remote items by ID for quick lookup
    const remoteMap = new Map();
    remoteData.forEach(item => {
        if (item.id) {
            remoteMap.set(item.id, item);
        }
    });
    
    // Process local inventory
    const mergedInventory = [];
    const seenIds = new Set();
    
    // First, add all remote items (GitHub is source of truth)
    remoteData.forEach(item => {
        if (item.id && !seenIds.has(item.id)) {
            mergedInventory.push(item);
            seenIds.add(item.id);
        }
    });
    
    // Then add local unsynced items that don't exist remotely
    AppState.inventory.forEach(item => {
        if (item.id && !item.synced && !seenIds.has(item.id)) {
            mergedInventory.push(item);
            seenIds.add(item.id);
        }
    });
    
    // Update app state
    AppState.inventory = mergedInventory;
    console.log(`✅ Merged: ${mergedInventory.length} total items`);
}

// ============================================
// CORE APP FUNCTIONS
// ============================================

async function addNewItem() {
    // Get form values
    const name = Elements.nameInput.value.trim().toUpperCase();
    const quantity = parseInt(Elements.quantityInput.value) || 0;
    const group = Elements.groupInput.value;
    const details = Elements.detailsInput.value.trim().toUpperCase();
    const location = Elements.locationInput.value;
    
    // Validation
    if (!name) {
        showMessage('Please enter an item name', 'error');
        Elements.nameInput.focus();
        return;
    }
    
    if (!quantity || quantity < 0) {
        showMessage('Please enter a valid quantity', 'error');
        Elements.quantityInput.focus();
        return;
    }
    
    if (!group) {
        showMessage('Please select a group', 'error');
        Elements.groupInput.focus();
        return;
    }
    
    if (!location) {
        showMessage('Please select a location', 'error');
        return;
    }
    
    // Create item object
    const newItem = {
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        NAME: name,
        QUANTITY: quantity,
        GROUP: group,
        ITEM_DETAILS: details,
        LOCATION: location,
        TIMESTAMP: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: false,
        pendingSync: true
    };
    
    // Add to local inventory (at the beginning)
    AppState.inventory.unshift(newItem);
    
    // Clear form
    Elements.nameInput.value = '';
    Elements.quantityInput.value = '';
    Elements.detailsInput.value = '';
    Elements.nameInput.focus();
    
    // Hide suggestions if visible
    Elements.suggestions.style.display = 'none';
    
    // Save locally
    saveLocalData();
    
    // Update UI
    updateInventoryList();
    updateStats();
    
    // Handle sync
    if (AppState.isOnline) {
        // Try to sync immediately
        try {
            await gitHubDB.bulkSync([newItem]);
            
            // Update item status
            const index = AppState.inventory.findIndex(item => item.id === newItem.id);
            if (index !== -1) {
                AppState.inventory[index].synced = true;
                AppState.inventory[index].pendingSync = false;
                saveLocalData();
                updateInventoryList();
            }
            
            showMessage('✅ Item added and synced to GitHub!', 'success');
        } catch (error) {
            console.warn('Failed to sync immediately:', error);
            
            // Add to offline queue
            AppState.offlineQueue.push(newItem);
            saveLocalData();
            
            showMessage('📱 Item added locally (will sync when online)', 'warning');
        }
    } else {
        // Offline mode - add to queue
        AppState.offlineQueue.push(newItem);
        saveLocalData();
        
        showMessage('📴 Item saved offline (will sync when back online)', 'warning');
    }
    
    updateSyncStatus();
}

function searchSuggestions() {
    const searchTerm = Elements.nameInput.value.toUpperCase().trim();
    
    if (searchTerm.length < 2) {
        Elements.suggestions.style.display = 'none';
        return;
    }
    
    // Filter existing items
    const matches = AppState.inventory.filter(item => 
        item.NAME && item.NAME.includes(searchTerm)
    ).slice(0, 5); // Limit to 5 suggestions
    
    if (matches.length === 0) {
        Elements.suggestions.style.display = 'none';
        return;
    }
    
    // Show suggestions
    Elements.suggestions.innerHTML = matches.map(item => `
        <div class="suggestion-item" data-id="${item.id}">
            <strong>${item.NAME}</strong><br>
            <small>Group: ${item.GROUP} | Qty: ${item.QUANTITY} | Location: ${item.LOCATION}</small>
        </div>
    `).join('');
    
    Elements.suggestions.style.display = 'block';
    
    // Add click handlers
    document.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            const selectedId = item.dataset.id;
            const selected = AppState.inventory.find(i => i.id === selectedId);
            
            if (selected) {
                // Fill form with selected item
                Elements.nameInput.value = selected.NAME;
                Elements.quantityInput.value = selected.QUANTITY;
                Elements.groupInput.value = selected.GROUP;
                Elements.detailsInput.value = selected.ITEM_DETAILS || '';
                Elements.locationInput.value = selected.LOCATION;
                
                // Update location buttons
                updateLocationButtons(selected.LOCATION);
                
                // Hide suggestions
                Elements.suggestions.style.display = 'none';
                
                // Focus quantity for easy editing
                Elements.quantityInput.focus();
                Elements.quantityInput.select();
            }
        });
    });
}

function updateLocationButtons(selectedLocation) {
    Elements.locationButtons.forEach(button => {
        if (button.dataset.location === selectedLocation) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    updateInventoryList();
    updateStats();
    updateSyncDisplay();
}

function updateInventoryList() {
    const container = Elements.inventoryList;
    
    if (!container) return;
    
    // Apply filters
    let filteredItems = [...AppState.inventory];
    
    // Filter by location
    if (AppState.currentFilters.location) {
        filteredItems = filteredItems.filter(item => 
            item.LOCATION === AppState.currentFilters.location
        );
    }
    
    // Filter by group
    if (AppState.currentFilters.group) {
        filteredItems = filteredItems.filter(item => 
            item.GROUP === AppState.currentFilters.group
        );
    }
    
    // Filter by search
    if (AppState.currentFilters.search) {
        const searchTerm = AppState.currentFilters.search.toUpperCase();
        filteredItems = filteredItems.filter(item => 
            item.NAME.includes(searchTerm) || 
            (item.ITEM_DETAILS && item.ITEM_DETAILS.includes(searchTerm))
        );
    }
    
    // Update count
    Elements.totalCount.textContent = `${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''}`;
    
    // If no items
    if (filteredItems.length === 0) {
        const noResultsText = AppState.inventory.length === 0 
            ? 'No inventory items yet. Add your first item above!' 
            : 'No items match your filters. Try changing them.';
        
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>${noResultsText}</p>
            </div>
        `;
        return;
    }
    
    // Generate HTML for items
    container.innerHTML = filteredItems.map(item => `
        <div class="inventory-item ${item.pendingSync ? 'pending' : ''}" data-id="${item.id}">
            <div class="item-header">
                <h3>${item.NAME}</h3>
                <span class="item-quantity">${item.QUANTITY} units</span>
            </div>
            
            <div class="item-meta">
                <span class="meta-tag group">${item.GROUP}</span>
                <span class="meta-tag location">📍 ${item.LOCATION}</span>
                ${item.pendingSync ? '<span class="meta-tag pending">⏳ Pending Sync</span>' : ''}
                ${item.id.startsWith('local_') ? '<span class="meta-tag local">📱 Local Only</span>' : ''}
            </div>
            
            ${item.ITEM_DETAILS ? `
                <div class="item-details">
                    ${item.ITEM_DETAILS}
                </div>
            ` : ''}
            
            <div class="item-footer">
                <div class="item-timestamp">
                    Added: ${formatDate(item.createdAt)}
                    ${item.updatedAt !== item.createdAt ? ` (updated: ${formatDate(item.updatedAt)})` : ''}
                </div>
                <div class="item-actions">
                    <button class="edit-btn" onclick="editItem('${item.id}')">✏️ Edit</button>
                    <button class="delete-btn" onclick="deleteItem('${item.id}')">🗑️ Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    // Update total count
    const totalItems = AppState.inventory.length;
    Elements.totalCount.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
    
    // Update pending count
    const pendingItems = AppState.inventory.filter(item => item.pendingSync).length;
    Elements.pendingCount.textContent = `${pendingItems} pending sync`;
    
    // Show/hide pending badge
    if (pendingItems > 0) {
        Elements.pendingCount.classList.remove('hidden');
    } else {
        Elements.pendingCount.classList.add('hidden');
    }
}

function updateSyncDisplay() {
    // Update last sync time
    if (AppState.lastSyncTime) {
        Elements.lastSync.textContent = `Last sync: ${formatTimeAgo(AppState.lastSyncTime)}`;
    } else {
        Elements.lastSync.textContent = 'Last sync: Never';
    }
    
    // Update offline button
    const offlineIcon = document.getElementById('offlineIcon');
    const offlineText = document.getElementById('offlineText');
    
    if (AppState.isOnline) {
        offlineIcon.textContent = '📶';
        offlineText.textContent = 'Online';
        offlineIcon.style.color = '';
    } else {
        offlineIcon.textContent = '📴';
        offlineText.textContent = 'Offline';
        offlineIcon.style.color = '#ef4444';
    }
}

function updateSyncStatus(message) {
    if (message) {
        Elements.syncStatus.innerHTML = `<span>${message}</span>`;
        return;
    }
    
    if (!AppState.isOnline) {
        Elements.syncStatus.innerHTML = `<span>🔴 OFFLINE (${AppState.offlineQueue.length} pending)</span>`;
    } else if (AppState.offlineQueue.length > 0 || AppState.inventory.some(item => item.pendingSync)) {
        const pending = AppState.offlineQueue.length + AppState.inventory.filter(item => item.pendingSync).length;
        Elements.syncStatus.innerHTML = `<span>🟡 ${pending} CHANGES PENDING SYNC</span>`;
    } else {
        Elements.syncStatus.innerHTML = `<span>🟢 ONLINE - READY</span>`;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Form submission
    Elements.addBtn.addEventListener('click', addNewItem);
    
    // Enter key in name field
    Elements.nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNewItem();
        }
    });
    
    // Type-ahead suggestions
    Elements.nameInput.addEventListener('input', searchSuggestions);
    
    // Location buttons
    Elements.locationButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update all buttons
            Elements.locationButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update hidden input
            Elements.locationInput.value = button.dataset.location;
        });
    });
    
    // Filters
    Elements.filterLocation.addEventListener('change', (e) => {
        AppState.currentFilters.location = e.target.value;
        updateInventoryList();
    });
    
    Elements.filterGroup.addEventListener('change', (e) => {
        AppState.currentFilters.group = e.target.value;
        updateInventoryList();
    });
    
    Elements.searchInput.addEventListener('input', (e) => {
        AppState.currentFilters.search = e.target.value;
        updateInventoryList();
    });
    
    // Refresh button
    Elements.refreshBtn.addEventListener('click', async () => {
        if (AppState.isOnline) {
            await syncWithGitHub();
        } else {
            updateUI();
            showMessage('Refreshed local data', 'info');
        }
    });
    
    // Admin toggle
    Elements.toggleAdminBtn.addEventListener('click', toggleAdminMode);
    
    // Delete all button
    Elements.deleteAllBtn.addEventListener('click', showDeleteModal);
    
    // Delete modal
    Elements.cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    Elements.confirmDeleteInput.addEventListener('input', (e) => {
        Elements.confirmDeleteBtn.disabled = e.target.value !== 'DELETE ALL';
    });
    Elements.confirmDeleteBtn.addEventListener('click', confirmDeleteAll);
    
    // Export button
    Elements.exportBtn.addEventListener('click', exportData);
    
    // Import button
    Elements.importBtn.addEventListener('click', () => Elements.importFile.click());
    Elements.importFile.addEventListener('change', importData);
    
    // Change password button
    Elements.changePasswordBtn.addEventListener('click', changeAdminPassword);
    
    // Install button
    if (Elements.installBtn) {
        Elements.installBtn.addEventListener('click', installApp);
    }
    
    // Offline button
    Elements.offlineBtn.addEventListener('click', () => {
        if (AppState.isOnline) {
            showMessage('You are currently online', 'info');
        } else {
            showMessage('You are offline. Data will sync when back online.', 'warning');
        }
    });
    
    // Online/offline detection
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.form-group')) {
            Elements.suggestions.style.display = 'none';
        }
    });
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

function toggleAdminMode() {
    const password = prompt('Enter admin password:');
    
    if (password === GITHUB_CONFIG.ADMIN_PASSWORD) {
        AppState.adminMode = !AppState.adminMode;
        Elements.adminPanel.classList.toggle('hidden');
        
        if (AppState.adminMode) {
            showMessage('👑 Admin mode enabled', 'success');
        } else {
            showMessage('Admin mode disabled', 'info');
        }
    } else if (password) {
        showMessage('Incorrect password', 'error');
    }
}

function showDeleteModal() {
    Elements.deleteModal.classList.remove('hidden');
    Elements.confirmDeleteInput.value = '';
    Elements.confirmDeleteBtn.disabled = true;
    Elements.confirmDeleteInput.focus();
}

function hideDeleteModal() {
    Elements.deleteModal.classList.add('hidden');
}

async function confirmDeleteAll() {
    hideDeleteModal();
    
    try {
        // Clear from GitHub
        if (AppState.isOnline) {
            await gitHubDB.deleteAllItems();
        }
        
        // Clear local data
        AppState.inventory = [];
        AppState.offlineQueue = [];
        saveLocalData();
        
        // Update UI
        updateUI();
        updateSyncStatus();
        
        showMessage('✅ All inventory data deleted from everywhere', 'success');
    } catch (error) {
        showMessage('❌ Failed to delete from GitHub. Local data cleared.', 'error');
        
        // Still clear local
        AppState.inventory = [];
        AppState.offlineQueue = [];
        saveLocalData();
        updateUI();
    }
}

async function exportData() {
    try {
        const backup = await gitHubDB.createBackup();
        const blob = new Blob([backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        showMessage('✅ Backup exported successfully', 'success');
    } catch (error) {
        showMessage('❌ Failed to export backup', 'error');
    }
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!confirm('Import will replace ALL current data. Continue?')) {
        event.target.value = '';
        return;
    }
    
    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const count = await gitHubDB.restoreFromBackup(e.target.result);
                
                // Refresh data
                if (AppState.isOnline) {
                    await syncWithGitHub();
                } else {
                    // Just update local cache
                    const remoteData = await gitHubDB.readAll();
                    mergeData(remoteData);
                    saveLocalData();
                    updateUI();
                }
                
                showMessage(`✅ Successfully imported ${count} items`, 'success');
            } catch (error) {
                showMessage(`❌ Import failed: ${error.message}`, 'error');
            }
        };
        reader.readAsText(file);
    } catch (error) {
        showMessage('❌ Failed to read file', 'error');
    }
    
    // Reset file input
    event.target.value = '';
}

function changeAdminPassword() {
    const currentPassword = Elements.adminPassword.value;
    
    if (currentPassword !== GITHUB_CONFIG.ADMIN_PASSWORD) {
        showMessage('Current password is incorrect', 'error');
        return;
    }
    
    const newPassword = prompt('Enter new admin password:');
    if (!newPassword || newPassword.length < 4) {
        showMessage('Password must be at least 4 characters', 'error');
        return;
    }
    
    const confirmPassword = prompt('Confirm new password:');
    if (newPassword !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }
    
    // In a real app, you'd save this somewhere secure
    // For now, we'll just update the config (note: this only affects current session)
    GITHUB_CONFIG.ADMIN_PASSWORD = newPassword;
    Elements.adminPassword.value = newPassword;
    
    showMessage('✅ Admin password changed (refresh will reset)', 'success');
}

// ============================================
// ITEM OPERATIONS
// ============================================

async function editItem(itemId) {
    const item = AppState.inventory.find(i => i.id === itemId);
    if (!item) return;
    
    // For now, we'll just delete and re-add with editing
    // In a full implementation, you'd have a proper edit form
    
    if (confirm(`Edit "${item.NAME}"? Currently ${item.QUANTITY} units.`)) {
        const newQuantity = prompt('Enter new quantity:', item.QUANTITY);
        if (newQuantity !== null) {
            const quantity = parseInt(newQuantity);
            if (!isNaN(quantity) && quantity >= 0) {
                // Update item
                item.QUANTITY = quantity;
                item.updatedAt = new Date().toISOString();
                item.synced = false;
                item.pendingSync = true;
                
                // Save
                saveLocalData();
                
                // Add to offline queue if not already there
                if (!AppState.offlineQueue.some(i => i.id === itemId)) {
                    AppState.offlineQueue.push(item);
                    saveLocalData();
                }
                
                // Update UI
                updateUI();
                updateSyncStatus();
                
                showMessage('✅ Item updated (will sync)', 'success');
            } else {
                showMessage('Invalid quantity', 'error');
            }
        }
    }
}

async function deleteItem(itemId) {
    const item = AppState.inventory.find(i => i.id === itemId);
    if (!item) return;
    
    if (!confirm(`Delete "${item.NAME}" from inventory?`)) {
        return;
    }
    
    // Remove from local inventory
    AppState.inventory = AppState.inventory.filter(i => i.id !== itemId);
    
    // If item was synced, add to deletion queue
    if (item.synced) {
        AppState.offlineQueue.push({
            id: itemId,
            _delete: true,
            NAME: item.NAME,
            synced: false
        });
    }
    
    // Save
    saveLocalData();
    
    // Update UI
    updateUI();
    updateSyncStatus();
    
    showMessage('✅ Item deleted', 'success');
}

// ============================================
// NETWORK HANDLING
// ============================================

async function handleOnline() {
    console.log('🌐 Device is online');
    AppState.isOnline = true;
    updateSyncStatus();
    updateSyncDisplay();
    
    // Wait a moment for network stability
    setTimeout(async () => {
        await syncWithGitHub();
    }, 2000);
}

function handleOffline() {
    console.log('📴 Device is offline');
    AppState.isOnline = false;
    updateSyncStatus();
    updateSyncDisplay();
    showMessage('You are now offline. Changes will sync when back online.', 'warning');
}

// ============================================
// PWA / SERVICE WORKER
// ============================================

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ Service Worker registered:', registration.scope);
            })
            .catch(error => {
                console.log('❌ Service Worker registration failed:', error);
            });
    }
}

function setupInstallPrompt() {
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        
        // Show install button
        if (Elements.installBtn) {
            Elements.installBtn.classList.remove('hidden');
        }
    });
    
    // When user clicks install button
    window.installApp = async () => {
        if (!deferredPrompt) return;
        
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        
        console.log(`User ${outcome} the install prompt`);
        
        // Hide the install button
        if (Elements.installBtn) {
            Elements.installBtn.classList.add('hidden');
        }
        
        // Clear the saved prompt since it can only be used once
        deferredPrompt = null;
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
}

function showMessage(message, type = 'info') {
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.innerHTML = `
        <span>${message}</span>
        <button class="message-close">&times;</button>
    `;
    
    // Add styles
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Add close button styles
    const closeBtn = messageEl.querySelector('.message-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        margin: 0;
        line-height: 1;
    `;
    
    // Add keyframe animation
    if (!document.querySelector('#message-animations')) {
        const style = document.createElement('style');
        style.id = 'message-animations';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to document
    document.body.appendChild(messageEl);
    
    // Close on button click
    closeBtn.addEventListener('click', () => {
        messageEl.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 300);
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }
    }, 5000);
}

// ============================================
// START THE APP
// ============================================

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', init);

// Make functions available globally for HTML onclick attributes
window.editItem = editItem;
window.deleteItem = deleteItem;
window.installApp = installApp;

console.log('📦 Inventory App loaded successfully!');
