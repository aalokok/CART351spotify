// public/app.js

// Genre color mapping
const genreColors = {
    pop: '#FF69B4',
    rock: '#B22222',
    hiphop: '#4B0082',
    rap: '#800080',
    rnb: '#8B4513',
    jazz: '#4682B4',
    classical: '#DEB887',
    electronic: '#00CED1',
    dance: '#FF1493',
    indie: '#F4A460',
    metal: '#2F4F4F',
    alternative: '#8B008B',
    folk: '#556B2F',
    soul: '#8B4513',
    blues: '#483D8B',
    country: '#CD853F',
    punk: '#FF4500',
    reggae: '#228B22',
    latin: '#FF8C00',
    house: '#1E90FF',
    trap: '#9400D3',
    techno: '#00BFFF'
};

// Global state
let audioPlayer = null;
let currentTimeRange = 'medium_term';
let currentAnimationFrame = null;
let visualizerAnimationFrame = null;
let currentPreview = null;

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/top-artists');
        if (!response.ok) throw new Error('Not logged in');

        const data = await response.json();
        initializeUI(data.items);
    } catch (error) {
        console.log('User needs to log in');
        showLoginUI();
    }
});

// UI State Management
function initializeUI(artists) {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('user-controls').classList.remove('hidden');
    document.getElementById('visualization').classList.remove('hidden');

    const genreData = analyzeGenres(artists);
    updateGenreStats(genreData);
    createBackgroundVisualizer(genreData);
    createFloatingArtists(artists);

    // Setup click handler to close artist info
    document.addEventListener('click', handleGlobalClick);
}

function showLoginUI() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('user-controls').classList.add('hidden');
    document.getElementById('visualization').classList.add('hidden');
}

// Time Range Controls
function toggleTimeRange() {
    const timeRanges = {
        short_term: { next: 'medium_term', label: 'Last 6 Months' },
        medium_term: { next: 'long_term', label: 'All Time' },
        long_term: { next: 'short_term', label: 'Last 4 Weeks' }
    };

    currentTimeRange = timeRanges[currentTimeRange].next;
    const button = document.querySelector('.time-range');
    button.textContent = timeRanges[timeRanges[currentTimeRange].next].label;

    loadArtistData();
}

// Data Loading
async function loadArtistData() {
    try {
        const response = await fetch(`/top-artists?time_range=${currentTimeRange}`);
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        // Clear existing visualizations
        clearVisualizations();
        // Create new visualizations
        initializeUI(data.items);
    } catch (error) {
        console.error('Error loading artist data:', error);
    }
}

// Genre Analysis
function getGenreColor(genre) {
    const normalizedGenre = genre.toLowerCase().replace(/[\s-]/g, '');
    const matchingGenre = Object.keys(genreColors).find(key =>
        normalizedGenre.includes(key)
    );
    return genreColors[matchingGenre] || '#1DB954';
}

