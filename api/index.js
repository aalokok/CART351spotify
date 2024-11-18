require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// Add session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'spotify-visualizer-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Serve static files
app.use(express.static('public'));

// Spotify API credentials
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = 'https://cart-351spotify.vercel.app/callback';

app.get('/login', (req, res) => {
    const scope = 'user-top-read';
    const state = Math.random().toString(36).substring(7);
    req.session.state = state; // Store state in session

    const authUrl = `https://accounts.spotify.com/authorize?` +
        `client_id=${client_id}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}` +
        `&show_dialog=true`;

    res.redirect(authUrl);
});

app.get('/logout', (req, res) => {
    req.session.destroy(); // Clear the session
    res.redirect('/');
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const state = req.query.state;

    // Verify state matches
    if (state !== req.session.state) {
        return res.redirect('/?error=state_mismatch');
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', null, {
            params: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Store tokens in session instead of global object
        req.session.access_token = response.data.access_token;
        req.session.refresh_token = response.data.refresh_token;
        res.redirect('/');
    } catch (error) {
        console.error('Error getting token:', error);
        res.redirect('/?error=invalid_token');
    }
});

app.get('/top-artists', async (req, res) => {
    if (!req.session.access_token) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/top/artists', {
            headers: {
                'Authorization': `Bearer ${req.session.access_token}`
            },
            params: {
                limit: 20,
                time_range: 'medium_term'
            }
        });

        res.json(response.data);
    } catch (error) {
        if (error.response?.status === 401) {
            // Token expired, try to refresh
            try {
                await refreshToken(req);
                // Retry the request with new token
                const newResponse = await axios.get('https://api.spotify.com/v1/me/top/artists', {
                    headers: {
                        'Authorization': `Bearer ${req.session.access_token}`
                    },
                    params: {
                        limit: 20,
                        time_range: 'medium_term'
                    }
                });
                return res.json(newResponse.data);
            } catch (refreshError) {
                return res.status(401).json({ error: 'Session expired' });
            }
        }
        res.status(500).json({ error: 'Failed to fetch top artists' });
    }
});

app.get('/artist-preview/:id', async (req, res) => {
    if (!req.session.access_token) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const response = await axios.get(
            `https://api.spotify.com/v1/artists/${req.params.id}/top-tracks?market=US`,
            {
                headers: {
                    'Authorization': `Bearer ${req.session.access_token}`
                }
            }
        );

        const track = response.data.tracks.find(t => t.preview_url) || response.data.tracks[0];
        res.json({ preview_url: track?.preview_url });
    } catch (error) {
        console.error('Error fetching artist preview:', error);
        res.status(500).json({ error: 'Failed to fetch artist preview' });
    }
});

// Add token refresh functionality
async function refreshToken(req) {
    if (!req.session.refresh_token) {
        throw new Error('No refresh token available');
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', null, {
            params: {
                grant_type: 'refresh_token',
                refresh_token: req.session.refresh_token
            },
            headers: {
                'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        req.session.access_token = response.data.access_token;
        if (response.data.refresh_token) {
            req.session.refresh_token = response.data.refresh_token;
        }
    } catch (error) {
        throw error;
    }
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});