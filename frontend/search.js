// API Base URL - adjust if needed
const API_BASE_URL = window.location.origin;

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add enter key support for search
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Load example search on page load
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query) {
        document.getElementById('searchInput').value = query;
        performSearch();
    }
});

/**
 * Perform a semantic search using the API
 */
async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const resultCount = document.getElementById('resultCount');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultsContainer = document.getElementById('resultsContainer');
    
    const query = searchInput.value.trim();
    
    if (!query) {
        showError('Please enter a search query');
        return;
    }
    
    // Show loading indicator
    loadingIndicator.style.display = 'block';
    resultsContainer.innerHTML = '';
    
    try {
        const k = resultCount.value;
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&k=${k}`);
        
        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }
        
        const results = await response.json();
        
        // Hide loading indicator
        loadingIndicator.style.display = 'none';
        
        // Display results
        displayResults(results, query);
        
    } catch (error) {
        loadingIndicator.style.display = 'none';
        showError(`Error performing search: ${error.message}`);
    }
}

/**
 * Display search results
 */
function displayResults(results, query) {
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <h3>No results found</h3>
                <p>Try a different search query or adjust your search terms.</p>
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = results.map((result, index) => `
        <div class="result-card">
            <div class="result-header">
                <div class="result-title">${escapeHtml(result.pub_title || 'Untitled')}</div>
                <div class="result-score">Score: ${result.score.toFixed(2)}</div>
            </div>
            
            <div class="result-metadata">
                <div class="metadata-item">
                    <span class="metadata-label">ID:</span>
                    <span>${result.pub_id}</span>
                </div>
                ${result.pub_year ? `
                <div class="metadata-item">
                    <span class="metadata-label">Year:</span>
                    <span>${result.pub_year}</span>
                </div>
                ` : ''}
                ${result.pub_authors ? `
                <div class="metadata-item">
                    <span class="metadata-label">Authors:</span>
                    <span>${escapeHtml(result.pub_authors.substring(0, 100))}${result.pub_authors.length > 100 ? '...' : ''}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="result-section">Section: ${result.section || 'unknown'}</div>
            
            <div class="result-excerpt">
                ${highlightQuery(escapeHtml(result.excerpt || 'No excerpt available'), query)}
            </div>
            
            <div class="result-actions">
                <button class="btn btn-primary" onclick="viewSummary('${result.pub_id}')">
                    📄 View AI Summary
                </button>
                <button class="btn btn-secondary" onclick="viewFullPublication('${result.pub_id}')">
                    📚 Full Publication
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Fetch and display AI-generated summary
 */
async function viewSummary(pubId) {
    try {
        // Show loading
        showSummaryModal('Loading summary...', true);
        
        const response = await fetch(`${API_BASE_URL}/summarize/${pubId}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch summary: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Display summary
        const summaryHtml = `
            <h2 class="summary-title">${escapeHtml(data.title)}</h2>
            <div class="summary-text">${escapeHtml(data.summary)}</div>
        `;
        
        showSummaryModal(summaryHtml, false);
        
    } catch (error) {
        showSummaryModal(`<div class="error-message">Error loading summary: ${error.message}</div>`, false);
    }
}

/**
 * View full publication details
 */
async function viewFullPublication(pubId) {
    try {
        const response = await fetch(`${API_BASE_URL}/pub/${pubId}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch publication: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Display full publication in modal
        let sectionsHtml = '<h3>Sections:</h3>';
        const sections = data.sections || {};
        
        for (const [sectionName, sectionText] of Object.entries(sections)) {
            sectionsHtml += `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #667eea; text-transform: capitalize; margin-bottom: 10px;">${sectionName}</h4>
                    <div style="color: #444; line-height: 1.6;">${escapeHtml(sectionText.substring(0, 1000))}${sectionText.length > 1000 ? '...' : ''}</div>
                </div>
            `;
        }
        
        const publicationHtml = `
            <h2 class="summary-title">${escapeHtml(data.title || 'Untitled')}</h2>
            <div class="result-metadata" style="margin-bottom: 20px;">
                <div class="metadata-item">
                    <span class="metadata-label">Year:</span>
                    <span>${data.year || 'Unknown'}</span>
                </div>
                <div class="metadata-item">
                    <span class="metadata-label">Authors:</span>
                    <span>${escapeHtml(data.authors || 'Unknown')}</span>
                </div>
            </div>
            <div class="summary-text">${sectionsHtml}</div>
        `;
        
        showSummaryModal(publicationHtml, false);
        
    } catch (error) {
        showSummaryModal(`<div class="error-message">Error loading publication: ${error.message}</div>`, false);
    }
}

/**
 * Show/hide summary modal
 */
function showSummaryModal(content, isLoading = false) {
    let modal = document.getElementById('summaryModal');
    
    if (!modal) {
        // Create modal if it doesn't exist
        modal = document.createElement('div');
        modal.id = 'summaryModal';
        modal.className = 'summary-modal';
        modal.innerHTML = `
            <div class="summary-content">
                <button class="summary-close" onclick="closeSummaryModal()">&times;</button>
                <div id="summaryModalContent"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeSummaryModal();
            }
        });
    }
    
    const modalContent = document.getElementById('summaryModalContent');
    
    if (isLoading) {
        modalContent.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>${content}</p>
            </div>
        `;
    } else {
        modalContent.innerHTML = content;
    }
    
    modal.style.display = 'block';
}

/**
 * Close summary modal
 */
function closeSummaryModal() {
    const modal = document.getElementById('summaryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Show error message
 */
function showError(message) {
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.innerHTML = `
        <div class="error-message">
            <strong>Error:</strong> ${escapeHtml(message)}
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Highlight search query terms in text
 */
function highlightQuery(text, query) {
    if (!query) return text;
    
    // Split query into words
    const words = query.split(/\s+/).filter(w => w.length > 2);
    
    let highlightedText = text;
    words.forEach(word => {
        const regex = new RegExp(`(${word})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    
    return highlightedText;
}

// Add CSS for highlighted text
const style = document.createElement('style');
style.textContent = `
    mark {
        background-color: #fff59d;
        padding: 2px 4px;
        border-radius: 2px;
        font-weight: 600;
    }
`;
document.head.appendChild(style);
