// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Spotify API credentials
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = 'https://cart-351spotify.vercel.app/callback';

// Store tokens in memory with user identification
let userTokens = new Map();

app.get('/login', (req, res) => {
    const scope = 'user-top-read';
    // Generate a unique ID for this login attempt
    const userId = Math.random().toString(36).substr(2, 9);
    const state = userId; // Use userId as state

    const authUrl = `https://accounts.spotify.com/authorize?` +
        `client_id=${client_id}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}` +
        `&show_dialog=true`;

    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const state = req.query.state; // This is our userId

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

        // Store tokens with user ID
        userTokens.set(state, {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token
        });

        // Redirect with userId as query parameter
        res.redirect(`/?userId=${state}`);
    } catch (error) {
        console.error('Error getting token:', error);
        res.redirect('/error.html');
    }
});

app.get('/logout', (req, res) => {
    const userId = req.query.userId;
    if (userId) {
        userTokens.delete(userId);
    }
    res.redirect('/');
});

app.get('/top-artists', async (req, res) => {
    const userId = req.query.userId;
    const userToken = userTokens.get(userId);

    if (!userToken?.access_token) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/top/artists', {
            headers: {
                'Authorization': `Bearer ${userToken.access_token}`
            },
            params: {
                limit: 20,
                time_range: 'medium_term'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching top artists:', error);
        res.status(500).json({ error: 'Failed to fetch top artists' });
    }
});

app.get('/artist-preview/:id', async (req, res) => {
    const userId = req.query.userId;
    const userToken = userTokens.get(userId);

    if (!userToken?.access_token) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const response = await axios.get(
            `https://api.spotify.com/v1/artists/${req.params.id}/top-tracks?market=US`,
            {
                headers: {
                    'Authorization': `Bearer ${userToken.access_token}`
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});