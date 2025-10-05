// API Base URL - adjust if needed
const API_BASE_URL = window.location.origin;

const publicationCache = new Map();

const popularQueries = [
    { label: "Bone loss in microgravity", query: "bone loss in microgravity countermeasures" },
    { label: "Space radiation shielding", query: "radiation shielding astronauts" },
    { label: "Immune response in space", query: "immune dysregulation long duration spaceflight" },
    { label: "Microbiome shifts", query: "spaceflight microbiome alterations" }
];

const libraryCollections = [
    {
        title: "Bone Health & Countermeasures",
        description: "Discover interventions that mitigate skeletal deterioration in microgravity, from pharmaceuticals to exercise protocols.",
        tags: ["physiology", "countermeasure", "bone"],
        pubId: "PMC5666799",
        query: "microgravity bone loss countermeasures"
    },
    {
        title: "Radiation Biology Essentials",
        description: "Key findings on shielding, dose response, and cellular repair mechanisms under cosmic radiation exposure.",
        tags: ["radiation", "cellular", "mission"],
        pubId: "PMC3630201",
        query: "space radiation cellular damage"
    },
    {
        title: "Muscle Atrophy Insights",
        description: "Track proteomic and transcriptomic changes that drive muscle deconditioning during long-duration missions.",
        tags: ["physiology", "omics", "mission"],
        pubId: "PMC6222041",
        query: "spaceflight muscle atrophy omics"
    },
    {
        title: "Immune Modulation",
        description: "Evidence of altered immune cell signaling, latent virus reactivation, and potential countermeasures in orbit.",
        tags: ["immunology", "health", "countermeasure"],
        pubId: "PMC7998608",
        query: "spaceflight immune dysregulation"
    },
    {
        title: "Microbiome & Biofilms",
        description: "Studies cataloguing microbial community shifts and biofilm behavior in spacecraft environments.",
        tags: ["microbiome", "environment", "mission"],
        pubId: "PMC6813909",
        query: "spaceflight microbiome biofilm"
    },
    {
        title: "Vision Impairment & Fluid Shifts",
        description: "Research on cephalad fluid shifts, ocular changes, and the suspected mechanisms behind SANS.",
        tags: ["physiology", "neuroscience", "mission"],
        pubId: "PMC5460236",
        query: "spaceflight vision impairment sans"
    }
];

