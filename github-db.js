// ============================================
// GITHUB DATABASE CONFIGURATION
// ============================================
// REPLACE THESE VALUES WITH YOUR OWN!
// ============================================

const GITHUB_CONFIG = {
    // Your GitHub username (not email)
    USERNAME: 'unique205',
    
    // The token you generated in Step 4
    TOKEN: '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',
    
    // Repository names (exactly as you created)
    DATA_REPO: 'inventory-data',      // Repository for storing data
    APP_REPO: 'inventory-app',        // Repository for the app
    
    // File path in the data repository
    DATA_FILE: 'data/inventory.json',
    
    // Branch name (usually 'main' or 'master')
    BRANCH: 'main',
    
    // Admin password (change this!)
    ADMIN_PASSWORD: 'admin123'
};

// ============================================
// DON'T EDIT BELOW THIS LINE UNLESS YOU KNOW
// ============================================

class GitHubDatabase {
    constructor() {
        this.baseURL = 'https://api.github.com';
        this.currentSHA = null;
        this.headers = {
            'Authorization': `token ${GITHUB_CONFIG.TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    // ========== UTILITY FUNCTIONS ==========
    
    log(message, type = 'info') {
        const colors = {
            info: 'color: #2563eb',
            success: 'color: #10b981',
            error: 'color: #ef4444',
            warning: 'color: #f59e0b'
        };
        console.log(`%c[GitHubDB] ${message}`, colors[type]);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========== CORE DATABASE FUNCTIONS ==========
    
    async getFileSHA() {
        const url = `${this.baseURL}/repos/${GITHUB_CONFIG.USERNAME}/${GITHUB_CONFIG.DATA_REPO}/contents/${GITHUB_CONFIG.DATA_FILE}?ref=${GITHUB_CONFIG.BRANCH}`;
        
        try {
            const response = await fetch(url, { headers: this.headers });
            
            if (response.status === 404) {
                this.log('Data file not found (first time setup)', 'warning');
                return null;
            }
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            
            const data = await response.json();
            this.currentSHA = data.sha;
            return data.sha;
        } catch (error) {
            this.log(`Failed to get file SHA: ${error.message}`, 'error');
            return null;
        }
    }

    async readAll() {
        const url = `${this.baseURL}/repos/${GITHUB_CONFIG.USERNAME}/${GITHUB_CONFIG.DATA_REPO}/contents/${GITHUB_CONFIG.DATA_FILE}?ref=${GITHUB_CONFIG.BRANCH}`;
        
        try {
            const response = await fetch(url, { headers: this.headers });
            
            if (response.status === 404) {
                this.log('No data file found, returning empty array', 'warning');
                return [];
            }
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            
            const data = await response.json();
            this.currentSHA = data.sha;
            
            // Decode base64 content
            const content = atob(data.content.replace(/\n/g, ''));
            
            try {
                const parsed = JSON.parse(content);
                this.log(`Read ${parsed.length} items from GitHub`, 'success');
                return parsed;
            } catch (parseError) {
                this.log('Invalid JSON in data file', 'error');
                return [];
            }
        } catch (error) {
            this.log(`Failed to read data: ${error.message}`, 'error');
            throw error;
        }
    }

    async writeAll(data) {
        // Get current SHA first
        const sha = this.currentSHA || await this.getFileSHA();
        
        const url = `${this.baseURL}/repos/${GITHUB_CONFIG.USERNAME}/${GITHUB_CONFIG.DATA_REPO}/contents/${GITHUB_CONFIG.DATA_FILE}`;
        
        // Convert data to pretty JSON with 2-space indentation
        const jsonString = JSON.stringify(data, null, 2);
        const content = btoa(unescape(encodeURIComponent(jsonString)));
        
        const body = {
            message: `📦 Inventory update ${new Date().toLocaleString()}`,
            content: content,
            branch: GITHUB_CONFIG.BRANCH
        };
        
        if (sha) {
            body.sha = sha;
        }
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.headers,
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
            }
            
            const result = await response.json();
            this.currentSHA = result.content.sha;
            
            this.log(`Successfully wrote ${data.length} items to GitHub`, 'success');
            return result;
        } catch (error) {
            this.log(`Failed to write data: ${error.message}`, 'error');
            throw error;
        }
    }

    // ========== ITEM OPERATIONS ==========
    
    async addItem(item) {
        const allData = await this.readAll();
        
        // Generate unique ID
        item.id = this.generateId();
        item.createdAt = new Date().toISOString();
        item.updatedAt = item.createdAt;
        item.synced = true;
        item.pendingSync = false;
        
        // Add to array
        allData.unshift(item); // Add to beginning
        
        // Write back
        await this.writeAll(allData);
        
        return item;
    }

    async updateItem(id, updates) {
        const allData = await this.readAll();
        const index = allData.findIndex(item => item.id === id);
        
        if (index === -1) {
            throw new Error(`Item with ID ${id} not found`);
        }
        
        // Preserve important fields
        allData[index] = {
            ...allData[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        await this.writeAll(allData);
        
        return allData[index];
    }

    async deleteItem(id) {
        const allData = await this.readAll();
        const index = allData.findIndex(item => item.id === id);
        
        if (index === -1) {
            throw new Error(`Item with ID ${id} not found`);
        }
        
        allData.splice(index, 1);
        await this.writeAll(allData);
        
        return true;
    }

    async deleteAllItems() {
        await this.writeAll([]);
        this.log('All items deleted from GitHub', 'warning');
        return true;
    }

    // ========== BATCH OPERATIONS (For Offline Sync) ==========
    
    async bulkSync(items) {
        if (!items || items.length === 0) {
            return [];
        }
        
        this.log(`Syncing ${items.length} items to GitHub...`, 'info');
        
        const allData = await this.readAll();
        const newItems = [];
        const updatedItems = [];
        
        items.forEach(item => {
            const existingIndex = allData.findIndex(existing => existing.id === item.id);
            
            if (existingIndex === -1) {
                // New item
                const newItem = {
                    ...item,
                    synced: true,
                    pendingSync: false,
                    updatedAt: new Date().toISOString()
                };
                
                if (!newItem.createdAt) {
                    newItem.createdAt = newItem.updatedAt;
                }
                
                allData.unshift(newItem);
                newItems.push(newItem);
            } else {
                // Update existing
                allData[existingIndex] = {
                    ...allData[existingIndex],
                    ...item,
                    synced: true,
                    pendingSync: false,
                    updatedAt: new Date().toISOString()
                };
                updatedItems.push(allData[existingIndex]);
            }
        });
        
        await this.writeAll(allData);
        
        this.log(`Sync complete: ${newItems.length} new, ${updatedItems.length} updated`, 'success');
        return { newItems, updatedItems, allData };
    }

    // ========== SEARCH FUNCTIONS ==========
    
    async searchByName(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }
        
        const allData = await this.readAll();
        const term = searchTerm.toUpperCase();
        
        return allData.filter(item => 
            item.NAME && item.NAME.includes(term)
        ).slice(0, 10); // Limit to 10 results
    }

    async getStats() {
        const allData = await this.readAll();
        
        const stats = {
            total: allData.length,
            byLocation: {},
            byGroup: {},
            pendingSync: allData.filter(item => item.pendingSync).length,
            lastUpdated: allData.length > 0 
                ? Math.max(...allData.map(item => new Date(item.updatedAt).getTime()))
                : null
        };
        
        allData.forEach(item => {
            // Count by location
            stats.byLocation[item.LOCATION] = (stats.byLocation[item.LOCATION] || 0) + 1;
            
            // Count by group
            stats.byGroup[item.GROUP] = (stats.byGroup[item.GROUP] || 0) + 1;
        });
        
        return stats;
    }

    // ========== BACKUP & RESTORE ==========
    
    async createBackup() {
        const data = await this.readAll();
        const backup = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            itemCount: data.length,
            data: data
        };
        
        return JSON.stringify(backup, null, 2);
    }

    async restoreFromBackup(backupData) {
        try {
            const backup = JSON.parse(backupData);
            
            if (!backup.data || !Array.isArray(backup.data)) {
                throw new Error('Invalid backup format');
            }
            
            // Validate each item has required fields
            const validItems = backup.data.filter(item => 
                item.NAME && item.QUANTITY !== undefined && item.GROUP && item.LOCATION
            );
            
            this.log(`Restoring ${validItems.length} valid items from backup`, 'info');
            
            await this.writeAll(validItems);
            
            return validItems.length;
        } catch (error) {
            this.log(`Backup restore failed: ${error.message}`, 'error');
            throw error;
        }
    }

    // ========== HELPER FUNCTIONS ==========
    
    generateId() {
        return 'item_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    validateItem(item) {
        const errors = [];
        
        if (!item.NAME || item.NAME.trim().length === 0) {
            errors.push('NAME is required');
        }
        
        if (item.QUANTITY === undefined || item.QUANTITY === null) {
            errors.push('QUANTITY is required');
        } else if (typeof item.QUANTITY !== 'number') {
            errors.push('QUANTITY must be a number');
        } else if (item.QUANTITY < 0) {
            errors.push('QUANTITY cannot be negative');
        }
        
        if (!item.GROUP || item.GROUP.trim().length === 0) {
            errors.push('GROUP is required');
        }
        
        if (!item.LOCATION || item.LOCATION.trim().length === 0) {
            errors.push('LOCATION is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // ========== INITIALIZATION ==========
    
    async initialize() {
        this.log('Initializing GitHub Database...', 'info');
        
        try {
            // Test connection
            await this.getFileSHA();
            
            // Try to read data (creates file if doesn't exist)
            const data = await this.readAll();
            
            this.log('GitHub Database initialized successfully', 'success');
            return {
                success: true,
                itemCount: data.length,
                username: GITHUB_CONFIG.USERNAME
            };
        } catch (error) {
            this.log(`Initialization failed: ${error.message}`, 'error');
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// ============================================
// CREATE GLOBAL INSTANCE
// ============================================

const gitHubDB = new GitHubDatabase();

// ============================================
// EXPORT FOR USE IN OTHER FILES
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { gitHubDB, GITHUB_CONFIG };
}