function analyzeGenres(artists) {
    const genreCounts = {};
    artists.forEach(artist => {
        artist.genres.forEach(genre => {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
    });

    const sortedGenres = Object.entries(genreCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

    const total = sortedGenres.reduce((sum, [,count]) => sum + count, 0);
    return sortedGenres.map(([genre, count]) => ({
        genre,
        percentage: (count / total) * 100,
        color: getGenreColor(genre)
    }));
}

// UI Updates
function updateGenreStats(genreData) {
    const container = document.querySelector('.genre-stats');
    container.innerHTML = `
        <h3>Your Top Genres</h3>
        ${genreData.map(({ genre, percentage, color }) => `
            <div class="genre-bar">
                <div class="genre-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
                <div class="genre-label">${genre} (${percentage.toFixed(1)}%)</div>
            </div>
        `).join('')}
    `;
}

// Background Visualization
function createBackgroundVisualizer(genreData) {
    const visualizer = document.querySelector('.background-visualizer');
    let gradientAngle = 45;
    let breathing = 0;
    const speed = 0.0001; // Adjust this to make the breathing slower/faster

    // Get the most prominent genre colors from your data
    const colors = genreData.slice(0, 3).map(genre => genre.color);

    // If we have less than 3 colors, add some defaults
    while (colors.length < 3) {
        colors.push('#1DB954'); // Spotify green
    }

    function animate(timestamp) {
        breathing = Math.sin(timestamp * speed) * 0.5 + 0.5; // Creates a value that oscillates between 0 and 1
        gradientAngle = 45 + (breathing * 45); // Subtle angle rotation

        // Create gradient stops with dynamic positions
        // Apply the gradient
        visualizer.style.background = `
            linear-gradient(
                ${gradientAngle}deg,
                ${colors[0]} ${breathing * 20}%,
                ${colors[1]} ${30 + breathing * 20}%,
                ${colors[2]} ${60 + breathing * 20}%
                
            )
        `;
        visualizer.style.opacity = 0.7 + breathing * 0.3; // Subtle opacity breathing

        // Add a subtle scale effect to the entire background
        visualizer.style.transform = `scale(${1 + breathing * 0.02})`;

        visualizerAnimationFrame = requestAnimationFrame(animate);
    }

    visualizerAnimationFrame = requestAnimationFrame(animate);
}
function setBreathingSpeed(speed) {
    // Speed should be between 0.001 (very slow) and 0.01 (fast)
    this.speed = Math.max(0.001, Math.min(0.01, speed));
}

// Optional: Add this function to change the gradient colors
function updateGradientColors(newColors) {
    // newColors should be an array of 3 color values
    colors = newColors.length >= 3 ? newColors.slice(0, 3) : [...newColors, '#1DB954'];
}

// Artist Visualization
function createFloatingArtists(artists) {
    const container = document.querySelector('.orbit-container');
    container.innerHTML = '';

    artists.forEach((artist, index) => {
        const node = createArtistNode(artist, index);
        container.appendChild(node);
        animateArtistNode(node, artist);
    });
}

function createArtistNode(artist, index) {
    const node = document.createElement('div');
    node.className = 'artist-node';

    const img = document.createElement('img');
    img.src = artist.images[0].url;
    img.alt = artist.name;
    img.className = 'artist-image';

    const primaryGenreColor = artist.genres.length > 0
        ? getGenreColor(artist.genres[0])
        : '#1DB954';

    // Replace box-shadow with border
    img.style.borderColor = primaryGenreColor;

    node.appendChild(img);

    node.addEventListener('click', (e) => {
        e.stopPropagation();
        showArtistInfo(artist, node);
    });

    return node;

}

function animateArtistNode(node, artist) {
    const container = document.querySelector('.orbit-container');
    const angle = (Math.random() * Math.PI * 2);
    const radius = 150 + Math.























    random() * 100;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const speed = 2 + Math.random() * 4;
    const xRange = 50 + Math.random() * 50;
    const yRange = 50 + Math.random() * 50;
    const startTime = Math.random() * 1000;

    function animate(timestamp) {
        const time = timestamp + startTime;
        const baseX = centerX + radius * Math.cos(angle);
        const baseY = centerY + radius * Math.sin(angle);

        const x = baseX + Math.sin(time / 1000 / speed) * xRange;
        const y = baseY + Math.cos(time / 1000 / speed) * yRange;

        node.style.left = `${x - 40}px`;
        node.style.top = `${y - 40}px`;

        currentAnimationFrame = requestAnimationFrame(animate);
    }

    currentAnimationFrame = requestAnimationFrame(animate);
}

// Artist Info Popup
async function showArtistInfo(artist, node) {
    const popup = document.querySelector('.artist-info-popup');
    popup.classList.remove('hidden');

    if (currentPreview) {
        currentPreview.pause();
    }

    const primaryGenreColor = artist.genres.length > 0
        ? getGenreColor(artist.genres[0])
        : '#1DB954';

    popup.innerHTML = `
        <div class="artist-header">
            <img src="${artist.images[0].url}" 
                 alt="${artist.name}" 
                 style="border: 3px solid ${primaryGenreColor}; filter: grayscale(0%);">
            <div class="artist-name">${artist.name}</div>
        </div>
        <div class="artist-details">
            <p>Popularity: ${artist.popularity}%</p>
            <p>Genres: ${artist.genres.join(', ')}</p>
            <p>Followers: ${artist.followers.total.toLocaleString()}</p>
        </div>
        <div class="audio-controls">
            <a href="${artist.external_urls.spotify}" target="_blank" class="audio-button">
                Open in Spotify
            </a>
            <button class="audio-button preview-button">
                Loading Preview...
            </button>
        </div>
    `;

    // Position popup near clicked artist
    positionPopup(popup, node);

    // Fetch preview
    try {
        const response = await fetch(`/artist-preview/${artist.id}`);
        if (!response.ok) throw new Error('Failed to fetch preview');

        const data = await response.json();
        const previewButton = popup.querySelector('.preview-button');

        if (data.preview_url) {
            let isPlaying = false;
            previewButton.textContent = 'Play Preview';

            previewButton.onclick = () => {
                if (isPlaying && currentPreview) {
                    currentPreview.pause();
                    previewButton.textContent = 'Play Preview';
                } else {
                    if (currentPreview) {
                        currentPreview.pause();
                    }
                    currentPreview = new Audio(data.preview_url);
                    currentPreview.play();
                    previewButton.textContent = 'Pause Preview';

                    currentPreview.onended = () => {
                        isPlaying = false;
                        previewButton.textContent = 'Play Preview';
                    };
                }
                isPlaying = !isPlaying;
            };
        } else {
            previewButton.textContent = 'No Preview Available';
            previewButton.disabled = true;
        }
    } catch (error) {
        console.error('Error fetching preview:', error);
        const previewButton = popup.querySelector('.preview-button');
        previewButton.textContent = 'Preview Unavailable';
        previewButton.disabled = true;
    }
}


function positionPopup(popup, node) {
    const rect = node.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    let left = rect.left + (rect.width - popupRect.width) / 2;
    left = Math.max(30, Math.min(left, window.innerWidth - popupRect.width - 30));

    popup.style.left = `${left}px`;
}


// Event Handlers
function handleGlobalClick(event) {
    const popup = document.querySelector('.artist-info-popup');
    if (!event.target.closest('.artist-node') &&
        !event.target.closest('.artist-info-popup') &&
        !popup.classList.contains('hidden')) {
        popup.classList.add('hidden');

        // Stop any playing preview
        if (currentPreview) {
            currentPreview.pause();
        }
    }
}

// Cleanup
function clearVisualizations() {
    if (currentAnimationFrame) {
        cancelAnimationFrame(currentAnimationFrame);
    }
    if (visualizerAnimationFrame) {
        cancelAnimationFrame(visualizerAnimationFrame);
    }
    if (currentPreview) {
        currentPreview.pause();
        currentPreview = null;
    }
}

// Window resize handler
window.addEventListener('resize', debounce(() => {
    const artists = document.querySelectorAll('.artist-node');
    if (artists.length) {
        clearVisualizations();
        createFloatingArtists(Array.from(artists).map(node => {
            return {
                images: [{ url: node.querySelector('img').src }],
                name: node.querySelector('img').alt
            };
        }));
    }
}, 250));

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}