const libraryFilterCatalog = [
    { id: "all", label: "All Topics" },
    { id: "physiology", label: "Physiology" },
    { id: "countermeasure", label: "Countermeasures" },
    { id: "radiation", label: "Radiation" },
    { id: "immunology", label: "Immune Health" },
    { id: "microbiome", label: "Microbiome" },
    { id: "mission", label: "Mission Planning" },
    { id: "omics", label: "Omics" },
    { id: "health", label: "Crew Health" },
    { id: "environment", label: "Environment" },
    { id: "neuroscience", label: "Neuroscience" },
    { id: "bone", label: "Bone Biology" }
];

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

    buildPopularQueryChips();
    populateQuickStats();
    renderLibraryFilters();
    renderLibraryItems();
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
        const data = await loadPublication(pubId);
        const sourceUrl = extractPublicationUrl(data);

        if (sourceUrl) {
            window.open(sourceUrl, '_blank', 'noopener');
            return;
        }

        const sections = data.sections || {};
        let sectionsHtml = '';

        if (Object.keys(sections).length === 0) {
            sectionsHtml = '<p>Sections unavailable in the cached publication. Try accessing the source repository directly.</p>';
        } else {
            sectionsHtml = '<h3>Sections:</h3>';
            for (const [sectionName, sectionText] of Object.entries(sections)) {
                const snippet = truncateText(sectionText || '', 1000);
                sectionsHtml += `
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #667eea; text-transform: capitalize; margin-bottom: 10px;">${escapeHtml(sectionName)}</h4>
                        <div style="color: #444; line-height: 1.6;">${escapeHtml(snippet)}</div>
                    </div>
                `;
            }
        }

        const publicationHtml = `
            <h2 class="summary-title">${escapeHtml(data.title || 'Untitled')}</h2>
            <div class="result-metadata" style="margin-bottom: 20px;">
                <div class="metadata-item">
                    <span class="metadata-label">Year:</span>
                    <span>${escapeHtml(data.year || 'Unknown')}</span>
                </div>
                <div class="metadata-item">
                    <span class="metadata-label">Authors:</span>
                    <span>${escapeHtml(data.authors || 'Unknown')}</span>
                </div>
            </div>
            <div class="summary-text">
                <p style="margin-bottom: 16px; color: #555;">Original source link not provided in metadata. Showing cached sections instead.</p>
                ${sectionsHtml}
            </div>
        `;

        showSummaryModal(publicationHtml, false);

    } catch (error) {
        showSummaryModal(`<div class="error-message">Error loading publication: ${escapeHtml(error.message)}</div>`, false);
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

function buildPopularQueryChips() {
    const container = document.getElementById('popularQueries');
    if (!container) return;

    const fragment = document.createDocumentFragment();
    popularQueries.forEach(({ label, query }) => {
        const button = document.createElement('button');
        button.className = 'chip';
        button.type = 'button';
        button.textContent = label;
        button.dataset.query = query;
        button.addEventListener('click', () => {
            document.getElementById('searchInput').value = query;
            performSearch();
        });
        fragment.appendChild(button);
    });

    container.appendChild(fragment);
}

async function populateQuickStats() {
    const chunksEl = document.getElementById('statChunks');
    const publicationsEl = document.getElementById('statPublications');

    if (!chunksEl && !publicationsEl) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) {
            throw new Error('Health endpoint unavailable');
        }
        const data = await response.json();

        if (chunksEl) {
            chunksEl.textContent = formatNumber(data.n_chunks ?? 0);
        }

        if (publicationsEl) {
            const indexed = data.n_publications_indexed;
            const cached = data.n_publications_cached;

            if (typeof indexed === 'number') {
                if (typeof cached === 'number' && cached > indexed) {
                    publicationsEl.textContent = `${formatNumber(indexed)} / ${formatNumber(cached)}`;
                    publicationsEl.setAttribute('title', 'Indexed publications / cached publications');
                } else {
                    publicationsEl.textContent = formatNumber(indexed);
                    publicationsEl.removeAttribute('title');
                }
            } else {
                publicationsEl.textContent = '—';
            }
        }
    } catch (error) {
        if (chunksEl) {
            chunksEl.textContent = '—';
        }
        if (publicationsEl) {
            publicationsEl.textContent = '—';
        }
        console.warn('Unable to load quick stats', error);
    }
}

function renderLibraryFilters() {
    const filtersContainer = document.getElementById('libraryFilters');
    if (!filtersContainer) return;

    const relevantFilters = libraryFilterCatalog.filter(filter => {
        if (filter.id === 'all') return true;
        return libraryCollections.some(item => item.tags.includes(filter.id));
    });

    relevantFilters.forEach((filter, index) => {
        const button = document.createElement('button');
        button.className = `library-filter${index === 0 ? ' active' : ''}`;
        button.type = 'button';
        button.dataset.filter = filter.id;
        button.textContent = filter.label;
        button.addEventListener('click', () => {
            document.querySelectorAll('.library-filter').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            renderLibraryItems(filter.id);
        });
        filtersContainer.appendChild(button);
    });
}

function renderLibraryItems(activeFilter = 'all') {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;

    const filteredItems = libraryCollections.filter(item => {
        if (activeFilter === 'all') return true;
        return item.tags.includes(activeFilter);
    });

    if (filteredItems.length === 0) {
        grid.innerHTML = `
            <div class="no-results" style="grid-column: 1 / -1;">
                <h3>No collections yet</h3>
                <p>We are expanding this topic—check back soon or try a different filter.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredItems.map(item => `
        <article class="library-card">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.description)}</p>
            <div class="library-tags">
                ${item.tags.map(tag => `<span class="tag">${escapeHtml(formatTag(tag))}</span>`).join('')}
            </div>
            <div class="library-actions">
                <button class="btn btn-primary" type="button" onclick="prefillAndSearch('${escapeAttribute(item.query)}')">Search Topic</button>
                ${item.pubId ? `<button class="btn btn-secondary" type="button" onclick="viewFullPublication('${item.pubId}')">Open Source</button>` : ''}
                ${item.pubId ? `<button class="btn btn-secondary" type="button" onclick="viewSummary('${item.pubId}')">AI Summary</button>` : ''}
            </div>
        </article>
    `).join('');
}

function prefillAndSearch(query) {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    searchInput.value = query;
    performSearch();
}

async function runAgent() {
    const questionInput = document.getElementById('agentQuestion');
    const responsesContainer = document.getElementById('agentResponses');

    if (!questionInput || !responsesContainer) return;

    const query = questionInput.value.trim();

    if (!query) {
        responsesContainer.innerHTML = `
            <div class="agent-response-card">
                <div class="error-message">Please enter a question so the agent can look up relevant passages.</div>
            </div>
        `;
        return;
    }

    responsesContainer.innerHTML = `
        <div class="agent-response-card">
            <div class="agent-loading">
                <div class="agent-spinner"></div>
                <span>Scanning publications for "${escapeHtml(query)}"...</span>
            </div>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&k=6`);
        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }

        const results = await response.json();
        if (!Array.isArray(results) || results.length === 0) {
            responsesContainer.innerHTML = `
                <div class="agent-response-card">
                    <p>No matching passages were found. Try adjusting your question or using different keywords.</p>
                </div>
            `;
            return;
        }

        const topHits = results.slice(0, 3);
        const enriched = await Promise.all(topHits.map(async hit => {
            let link = '';
            let title = hit.pub_title || hit.pub_id;
            try {
                const publication = await loadPublication(hit.pub_id);
                title = publication.title || title;
                link = extractPublicationUrl(publication) || '';
            } catch (err) {
                console.warn('Agent unable to load publication metadata', err);
            }
            return { hit, link, title };
        }));

        responsesContainer.innerHTML = enriched.map(({ hit, link, title }) => {
            const excerpt = truncateText(hit.excerpt || '', 450);
            const highlighted = highlightQuery(escapeHtml(excerpt), query);
            const safeTitle = escapeHtml(title || hit.pub_id);
            const linkHtml = link
                ? `<a class="agent-response-link" href="${escapeAttribute(link)}" target="_blank" rel="noopener">🔗 View Source</a>`
                : `<span class="agent-note">Source link unavailable</span>`;

            return `
                <div class="agent-response-card">
                    <div class="agent-response-header">
                        <div class="agent-response-title">${safeTitle}</div>
                        ${linkHtml}
                    </div>
                    <div class="agent-response-excerpt">${highlighted}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        responsesContainer.innerHTML = `
            <div class="agent-response-card">
                <div class="error-message">Agent error: ${escapeHtml(error.message)}</div>
            </div>
        `;
    }
}

function formatNumber(num) {
    return Number(num).toLocaleString();
}

function formatTag(tag) {
    return tag
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

async function loadPublication(pubId) {
    if (publicationCache.has(pubId)) {
        return publicationCache.get(pubId);
    }

    const response = await fetch(`${API_BASE_URL}/pub/${pubId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch publication: ${response.statusText}`);
    }

    const data = await response.json();
    publicationCache.set(pubId, data);
    return data;
}

function extractPublicationUrl(publication) {
    if (!publication) return '';

    const candidates = [
        publication.pmc_url,
        publication.url,
        publication.link,
        publication.doi && publication.doi.startsWith('http') ? publication.doi : publication.doi ? `https://doi.org/${publication.doi}` : '',
        publication.source_row && (publication.source_row.Link || publication.source_row.URL)
    ];

    return candidates.find(value => typeof value === 'string' && value.trim().length > 0) || '';
}

function truncateText(text, limit = 500) {
    if (!text) return '';
    if (text.length <= limit) return text;
    return `${text.slice(0, limit).trimEnd()}...`;
}

function escapeAttribute(text) {
    return (text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
